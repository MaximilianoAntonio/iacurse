"""
Tests de GET /api/leaderboard — ranking de estudiantes por puntos.

Contrato: estudiantes anonimizados — la respuesta no expone email (placeholder
interno) ni avatar; el frontend solo usa rank/id/name/points/streak y
completedActivities (actividades distintas con intento correcto).
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, Lesson, Unit
from learning.models import Attempt

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s1", email="em-9001@students.local", password="X",
        role=User.ROLE_STUDENT, student_code="EM-9001", points=50,
    )


@pytest.fixture
def student_client(student):
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.mark.django_db
class TestLeaderboard:
    def test_response_shape_no_email_no_avatar(self, student_client, student):
        res = student_client.get("/api/leaderboard")
        assert res.status_code == 200
        entry = next(e for e in res.data["leaderboard"] if e["id"] == student.id)
        assert set(entry.keys()) == {
            "rank", "id", "name", "points", "streak", "completedActivities", "avatar",
        }
        assert "email" not in entry
        # El nombre visible cae al código de estudiante (anonimización)
        assert entry["name"] == student.name

    def test_completed_activities_counts_distinct_correct(self, student_client, student):
        unit = Unit.objects.create(slug="u1", title="U1", order=0)
        lesson = Lesson.objects.create(unit=unit, slug="l1", title="L1", order=0)
        a1 = Activity.objects.create(lesson=lesson, type="multiple_choice", title="A1", prompt="p")
        a2 = Activity.objects.create(lesson=lesson, type="multiple_choice", title="A2", prompt="p")
        # Dos correctos en la misma actividad cuentan una sola vez
        Attempt.objects.create(user=student, activity=a1, answer={}, correct=True, score=10)
        Attempt.objects.create(user=student, activity=a1, answer={}, correct=True, score=10)
        Attempt.objects.create(user=student, activity=a2, answer={}, correct=False, score=0)

        res = student_client.get("/api/leaderboard")
        entry = next(e for e in res.data["leaderboard"] if e["id"] == student.id)
        assert entry["completedActivities"] == 1

    def test_excludes_teachers(self, student_client, student, db):
        User.objects.create_user(
            username="t", email="t@uv.cl", password="X",
            role=User.ROLE_TEACHER, points=999,
        )
        res = student_client.get("/api/leaderboard")
        assert all(e["points"] != 999 for e in res.data["leaderboard"])
