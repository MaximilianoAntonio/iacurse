"""
Tests de streak — reproduce los 3 branches del TS original.

- nunca activo          → streak = 1
- última = ayer         → streak += 1
- última < ayer (gap)   → streak = 1
- última = hoy          → sin cambios
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from learning.streak import update_streak

User = get_user_model()


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT, streak=5
    )


@pytest.mark.django_db
class TestStreakNeverActive:
    def test_streak_becomes_1(self, student):
        """Sin last_active → streak = 1."""
        assert student.last_active is None
        result = update_streak(student)
        assert result == 1
        student.refresh_from_db()
        assert student.streak == 1


@pytest.mark.django_db
class TestStreakYesterday:
    def test_streak_increments(self, student):
        """last_active = ayer → streak += 1 (consecutivo)."""
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        # Mover a medianoche de ayer
        from learning.streak import _local_midnight
        from datetime import timedelta as td

        student.last_active = _local_midnight(yesterday) + td(hours=10)
        student.save()

        result = update_streak(student)
        assert result == 6  # 5 + 1
        student.refresh_from_db()
        assert student.streak == 6


@pytest.mark.django_db
class TestStreakGap:
    def test_streak_resets_to_1(self, student):
        """last_active < ayer (gap 2+ días) → streak = 1."""
        from learning.streak import _local_midnight
        from datetime import timedelta as td

        now = timezone.now()
        three_days_ago = now - timedelta(days=3)
        student.last_active = _local_midnight(three_days_ago) + td(hours=5)
        student.save()

        result = update_streak(student)
        assert result == 1
        student.refresh_from_db()
        assert student.streak == 1


@pytest.mark.django_db
class TestStreakToday:
    def test_streak_unchanged(self, student):
        """last_active = hoy → sin cambios (no escribe)."""
        from learning.streak import _local_midnight
        from datetime import timedelta as td

        now = timezone.now()
        student.last_active = _local_midnight(now) + td(hours=2)
        student.streak = 5
        student.save()

        result = update_streak(student)
        assert result == 5  # sin cambios
        student.refresh_from_db()
        assert student.streak == 5
