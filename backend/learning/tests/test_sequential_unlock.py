"""
Tests del desbloqueo secuencial de unidades (CourseConfig.sequential_unlock).

Cubre:
- learning/services.py: completed_unit_ids / locked_unit_ids / is_unit_unlocked
  (primera unidad siempre desbloqueada, cadena por orden, unidades sin
  actividades no bloquean, docente nunca bloqueado, flag apagado → sin bloqueos).
- Flag ``locked`` por unidad en GET /api/units.
- Gates 403 ``unit_locked``: GET/POST /api/units/<id>, GET /api/lessons/<id>
  y POST /api/activities/<id>/attempt.
- Admin settings: GET/PATCH /api/admin/course/settings (403 estudiante,
  validación booleana, auditoría course_config_changed).
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, CourseConfig, Lesson, Unit
from learning.models import Progress
from learning.services import (
    completed_unit_ids,
    is_unit_unlocked,
    locked_unit_ids,
)
from telemetry.models import AuditLog

User = get_user_model()

MCQ = {"options": ["A", "B"], "correctIndex": 0}


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
        student_code="EM-9002",
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


@pytest.fixture
def units(db):
    """Tres unidades ordenadas: u1 con 2 actividades, u2 con 1, u3 sin."""
    u1 = Unit.objects.create(slug="u1", title="Unidad 1", order=1)
    l1 = Lesson.objects.create(unit=u1, slug="l1", title="Lección 1", order=1)
    a1 = Activity.objects.create(
        lesson=l1, type="multiple_choice", title="Act 1", prompt="P", data=MCQ, points=10,
    )
    a2 = Activity.objects.create(
        lesson=l1, type="multiple_choice", title="Act 2", prompt="P", data=MCQ, points=10,
    )
    u2 = Unit.objects.create(slug="u2", title="Unidad 2", order=2)
    l2 = Lesson.objects.create(unit=u2, slug="l2", title="Lección 2", order=1)
    a3 = Activity.objects.create(
        lesson=l2, type="multiple_choice", title="Act 3", prompt="P", data=MCQ, points=10,
    )
    u3 = Unit.objects.create(slug="u3", title="Unidad 3", order=3)
    return u1, u2, u3, l1, l2, a1, a2, a3


def _complete(user, unit, n):
    """Marca la unidad como completada vía Progress (completed == total)."""
    Progress.objects.update_or_create(
        user=user, unit=unit, defaults={"completed": n, "total": n}
    )


@pytest.mark.django_db
class TestSequentialUnlockService:
    def test_first_incomplete_unit_unlocked_rest_locked(self, student, units):
        u1, u2, u3 = units[0], units[1], units[2]
        assert locked_unit_ids(student) == {u2.id, u3.id}
        assert is_unit_unlocked(student, u1) is True
        assert is_unit_unlocked(student, u2) is False

    def test_completing_unlocks_next_only(self, student, units):
        u1, u2, u3 = units[0], units[1], units[2]
        _complete(student, u1, 2)
        # u2 pasa a ser la unidad "actual"; u3 queda tras la primera incompleta.
        assert locked_unit_ids(student) == {u3.id}
        # u3 no tiene actividades: cuenta como completada por diseño.
        assert completed_unit_ids(student) == {u1.id, u3.id}

    def test_unit_without_activities_counts_as_completed(self, student, units):
        """Una unidad sin actividades publicadas no puede bloquear el avance."""
        u1, u2, u3 = units[0], units[1], units[2]
        _complete(student, u1, 2)
        _complete(student, u2, 1)
        # u3 no tiene actividades: todo desbloqueado.
        assert locked_unit_ids(student) == set()
        assert u3.id in completed_unit_ids(student)

    def test_teacher_never_locked(self, teacher, units):
        assert locked_unit_ids(teacher) == set()

    def test_flag_disabled_unlocks_everything(self, student, units):
        config = CourseConfig.load()
        config.sequential_unlock = False
        config.save(update_fields=["sequential_unlock"])
        assert locked_unit_ids(student) == set()


@pytest.mark.django_db
class TestUnitsListLockedFlag:
    def test_locked_flag_per_unit(self, student_client, units):
        body = student_client.get("/api/units").json()
        locked_by_slug = {u["slug"]: u["locked"] for u in body["units"]}
        assert locked_by_slug == {"u1": False, "u2": True, "u3": True}

    def test_teacher_sees_nothing_locked(self, teacher_client, units):
        body = teacher_client.get("/api/units").json()
        assert all(u["locked"] is False for u in body["units"])


@pytest.mark.django_db
class TestLockedGates:
    def test_unit_detail_403_when_locked(self, student_client, units):
        u1, u2 = units[0], units[1]
        assert student_client.get(f"/api/units/{u2.id}").status_code == 403
        assert student_client.get(f"/api/units/{u2.slug}").status_code == 403
        resp = student_client.get(f"/api/units/{u2.id}")
        assert resp.json()["code"] == "unit_locked"
        # La unidad actual (primera incompleta) sigue accesible.
        assert student_client.get(f"/api/units/{u1.id}").status_code == 200

    def test_unit_detail_unlocks_after_completing_previous(self, student_client, student, units):
        u1, u2 = units[0], units[1]
        _complete(student, u1, 2)
        assert student_client.get(f"/api/units/{u2.id}").status_code == 200

    def test_unit_detail_teacher_bypasses_gate(self, teacher_client, units):
        assert teacher_client.get(f"/api/units/{units[1].id}").status_code == 200

    def test_post_adapt_skip_403_when_locked(self, student_client, units):
        u2 = units[1]
        for action in ("adapt", "skip"):
            resp = student_client.post(f"/api/units/{u2.id}", {"action": action}, format="json")
            assert resp.status_code == 403
            assert resp.json()["code"] == "unit_locked"

    def test_lesson_detail_403_when_unit_locked(self, student_client, units):
        l1, l2 = units[3], units[4]
        assert student_client.get(f"/api/lessons/{l2.id}").status_code == 403
        assert student_client.get(f"/api/lessons/{l1.id}").status_code == 200

    def test_attempt_403_when_unit_locked(self, student_client, student, units):
        a1, a3 = units[5], units[7]
        resp = student_client.post(
            f"/api/activities/{a3.id}/attempt", {"answer": "0"}, format="json"
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "unit_locked"
        # La actividad de la unidad actual sí se puede responder.
        resp = student_client.post(
            f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json"
        )
        assert resp.status_code == 200
        # Y al completar u1 vía attempts reales, u2 se desbloquea.
        a2 = units[6]
        student_client.post(f"/api/activities/{a2.id}/attempt", {"answer": "0"}, format="json")
        resp = student_client.post(
            f"/api/activities/{a3.id}/attempt", {"answer": "0"}, format="json"
        )
        assert resp.status_code == 200


@pytest.mark.django_db
class TestSearchExcludesLockedUnits:
    def test_locked_units_hidden_from_students(self, student_client, units):
        body = student_client.get("/api/search?q=Unidad").json()
        slugs = {u["slug"] for u in body["results"]["units"]}
        assert slugs == {"u1"}
        # Las lecciones/actividades de unidades bloqueadas tampoco aparecen.
        lesson_titles = {l["title"] for l in student_client.get("/api/search?q=Lección").json()["results"]["lessons"]}
        assert lesson_titles == {"Lección 1"}
        acts = {a["title"] for a in student_client.get("/api/search?q=Act").json()["results"]["activities"]}
        assert acts == {"Act 1", "Act 2"}

    def test_teacher_search_sees_everything(self, teacher_client, units):
        body = teacher_client.get("/api/search?q=Unidad").json()
        assert {u["slug"] for u in body["results"]["units"]} == {"u1", "u2", "u3"}


@pytest.mark.django_db
class TestAdminCourseSettings:
    def test_student_forbidden(self, student_client):
        assert student_client.get("/api/admin/course/settings").status_code == 403
        resp = student_client.patch(
            "/api/admin/course/settings", {"sequentialUnlock": False}, format="json"
        )
        assert resp.status_code == 403

    def test_get_returns_default_true(self, teacher_client):
        body = teacher_client.get("/api/admin/course/settings").json()
        assert body == {"sequentialUnlock": True}

    def test_patch_toggles_and_audits(self, teacher_client):
        resp = teacher_client.patch(
            "/api/admin/course/settings", {"sequentialUnlock": False}, format="json"
        )
        assert resp.status_code == 200
        assert CourseConfig.load().sequential_unlock is False
        event = AuditLog.objects.filter(event_type="course_config_changed").latest("created_at")
        assert event.target == "sequential_unlock"
        assert event.metadata["sequentialUnlock"] is False

    def test_patch_requires_boolean(self, teacher_client):
        resp = teacher_client.patch(
            "/api/admin/course/settings", {"sequentialUnlock": "si"}, format="json"
        )
        assert resp.status_code == 400
        assert CourseConfig.load().sequential_unlock is True
