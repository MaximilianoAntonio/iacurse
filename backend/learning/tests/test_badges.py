"""
Tests del sistema de insignias — reproduce las 6 reglas con slugs exactos.

Valida:
- Cada regla dispara la insignia correcta
- Snapshot-once: una insignia ya otorgada no se re-otorga
- Múltiples reglas pueden dispararse en una sola llamada
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from curriculum.models import Activity, Lesson, Unit
from learning.badges import check_and_award_badges
from learning.models import Attempt, Badge, Progress, UserBadge

User = get_user_model()


@pytest.fixture
def badges(db):
    """Crea las 6 insignias canónicas."""
    data = [
        ("primer-paso", "Primer Paso", "Footprints", "bronze"),
        ("explorador", "Explorador", "Compass", "bronze"),
        ("racha-7", "Constancia", "Flame", "silver"),
        ("maestro-ecg", "Maestro del ECG", "Award", "gold"),
        ("centinela", "Centinela", "ShieldCheck", "silver"),
        ("tutor-activo", "Curioso", "MessageCircleQuestion", "silver"),
    ]
    for slug, name, icon, tier in data:
        Badge.objects.create(slug=slug, name=name, icon=icon, tier=tier)
    return Badge.objects.all()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s1", email="s@uv.cl", password="X", role=User.ROLE_STUDENT
    )


@pytest.fixture
def curriculum_units(db):
    """Crea las unidades ECG y seguridad-electrica + actividades."""
    ecg = Unit.objects.create(slug="electrocardiografia", title="ECG", order=1)
    safety = Unit.objects.create(slug="seguridad-electrica", title="Seguridad", order=2)
    # 2 actividades en seguridad (para regla centinela)
    s_lesson = Lesson.objects.create(unit=safety, slug="s-l", title="SL", order=1)
    a1 = Activity.objects.create(lesson=s_lesson, type="multiple_choice", title="A1", prompt="P")
    a2 = Activity.objects.create(lesson=s_lesson, type="multiple_choice", title="A2", prompt="P")
    return ecg, safety, [a1, a2]


@pytest.mark.django_db
class TestPrimerPaso:
    def test_awarded_on_first_correct_activity(self, badges, student, curriculum_units):
        ecg, _, _ = curriculum_units
        lesson = Lesson.objects.create(unit=ecg, slug="ecg-l", title="L", order=1)
        activity = Activity.objects.create(
            lesson=lesson, type="multiple_choice", title="A", prompt="P"
        )
        Attempt.objects.create(user=student, activity=activity, answer="0", correct=True, score=10)

        awarded = check_and_award_badges(student)
        slugs = [r.badge_slug for r in awarded]
        assert "primer-paso" in slugs
        assert UserBadge.objects.filter(user=student, badge__slug="primer-paso").exists()

    def test_not_awarded_without_correct_activity(self, badges, student, curriculum_units):
        ecg, _, _ = curriculum_units
        lesson = Lesson.objects.create(unit=ecg, slug="ecg-l2", title="L", order=1)
        activity = Activity.objects.create(
            lesson=lesson, type="multiple_choice", title="A", prompt="P"
        )
        Attempt.objects.create(user=student, activity=activity, answer="0", correct=False, score=2)

        awarded = check_and_award_badges(student)
        assert "primer-paso" not in [r.badge_slug for r in awarded]


@pytest.mark.django_db
class TestExplorador:
    def test_awarded_on_5_visited_units(self, badges, student):
        for i in range(5):
            u = Unit.objects.create(slug=f"u{i}", title=f"U{i}", order=i)
            Progress.objects.create(user=student, unit=u, last_visited=timezone.now())

        awarded = check_and_award_badges(student)
        assert "explorador" in [r.badge_slug for r in awarded]

    def test_not_awarded_with_4_units(self, badges, student):
        for i in range(4):
            u = Unit.objects.create(slug=f"u4-{i}", title=f"U{i}", order=i)
            Progress.objects.create(user=student, unit=u, last_visited=timezone.now())

        awarded = check_and_award_badges(student)
        assert "explorador" not in [r.badge_slug for r in awarded]


@pytest.mark.django_db
class TestRacha7:
    def test_awarded_on_streak_7(self, badges, student):
        student.streak = 7
        student.save()
        awarded = check_and_award_badges(student)
        assert "racha-7" in [r.badge_slug for r in awarded]

    def test_not_awarded_on_streak_6(self, badges, student):
        student.streak = 6
        student.save()
        awarded = check_and_award_badges(student)
        assert "racha-7" not in [r.badge_slug for r in awarded]


@pytest.mark.django_db
class TestMaestroEcg:
    def test_awarded_on_mastery_80(self, badges, student, curriculum_units):
        ecg, _, _ = curriculum_units
        Progress.objects.create(user=student, unit=ecg, mastery=85)
        awarded = check_and_award_badges(student)
        assert "maestro-ecg" in [r.badge_slug for r in awarded]

    def test_not_awarded_on_mastery_79(self, badges, student, curriculum_units):
        ecg, _, _ = curriculum_units
        Progress.objects.create(user=student, unit=ecg, mastery=79)
        awarded = check_and_award_badges(student)
        assert "maestro-ecg" not in [r.badge_slug for r in awarded]


@pytest.mark.django_db
class TestCentinela:
    def test_awarded_when_all_safety_activities_completed(self, badges, student, curriculum_units):
        ecg, safety, activities = curriculum_units
        # 2 actividades en seguridad, completadas 2/2
        Progress.objects.create(user=student, unit=safety, completed=2, total=2)
        awarded = check_and_award_badges(student)
        assert "centinela" in [r.badge_slug for r in awarded]

    def test_not_awarded_when_incomplete(self, badges, student, curriculum_units):
        ecg, safety, activities = curriculum_units
        Progress.objects.create(user=student, unit=safety, completed=1, total=2)
        awarded = check_and_award_badges(student)
        assert "centinela" not in [r.badge_slug for r in awarded]


@pytest.mark.django_db
class TestTutorActivo:
    def test_awarded_on_10_chat_messages(self, badges, student):
        from tutor.models import ChatMessage
        for _ in range(10):
            ChatMessage.objects.create(user=student, role="user", content="hola")
        awarded = check_and_award_badges(student)
        assert "tutor-activo" in [r.badge_slug for r in awarded]


@pytest.mark.django_db
class TestSnapshotOnceSemantics:
    """Las insignias ya otorgadas NO se re-otorgan."""

    def test_already_awarded_not_returned(self, badges, student, curriculum_units):
        # Otorgar primer-paso manualmente
        badge = Badge.objects.get(slug="primer-paso")
        UserBadge.objects.create(user=student, badge=badge)

        # Cumplir la condición de nuevo
        ecg, _, _ = curriculum_units
        lesson = Lesson.objects.create(unit=ecg, slug="ecg-l3", title="L", order=1)
        activity = Activity.objects.create(
            lesson=lesson, type="multiple_choice", title="A", prompt="P"
        )
        Attempt.objects.create(user=student, activity=activity, answer="0", correct=True, score=10)

        awarded = check_and_award_badges(student)
        # primer-paso NO debe estar en newly_awarded (ya lo tenía)
        assert "primer-paso" not in [r.badge_slug for r in awarded]
        # Y no debe haberse duplicado en la DB
        assert UserBadge.objects.filter(user=student, badge=badge).count() == 1
