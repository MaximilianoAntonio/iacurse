"""
Tests del consentimiento informado electrónico (uso científico de datos).

Cubre:
- POST /api/course/consent: authorized (genera research_code, registra versión),
  rejected (sin research_code), decisión inválida (400), segundo registro
  (409), docente (403), anónimo (403).
- GET /api/course/status: bloque ``consent`` para estudiantes (pendiente,
  autorizado, rechazado, revocado) y ausencia del bloque para docentes.
- POST /api/course/consent/revoke: ok tras autorizar (marca revoked_at y
  authorized pasa a false), sin autorización vigente (400), doble retiro
  (400), plazo vencido (400), docente (403).
- AuditLog: eventos consent_registered / consent_revoked.
- GET /api/me/data: incluye la sección consent SIN research_code.
- GET /api/admin/students: el docente NO ve la decisión de consentimiento.
"""
import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from learning.models import StudentConsent
from telemetry.models import AuditLog

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
        student_code="EM-9001",
    )


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        username="t", email="t@uv.cl", password="X", role=User.ROLE_TEACHER
    )


@pytest.fixture
def student_client(student):
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.fixture
def teacher_client(teacher):
    c = APIClient()
    c.force_authenticate(user=teacher)
    return c


@pytest.mark.django_db
class TestRegisterConsent:
    def test_authorized_generates_research_code(self, student_client, student):
        resp = student_client.post("/api/course/consent", {"decision": "authorized"}, format="json")
        assert resp.status_code == 200
        consent = StudentConsent.objects.get(user=student)
        assert consent.decision == StudentConsent.DECISION_AUTHORIZED
        assert consent.version  # versión del documento registrada como evidencia
        assert consent.research_code is not None
        assert consent.research_code.startswith("RX-")
        assert consent.revoked_at is None
        # La respuesta nunca expone el research_code al frontend.
        body = resp.json()["consent"]
        assert body["completed"] is True
        assert body["authorized"] is True
        assert "researchCode" not in body and "research_code" not in body

    def test_rejected_without_research_code(self, student_client, student):
        resp = student_client.post("/api/course/consent", {"decision": "rejected"}, format="json")
        assert resp.status_code == 200
        consent = StudentConsent.objects.get(user=student)
        assert consent.decision == StudentConsent.DECISION_REJECTED
        assert consent.research_code is None
        assert resp.json()["consent"]["authorized"] is False

    def test_invalid_decision(self, student_client):
        resp = student_client.post("/api/course/consent", {"decision": "tal vez"}, format="json")
        assert resp.status_code == 400

    def test_second_registration_conflict(self, student_client, student):
        student_client.post("/api/course/consent", {"decision": "authorized"}, format="json")
        original = StudentConsent.objects.get(user=student)
        resp = student_client.post("/api/course/consent", {"decision": "rejected"}, format="json")
        assert resp.status_code == 409
        original.refresh_from_db()
        assert original.decision == StudentConsent.DECISION_AUTHORIZED  # no cambia

    def test_teacher_forbidden(self, teacher_client):
        resp = teacher_client.post("/api/course/consent", {"decision": "authorized"}, format="json")
        assert resp.status_code == 403

    def test_anonymous_forbidden(self):
        resp = APIClient().post("/api/course/consent", {"decision": "authorized"}, format="json")
        assert resp.status_code in (401, 403)

    def test_audit_log_registered(self, student_client, student):
        student_client.post("/api/course/consent", {"decision": "authorized"}, format="json")
        event = AuditLog.objects.get(event_type="consent_registered", actor=student)
        assert event.metadata["decision"] == "authorized"


