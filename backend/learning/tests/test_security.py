"""
Tests de los controles de seguridad añadidos tras la auditoría DGMTD 2026.

Cubre:
- Sanitización de la pauta en GET /api/lessons/<id> (no exponer respuestas)
- Entrega de la pauta completa (reviewData) solo tras enviar un intento
- Bloqueo de intentos sobre lecciones en borrador
- Rate limiting configurado en login
- Auditoría de login exitoso/fallido (AuditLog)
- Leaderboard anonimizado para estudiantes (sin email ni códigos ajenos)
- Heartbeat con validación de propiedad de sesión
- Exportación de datos personales (GET /api/me/data)
- Purga de telemetría por retención
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from curriculum.models import Activity, Lesson, Unit
from learning.models import StudySession
from telemetry.models import AccessLog, AuditLog

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="Xa123456", role=User.ROLE_STUDENT,
        student_code="EM-9001",
    )


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        username="t", email="t@uv.cl", password="Xa123456", role=User.ROLE_TEACHER,
    )


@pytest.fixture
def client(student):
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.fixture
def curriculum(db):
    unit = Unit.objects.create(slug="u", title="Unit", order=1)
    lesson = Lesson.objects.create(unit=unit, slug="l", title="Lesson", order=1)
    mcq = Activity.objects.create(
        lesson=lesson, type="multiple_choice", title="MCQ", prompt="P",
        data={
            "options": ["A", "B"],
            "correctIndex": 0,
            "explanation": "Porque sí",
            "hints": ["Piensa en A"],
        },
        points=10, max_attempts=0,
    )
    guided = Activity.objects.create(
        lesson=lesson, type="guided_problem", title="GP", prompt="P",
        data={
            "steps": [
                {"prompt": "paso 1", "answer": "100", "hint": "ohm"},
                {"prompt": "paso 2", "answer": "200"},
            ],
            "finalAnswer": "300",
        },
        points=10, max_attempts=0,
    )
    self_assess = Activity.objects.create(
        lesson=lesson, type="self_assessment", title="SA", prompt="P",
        data={"prompt": "Reflexiona", "autoGradeKeywords": ["voltaje", "corriente"]},
        points=10, max_attempts=0,
    )
    draft_lesson = Lesson.objects.create(
        unit=unit, slug="draft", title="Borrador", order=2, is_published=False,
    )
    draft_activity = Activity.objects.create(
        lesson=draft_lesson, type="multiple_choice", title="Draft", prompt="P",
        data={"options": ["A", "B"], "correctIndex": 1},
        points=10, max_attempts=0,
    )
    return unit, lesson, mcq, guided, self_assess, draft_activity


@pytest.mark.django_db
class TestLessonDataSanitization:
    def test_mcq_hides_correct_index_and_explanation(self, client, curriculum):
        _, lesson, mcq, *_ = curriculum
        res = client.get(f"/api/lessons/{lesson.id}")
        assert res.status_code == 200
        data = next(a for a in res.data["lesson"]["activities"] if a["id"] == mcq.id)["data"]
        assert "correctIndex" not in data
        assert "explanation" not in data
        # Las claves de presentación se conservan
        assert data["options"] == ["A", "B"]
        assert data["hints"] == ["Piensa en A"]

    def test_guided_problem_hides_step_answers(self, client, curriculum):
        _, lesson, _, guided, *_ = curriculum
        res = client.get(f"/api/lessons/{lesson.id}")
        data = next(a for a in res.data["lesson"]["activities"] if a["id"] == guided.id)["data"]
        assert "finalAnswer" not in data
        assert all("answer" not in step for step in data["steps"])
        assert data["steps"][0]["prompt"] == "paso 1"

    def test_self_assessment_hides_keywords(self, client, curriculum):
        _, lesson, _, _, self_assess, _ = curriculum
        res = client.get(f"/api/lessons/{lesson.id}")
        data = next(a for a in res.data["lesson"]["activities"] if a["id"] == self_assess.id)["data"]
        assert "autoGradeKeywords" not in data

    def test_attempt_response_includes_full_review_data(self, client, curriculum):
        _, _, mcq, *_ = curriculum
        res = client.post(f"/api/activities/{mcq.id}/attempt", {"answer": "1"}, format="json")
        assert res.status_code == 200
        review = res.data["attempt"]["reviewData"]
        assert review["correctIndex"] == 0
        assert review["explanation"] == "Porque sí"

    def test_attempt_on_draft_lesson_is_404(self, client, curriculum):
        *_, draft_activity = curriculum
        res = client.post(
            f"/api/activities/{draft_activity.id}/attempt", {"answer": "1"}, format="json"
        )
        assert res.status_code == 404


@pytest.mark.django_db
class TestSearchHidesDrafts:
    def test_student_does_not_find_drafts(self, client, curriculum):
        res = client.get("/api/search?q=Borrador")
        assert res.status_code == 200
        assert res.data["results"]["lessons"] == []
        res = client.get("/api/search?q=Draft")
        assert res.data["results"]["activities"] == []

    def test_teacher_finds_drafts(self, teacher, curriculum):
        c = APIClient()
        c.force_authenticate(user=teacher)
        res = c.get("/api/search?q=Borrador")
        assert len(res.data["results"]["lessons"]) == 1
        res = c.get("/api/search?q=Draft")
        assert len(res.data["results"]["activities"]) == 1


@pytest.mark.django_db
class TestLoginAuditAndThrottle:
    def test_failed_login_is_audited(self):
        res = APIClient().post(
            "/api/auth/login",
            {"identifier": "EM-9001", "password": "mala"},
            format="json",
        )
        assert res.status_code == 400
        entry = AuditLog.objects.get(event_type="login_failed")
        assert entry.target == "EM-9001"

    def test_successful_login_is_audited(self, student):
        res = APIClient().post(
            "/api/auth/login",
            {"identifier": "EM-9001", "password": "Xa123456"},
            format="json",
        )
        assert res.status_code == 200
        entry = AuditLog.objects.get(event_type="login_success")
        assert entry.actor == student

    def test_login_throttle_configured(self):
        from accounts.views import LoginView
        from django.conf import settings

        assert LoginView.throttle_scope == "login"
        assert "login" in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]


@pytest.mark.django_db
class TestLeaderboardPrivacy:
    def test_student_sees_peers_anonymized(self, client, student):
        User.objects.create_user(
            username="o", email="o@uv.cl", password="X", role=User.ROLE_STUDENT,
            student_code="EM-9002", name="EM-9002",
        )
        res = client.get("/api/leaderboard")
        assert res.status_code == 200
        rows = res.data["leaderboard"]
        assert all("email" not in r for r in rows)
        other = next(r for r in rows if r["id"] != student.id)
        mine = next(r for r in rows if r["id"] == student.id)
        assert other["name"] == "Participante anónimo"
        assert other["avatar"] is None
        assert mine["name"] == student.name

    def test_teacher_sees_real_codes(self, teacher, student):
        c = APIClient()
        c.force_authenticate(user=teacher)
        res = c.get("/api/leaderboard")
        mine = next(r for r in res.data["leaderboard"] if r["id"] == student.id)
        assert mine["name"] == student.name


@pytest.mark.django_db
class TestHeartbeatOwnership:
    def test_cannot_heartbeat_someone_elses_session(self, client, student):
        other = User.objects.create_user(
            username="o", email="o@uv.cl", password="X", role=User.ROLE_STUDENT,
        )
        session = StudySession.objects.create(
            user=other, started_at=timezone.now(), is_active=True,
            last_heartbeat_at=timezone.now(),
        )
        res = client.post(
            "/api/telemetry/session/heartbeat", {"sessionId": session.id}, format="json"
        )
        assert res.status_code == 404

    def test_own_session_heartbeats(self, client, student):
        session = StudySession.objects.create(
            user=student, started_at=timezone.now(), is_active=True,
            last_heartbeat_at=timezone.now(),
        )
        res = client.post(
            "/api/telemetry/session/heartbeat", {"sessionId": session.id}, format="json"
        )
        assert res.status_code == 200


@pytest.mark.django_db
class TestDataExport:
    def test_export_contains_own_data(self, client, student, curriculum):
        _, _, mcq, *_ = curriculum
        client.post(f"/api/activities/{mcq.id}/attempt", {"answer": "0"}, format="json")
        res = client.get("/api/me/data")
        assert res.status_code == 200
        assert res.data["profile"]["studentCode"] == "EM-9001"
        assert len(res.data["attempts"]) == 1
        assert res.data["attempts"][0]["activityId"] == mcq.id
        assert "telemetry" in res.data

    def test_export_requires_auth(self):
        assert APIClient().get("/api/me/data").status_code in (401, 403)


@pytest.mark.django_db
class TestPurgeTelemetry:
    def test_purge_deletes_only_old_records(self, student):
        old = timezone.now() - timedelta(days=400)
        fresh = timezone.now() - timedelta(days=10)
        old_log = AccessLog.objects.create(user=student, path="/api/old", method="GET")
        fresh_log = AccessLog.objects.create(user=student, path="/api/new", method="GET")
        # auto_now_add pisa created_at al crear: ajustar con update directo
        AccessLog.objects.filter(pk=old_log.pk).update(created_at=old)
        AccessLog.objects.filter(pk=fresh_log.pk).update(created_at=fresh)

        call_command("purge_telemetry")
        assert not AccessLog.objects.filter(pk=old_log.pk).exists()
        assert AccessLog.objects.filter(pk=fresh_log.pk).exists()

    def test_dry_run_keeps_everything(self, student):
        old = timezone.now() - timedelta(days=400)
        log = AccessLog.objects.create(user=student, path="/api/old", method="GET")
        AccessLog.objects.filter(pk=log.pk).update(created_at=old)
        call_command("purge_telemetry", dry_run=True)
        assert AccessLog.objects.filter(pk=log.pk).exists()
