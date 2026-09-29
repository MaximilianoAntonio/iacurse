"""
Tests de la gestión de estudiantes por el docente (/api/admin/students).

Cubre:
- Creación en lote (temporal segura, must_change_password, email placeholder)
- Duplicados en payload y en DB
- Permisos: estudiante recibe 403
- Reset de contraseña: ok (nueva temporal + flag) y 404 si no es estudiante
- Reportes: GET /api/report identifica al reportante por reporterCode
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import ErrorReport

User = get_user_model()


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        username="hermes.mora",
        email="hermes.mora@uv.cl",
        password="Docente-123",
        role=User.ROLE_TEACHER,
        name="Prof. Hermes Mora",
    )


@pytest.fixture
def teacher_client(teacher):
    c = APIClient()
    c.force_authenticate(user=teacher)
    return c


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="EM-0001",
        email="em-0001@students.local",
        password="Temporal-123",
        role=User.ROLE_STUDENT,
        student_code="EM-0001",
        name="",
    )


@pytest.mark.django_db
class TestStudentsAdmin:
    def test_lista_estudiantes(self, teacher_client, student):
        resp = teacher_client.get("/api/admin/students")
        assert resp.status_code == 200
        rows = resp.json()["students"]
        assert len(rows) == 1
        row = rows[0]
        assert row["studentCode"] == "EM-0001"
        assert set(row) == {
            "id", "studentCode", "mustChangePassword",
            "lastActive", "createdAt", "points", "streak",
        }

    def test_bulk_create_ok(self, teacher_client):
        resp = teacher_client.post(
            "/api/admin/students",
            {"codes": ["EM-0002", "EM-0003"]},
            format="json",
        )
        assert resp.status_code == 201
        payload = resp.json()
        assert payload["errors"] == []
        created = {c["studentCode"]: c["temporaryPassword"] for c in payload["created"]}
        assert set(created) == {"EM-0002", "EM-0003"}
        for code, temp in created.items():
            user = User.objects.get(student_code=code)
            assert user.role == User.ROLE_STUDENT
            assert user.must_change_password is True
            assert user.email == f"{code.lower()}@students.local"
            assert user.username == code
            assert user.check_password(temp)
            # Temporal: 10-12 chars, letras+dígitos, sin ambiguos
            assert 10 <= len(temp) <= 12
            assert temp.isalnum()
            assert not set(temp) & set("l1IO0")

    def test_bulk_create_duplicados(self, teacher_client, student):
        # EM-0001 ya existe en DB; em-0002 duplica a EM-0002 en el payload;
        # el código vacío se rechaza. EM-0002 se crea igualmente.
        resp = teacher_client.post(
            "/api/admin/students",
            {"codes": ["EM-0001", "EM-0002", "em-0002", ""]},
            format="json",
        )
        assert resp.status_code == 201
        payload = resp.json()
        assert [c["studentCode"] for c in payload["created"]] == ["EM-0002"]
        assert len(payload["errors"]) == 3

    def test_bulk_create_duplicado_case_insensitive(self, teacher_client, student):
        # "em-0001" difiere del "EM-0001" existente solo en mayúsculas: el
        # login por código es case-insensitive, así que debe rechazarse
        # (antes de este chequeo se creaba y reventaba con IntegrityError 500).
        resp = teacher_client.post(
            "/api/admin/students",
            {"codes": ["em-0001", "EM-0002"]},
            format="json",
        )
        assert resp.status_code == 201
        payload = resp.json()
        assert [c["studentCode"] for c in payload["created"]] == ["EM-0002"]
        assert len(payload["errors"]) == 1
        assert payload["errors"][0]["studentCode"] == "em-0001"

    def test_bulk_create_codigo_con_arroba_rechazado(self, teacher_client):
        # Un código con "@" nunca podría entrar: el login interpreta cualquier
        # identificador con "@" como email de docente.
        resp = teacher_client.post(
            "/api/admin/students",
            {"codes": ["a@b", "EM-0002"]},
            format="json",
        )
        assert resp.status_code == 201
        payload = resp.json()
        assert [c["studentCode"] for c in payload["created"]] == ["EM-0002"]
        assert len(payload["errors"]) == 1
        assert payload["errors"][0]["studentCode"] == "a@b"

    def test_bulk_create_colision_username_no_explota(self, teacher_client, teacher):
        # "hermes.mora" ya es el username del docente (sin student_code):
        # debe reportarse como error del código, no un 500.
        resp = teacher_client.post(
            "/api/admin/students",
            {"codes": ["hermes.mora", "EM-0002"]},
            format="json",
        )
        assert resp.status_code == 201
        payload = resp.json()
        assert [c["studentCode"] for c in payload["created"]] == ["EM-0002"]
        assert len(payload["errors"]) == 1
        assert payload["errors"][0]["studentCode"] == "hermes.mora"

    def test_bulk_create_max_200(self, teacher_client):
        resp = teacher_client.post(
            "/api/admin/students",
            {"codes": [f"EM-{i:04d}" for i in range(201)]},
            format="json",
        )
        assert resp.status_code == 400

    def test_estudiante_403(self, student):
        client = APIClient()
        client.force_authenticate(user=student)
        assert client.get("/api/admin/students").status_code == 403
        assert client.post(
            "/api/admin/students", {"codes": ["EM-0009"]}, format="json"
        ).status_code == 403


@pytest.mark.django_db
class TestResetPassword:
    def test_reset_ok(self, teacher_client, student):
        student.must_change_password = False
        student.save()
        resp = teacher_client.post(f"/api/admin/students/{student.id}/reset-password")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["studentCode"] == "EM-0001"
        student.refresh_from_db()
        assert student.must_change_password is True
        assert student.check_password(payload["temporaryPassword"])

    def test_reset_404_no_existe(self, teacher_client):
        resp = teacher_client.post("/api/admin/students/9999/reset-password")
        assert resp.status_code == 404

    def test_reset_404_no_es_estudiante(self, teacher_client, teacher):
        resp = teacher_client.post(f"/api/admin/students/{teacher.id}/reset-password")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestReportAnonymization:
    def test_report_devuelve_reporter_code(self, teacher_client, student):
        ErrorReport.objects.create(
            user=student, source="activity", source_id="a1",
            reason="incorrect", comment="La respuesta correcta es otra.",
        )
        resp = teacher_client.get("/api/report")
        assert resp.status_code == 200
        report = resp.json()["reports"][0]
        assert report["reporterCode"] == "EM-0001"
        assert "reporterEmail" not in report
