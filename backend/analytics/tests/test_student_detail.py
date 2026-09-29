"""
Tests de GET /api/teacher/student/<id> — detalle de estudiante (docente).

`stats.totalTimeMin` debe considerar TODAS las sesiones del estudiante;
la lista `sessions` se limita a las últimas 20 solo para el detalle.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import StudySession

User = get_user_model()


@pytest.fixture
def teacher_client(db):
    teacher = User.objects.create_user(
        username="t", email="t@uv.cl", password="X", role=User.ROLE_TEACHER,
    )
    c = APIClient()
    c.force_authenticate(user=teacher)
    return c


@pytest.mark.django_db
class TestStudentDetail:
    def test_total_time_uses_all_sessions(self, teacher_client):
        student = User.objects.create_user(
            username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
            student_code="EM-9001",
        )
        # 25 sesiones de 60 s: el total debe ser 25 min, no 20 (tope de la lista)
        for _ in range(25):
            StudySession.objects.create(user=student, duration=60)

        res = teacher_client.get(f"/api/teacher/student/{student.id}")
        assert res.status_code == 200
        assert len(res.data["sessions"]) == 20
        assert res.data["stats"]["totalTimeMin"] == 25

    def test_requires_teacher(self, db):
        student = User.objects.create_user(
            username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
            student_code="EM-9001",
        )
        c = APIClient()
        c.force_authenticate(user=student)
        res = c.get(f"/api/teacher/student/{student.id}")
        assert res.status_code in (401, 403)
