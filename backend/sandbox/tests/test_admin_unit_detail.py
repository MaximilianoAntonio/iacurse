"""Tests del detalle admin de unidad y del PATCH de objetivos (Course Builder).

Cubre las roturas de contrato corregidas:
- GET /api/admin/units/<id>: las actividades incluyen todos los campos que el
  editor del frontend espera (data como string JSON, metadatos de evaluación
  y objectiveIds) — antes faltaban y la edición de actividades fallaba.
- PATCH /api/admin/objectives: los nombres camelCase de la API se traducen a
  los campos del modelo (bloom_level, lesson_id) — antes lanzaba FieldError.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, LearningObjective, Lesson, Unit

User = get_user_model()


@pytest.fixture
def teacher_client(db):
    teacher = User.objects.create_user(
        username="t", email="t@uv.cl", password="X", role=User.ROLE_TEACHER
    )
    client = APIClient()
    client.force_authenticate(user=teacher)
    return client


@pytest.fixture
def activity(db):
    unit = Unit.objects.create(slug="u1", title="U1", order=0)
    lesson = Lesson.objects.create(unit=unit, slug="l1", title="L1", order=0)
    return Activity.objects.create(
        lesson=lesson,
        type="multiple_choice",
        title="A1",
        prompt="P",
        data={"question": "q", "options": ["a", "b"], "correctIndex": 0},
    )


@pytest.mark.django_db
class TestAdminUnitDetail:
    def test_activity_fields_complete(self, teacher_client, activity):
        objective = LearningObjective.objects.create(
            unit=activity.lesson.unit, code="O1", description="d"
        )
        activity.objectives.get_or_create(objective_id=objective.id)

        resp = teacher_client.get(f"/api/admin/units/{activity.lesson.unit_id}")
        assert resp.status_code == 200
        act = resp.json()["unit"]["lessons"][0]["activities"][0]
        # El editor trabaja el JSON como string (pestaña "JSON" del diálogo).
        assert isinstance(act["data"], str)
        import json

        assert json.loads(act["data"])["correctIndex"] == 0
        assert act["objectiveIds"] == [objective.id]
        assert act["assessmentType"] == "formative"
        assert act["bloomLevel"] == "apply"
        assert act["maxAttempts"] == 3
        assert act["masteryThreshold"] == 70
        assert act["weight"] == 1
        assert act["timeLimitMin"] is None
        assert act["rubricId"] is None


@pytest.mark.django_db
class TestAdminObjectivesPatch:
    def test_patch_bloom_level(self, teacher_client, activity):
        objective = LearningObjective.objects.create(
            unit=activity.lesson.unit, code="O1", description="d"
        )
        resp = teacher_client.patch(
            "/api/admin/objectives",
            {"objectiveId": objective.id, "bloomLevel": "analyze", "description": "d2"},
            format="json",
        )
        assert resp.status_code == 200
        objective.refresh_from_db()
        assert objective.bloom_level == "analyze"
        assert objective.description == "d2"
