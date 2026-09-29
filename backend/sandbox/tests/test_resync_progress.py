"""
Tests del re-sync de Progress.total desde el Course Builder.

El total persistido debe contar solo actividades de lecciones publicadas:
las de borradores no son visibles ni completables por el estudiante, por lo
que incluirlas impediría llegar al 100% de la unidad.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, Lesson, Unit
from learning.models import Progress

User = get_user_model()


@pytest.fixture
def teacher_client(db):
    teacher = User.objects.create_user(
        username="t", email="t@uv.cl", password="X", role=User.ROLE_TEACHER
    )
    client = APIClient()
    client.force_authenticate(user=teacher)
    return client


@pytest.mark.django_db
class TestResyncProgressTotals:
    def test_resync_counts_only_published_lessons(self, teacher_client):
        student = User.objects.create_user(
            username="s", email="s@uv.cl", password="X",
            role=User.ROLE_STUDENT, student_code="EM-9001",
        )
        unit = Unit.objects.create(slug="u1", title="U1", order=0)
        published = Lesson.objects.create(unit=unit, slug="l1", title="L1", order=0)
        draft = Lesson.objects.create(
            unit=unit, slug="draft", title="Borrador", order=1, is_published=False,
        )
        Activity.objects.create(lesson=published, type="multiple_choice", title="A1", prompt="p")
        Activity.objects.create(lesson=draft, type="multiple_choice", title="D1", prompt="p")
        # Total desactualizado que incluía la actividad del borrador
        Progress.objects.create(user=student, unit=unit, completed=1, total=2)

        # Cualquier cambio de actividades dispara el re-sync
        resp = teacher_client.post("/api/admin/activities", {
            "lessonId": published.id, "type": "multiple_choice",
            "title": "A2", "prompt": "p", "data": {},
        }, format="json")
        assert resp.status_code == 201

        progress = Progress.objects.get(user=student, unit=unit)
        # 2 publicadas (A1 + A2 nueva); la del borrador no cuenta
        assert progress.total == 2
