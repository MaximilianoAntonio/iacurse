"""
Tests de GET /api/search — búsqueda global.

Los borradores del docente (lecciones con is_published=False) no deben
aparecer en los resultados de estudiantes: ni como lección ni vía sus
actividades (coherente con /api/units/<id> y /api/lessons/<id>).
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, Lesson, Unit

User = get_user_model()


@pytest.fixture
def student_client(db):
    student = User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
        student_code="EM-9001",
    )
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.fixture
def unit_with_draft(db):
    """Unidad con una lección publicada y un borrador, ambos con actividades."""
    unit = Unit.objects.create(slug="u1", title="Bioseñales", order=1)
    published = Lesson.objects.create(
        unit=unit, slug="l1", title="Electrocardiografía", order=1,
    )
    draft = Lesson.objects.create(
        unit=unit, slug="draft", title="Electrocardiografía avanzada",
        order=2, is_published=False,
    )
    Activity.objects.create(
        lesson=published, type="multiple_choice", title="ECG básico", prompt="p",
    )
    Activity.objects.create(
        lesson=draft, type="multiple_choice", title="ECG de borrador", prompt="p",
    )
    return unit


@pytest.mark.django_db
class TestSearchDrafts:
    def test_draft_lesson_not_in_results(self, student_client, unit_with_draft):
        res = student_client.get("/api/search?q=Electrocardiografía")
        assert res.status_code == 200
        titles = [l["title"] for l in res.data["results"]["lessons"]]
        assert "Electrocardiografía" in titles
        assert "Electrocardiografía avanzada" not in titles

    def test_draft_activities_not_in_results(self, student_client, unit_with_draft):
        res = student_client.get("/api/search?q=ECG")
        assert res.status_code == 200
        titles = [a["title"] for a in res.data["results"]["activities"]]
        assert "ECG básico" in titles
        assert "ECG de borrador" not in titles
