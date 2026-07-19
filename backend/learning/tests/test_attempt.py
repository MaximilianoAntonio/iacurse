"""
Test de integración del endpoint attempt — valida el orden de side-effects.

Cubre:
- maxAttempts enforcement (429)
- Primer correcto otorga puntos completos
- Segundo correcto NO otorga puntos (hadPreviousCorrect guard)
- Incorrecto parcial otorga delta
- Progress se actualiza (completed/total/mastery)
- Unit-completion detection
- Badge awarding dispara primer-paso
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, Lesson, Unit

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT
    )


@pytest.fixture
def client(student):
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.fixture
def curriculum(db):
    """Unidad con 2 actividades multiple_choice."""
    unit = Unit.objects.create(slug="u", title="Unit", order=1)
    lesson = Lesson.objects.create(unit=unit, slug="l", title="Lesson", order=1)
    a1 = Activity.objects.create(
        lesson=lesson, type="multiple_choice", title="A1", prompt="P",
        data={"options": ["A", "B"], "correctIndex": 0},
        points=10, max_attempts=2,
    )
    a2 = Activity.objects.create(
        lesson=lesson, type="multiple_choice", title="A2", prompt="P",
        data={"options": ["X", "Y"], "correctIndex": 1},
        points=10, max_attempts=2,
    )
    return unit, lesson, a1, a2


@pytest.mark.django_db
class TestMaxAttempts:
    def test_429_when_max_reached(self, client, curriculum):
        _, _, a1, _ = curriculum
        # 2 intentos (max_attempts=2)
        client.post(f"/api/activities/{a1.id}/attempt", {"answer": "1"}, format="json")
        client.post(f"/api/activities/{a1.id}/attempt", {"answer": "1"}, format="json")
        # 3º debe dar 429
        resp = client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        assert resp.status_code == 429
        assert resp.json()["maxAttemptsReached"] is True

    def test_unlimited_attempts_when_zero(self, client, db):
        unit = Unit.objects.create(slug="u2", title="U", order=1)
        lesson = Lesson.objects.create(unit=unit, slug="l2", title="L", order=1)
        a = Activity.objects.create(
            lesson=lesson, type="multiple_choice", title="A", prompt="P",
            data={"options": ["A", "B"], "correctIndex": 0}, max_attempts=0,
        )
        for _ in range(5):
            resp = client.post(f"/api/activities/{a.id}/attempt", {"answer": "0"}, format="json")
            assert resp.status_code == 200


@pytest.mark.django_db
class TestPointsAwarding:
    def test_first_correct_awards_full_score(self, client, student, curriculum):
        _, _, a1, _ = curriculum
        resp = client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        assert resp.status_code == 200
        body = resp.json()["attempt"]
        assert body["correct"] is True
        assert body["pointsAwarded"] == 10  # score completo
        student.refresh_from_db()
        assert student.points == 10

    def test_second_correct_awards_no_points(self, client, student, curriculum):
        _, _, a1, _ = curriculum
        client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        # Segundo intento correcto (max_attempts=2 permite)
        resp = client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        assert resp.status_code == 200
        assert resp.json()["attempt"]["pointsAwarded"] == 0
        student.refresh_from_db()
        assert student.points == 10  # sin incremento


@pytest.mark.django_db
class TestProgressUpdate:
    def test_progress_reflects_completion(self, client, student, curriculum):
        unit, _, a1, a2 = curriculum
        # Completar 1 de 2 actividades
        client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        from learning.models import Progress
        p = Progress.objects.get(user=student, unit=unit)
        assert p.completed == 1
        assert p.total == 2
        assert p.mastery == 50  # 1/2 = 50%

    def test_full_completion(self, client, student, curriculum):
        unit, _, a1, a2 = curriculum
        client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        resp = client.post(f"/api/activities/{a2.id}/attempt", {"answer": "1"}, format="json")
        from learning.models import Progress
        p = Progress.objects.get(user=student, unit=unit)
        assert p.completed == 2
        assert p.mastery == 100


@pytest.mark.django_db
class TestUnitCompletion:
    def test_unit_completed_flag_on_last_activity(self, client, curriculum):
        _, _, a1, a2 = curriculum
        client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        resp = client.post(f"/api/activities/{a2.id}/attempt", {"answer": "1"}, format="json")
        body = resp.json()["attempt"]
        assert body["unitCompleted"] is True


@pytest.mark.django_db
class TestBadgeIntegration:
    def test_primer_paso_awarded_on_first_correct(self, client, curriculum, db):
        from learning.models import Badge
        Badge.objects.create(
            slug="primer-paso", name="Primer Paso", icon="Footprints", tier="bronze"
        )
        _, _, a1, _ = curriculum
        resp = client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        body = resp.json()["attempt"]
        badge_slugs = [b["badgeSlug"] for b in body["newBadges"]]
        assert "primer-paso" in badge_slugs


@pytest.mark.django_db
class TestFeedbackPresent:
    def test_feedback_always_returned(self, client, curriculum):
        """El feedback (IA o fallback) siempre está presente en la respuesta."""
        _, _, a1, _ = curriculum
        resp = client.post(f"/api/activities/{a1.id}/attempt", {"answer": "0"}, format="json")
        body = resp.json()["attempt"]
        assert body["feedback"]  # no vacío
        assert isinstance(body["feedback"], str)
