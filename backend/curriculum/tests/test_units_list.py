"""
Tests de GET /api/units y /api/units/<slug> — conteos de actividades.

El total de actividades de una unidad debe considerar solo lecciones
publicadas: las actividades de borradores no son visibles ni completables
por el estudiante, por lo que no deben inflar `activityCount` ni
`progress.total` (regla ya aplicada por `all_units_completed`).
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
    """Unidad con 2 actividades publicadas y 3 en un borrador."""
    unit = Unit.objects.create(slug="u1", title="Bioseñales", order=1)
    published = Lesson.objects.create(unit=unit, slug="l1", title="L1", order=1)
    draft = Lesson.objects.create(
        unit=unit, slug="draft", title="Borrador", order=2, is_published=False,
    )
    for i in range(2):
        Activity.objects.create(
            lesson=published, type="multiple_choice", title=f"A{i}", prompt="p",
        )
    for i in range(3):
        Activity.objects.create(
            lesson=draft, type="multiple_choice", title=f"D{i}", prompt="p",
        )
    return unit


@pytest.mark.django_db
class TestUnitsActivityCounts:
    def test_units_list_excludes_draft_activities(self, student_client, unit_with_draft):
        res = student_client.get("/api/units")
        assert res.status_code == 200
        u = res.data["units"][0]
        assert u["lessonCount"] == 1
        assert u["activityCount"] == 2
        assert u["progress"]["total"] == 2

    def test_unit_detail_excludes_draft_activities(self, student_client, unit_with_draft):
        res = student_client.get("/api/units/u1")
        assert res.status_code == 200
        assert res.data["progress"]["total"] == 2
