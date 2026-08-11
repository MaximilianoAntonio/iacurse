"""
Tests de GET /api/lessons/<id> — detalle de lección.

Cubre el campo siblingLessons (lecciones hermanas de la misma unidad,
publicadas y ordenadas) que usa el frontend para la navegación
anterior/siguiente entre lecciones.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Lesson, Unit

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
        student_code="EM-9001",
    )


@pytest.fixture
def student_client(student):
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.fixture
def unit_with_lessons(db):
    """Unidad con tres lecciones publicadas y un borrador (no visible)."""
    unit = Unit.objects.create(slug="u1", title="Bioseñales", order=1)
    Lesson.objects.create(unit=unit, slug="l1", title="Lección 1", order=1)
    Lesson.objects.create(unit=unit, slug="l2", title="Lección 2", order=2)
    Lesson.objects.create(unit=unit, slug="l3", title="Lección 3", order=3)
    Lesson.objects.create(unit=unit, slug="draft", title="Borrador", order=4, is_published=False)
    return unit


@pytest.mark.django_db
class TestLessonDetailSiblings:
    def test_includes_sibling_lessons_ordered(self, student_client, unit_with_lessons):
        lesson = Lesson.objects.get(slug="l2")
        res = student_client.get(f"/api/lessons/{lesson.id}")
        assert res.status_code == 200
        siblings = res.data["siblingLessons"]
        assert [s["title"] for s in siblings] == ["Lección 1", "Lección 2", "Lección 3"]
        assert [s["order"] for s in siblings] == [1, 2, 3]
        # El borrador del docente no aparece entre las hermanas
        assert all(s["slug"] != "draft" for s in siblings)

    def test_sibling_shape(self, student_client, unit_with_lessons):
        lesson = Lesson.objects.get(slug="l1")
        res = student_client.get(f"/api/lessons/{lesson.id}")
        assert res.status_code == 200
        sibling = res.data["siblingLessons"][0]
        assert set(sibling.keys()) == {"id", "slug", "title", "order", "durationMin"}
        assert sibling["id"] == lesson.id

    def test_draft_lesson_not_found(self, student_client, unit_with_lessons):
        draft = Lesson.objects.get(slug="draft")
        res = student_client.get(f"/api/lessons/{draft.id}")
        assert res.status_code == 404

    def test_requires_auth(self, unit_with_lessons):
        lesson = Lesson.objects.get(slug="l1")
        res = APIClient().get(f"/api/lessons/{lesson.id}")
        assert res.status_code in (401, 403)