@pytest.mark.django_db
class TestConsentStatus:
    def test_pending_by_default(self, student_client):
        resp = student_client.get("/api/course/status")
        assert resp.status_code == 200
        consent = resp.json()["consent"]
        assert consent["completed"] is False
        assert consent["authorized"] is False
        assert consent["decision"] is None
        assert consent["revokedAt"] is None

    def test_status_after_authorized(self, student_client, student):
        StudentConsent.objects.create(
            user=student, decision=StudentConsent.DECISION_AUTHORIZED,
            version="2026-08-V2", research_code="RX-TESTCODE1",
        )
        consent = student_client.get("/api/course/status").json()["consent"]
        assert consent["completed"] is True
        assert consent["authorized"] is True
        assert "researchCode" not in consent and "research_code" not in consent

    def test_teacher_has_no_consent_block(self, teacher_client):
        resp = teacher_client.get("/api/course/status")
        assert resp.status_code == 200
        assert "consent" not in resp.json()


@pytest.mark.django_db
class TestRevokeConsent:
    def _authorize(self, client):
        client.post("/api/course/consent", {"decision": "authorized"}, format="json")

    def test_revoke_ok(self, student_client, student):
        self._authorize(student_client)
        resp = student_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 200
        consent = StudentConsent.objects.get(user=student)
        assert consent.revoked_at is not None
        assert consent.authorized is False
        body = resp.json()["consent"]
        assert body["authorized"] is False
        assert body["revokedAt"] is not None
        # El registro se conserva (evidencia del ciclo de consentimiento).
        assert body["completed"] is True

    def test_revoke_without_consent(self, student_client):
        resp = student_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 400

    def test_revoke_when_rejected(self, student_client, student):
        student_client.post("/api/course/consent", {"decision": "rejected"}, format="json")
        resp = student_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 400

    def test_revoke_twice(self, student_client, student):
        self._authorize(student_client)
        student_client.post("/api/course/consent/revoke", {}, format="json")
        resp = student_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 400

    def test_revoke_after_deadline(self, student_client, student):
        self._authorize(student_client)
        with override_settings(CONSENT_REVOKE_DEADLINE="2020-01-01"):
            resp = student_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 400
        assert StudentConsent.objects.get(user=student).revoked_at is None

    def test_revoke_invalid_deadline_fail_open(self, student_client, student):
        """Un deadline mal configurado no bloquea el derecho de retiro."""
        self._authorize(student_client)
        with override_settings(CONSENT_REVOKE_DEADLINE="no-es-una-fecha"):
            resp = student_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 200

    def test_revoke_teacher_forbidden(self, teacher_client):
        resp = teacher_client.post("/api/course/consent/revoke", {}, format="json")
        assert resp.status_code == 403

    def test_audit_log_revoked(self, student_client, student):
        self._authorize(student_client)
        student_client.post("/api/course/consent/revoke", {}, format="json")
        assert AuditLog.objects.filter(event_type="consent_revoked", actor=student).exists()


@pytest.mark.django_db
class TestConsentPrivacy:
    def test_me_data_export_includes_consent_without_research_code(self, student_client, student):
        StudentConsent.objects.create(
            user=student, decision=StudentConsent.DECISION_AUTHORIZED,
            version="2026-08-V2", research_code="RX-TESTCODE2",
        )
        resp = student_client.get("/api/me/data")
        assert resp.status_code == 200
        consent = resp.json()["consent"]
        assert consent["decision"] == "authorized"
        assert consent["version"] == "2026-08-V2"
        assert "decidedAt" in consent
        assert "researchCode" not in consent and "research_code" not in consent

    def test_me_data_export_consent_none(self, student_client):
        resp = student_client.get("/api/me/data")
        assert resp.status_code == 200
        assert resp.json()["consent"] is None

    def test_admin_students_does_not_expose_decision(self, teacher_client, student):
        StudentConsent.objects.create(
            user=student, decision=StudentConsent.DECISION_AUTHORIZED,
            version="2026-08-V2", research_code="RX-TESTCODE3",
        )
        resp = teacher_client.get("/api/admin/students")
        assert resp.status_code == 200
        import json as _json

        payload = _json.dumps(resp.json())
        assert "consent" not in payload
        assert "RX-TESTCODE3" not in payload
        assert "authorized" not in payload
