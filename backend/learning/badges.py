"""
Sistema de insignias — reproducido fielmente desde src/lib/badges.ts.

5 reglas con slugs exactos (deben coincidir con fixtures/badges.json):
- primer-paso    : >=1 actividad correcta (distinct activityId)
- explorador     : >=5 unidades visitadas (Progress.last_visited not null)
- racha-7        : streak >= 7
- maestro-ecg    : mastery >= 80 en unidad slug 'electrocardiografia'
- centinela      : todas las actividades completadas en unidad slug
                   'seguridad-electrica' Y total > 0

Semántica snapshot-once: el snapshot de insignias existentes se toma al inicio
y NO se actualiza durante el loop (cada slug se otorga a lo más una vez).
"""
from dataclasses import dataclass
from typing import List

from django.db.models import Count, Q

from accounts.models import User
from .models import Badge, Progress, StudySession, UserBadge


# Slugs de unidades referenciados por las reglas (deben existir en el seed)
ECG_UNIT_SLUG = "electrocardiografia"
SAFETY_UNIT_SLUG = "seguridad-electrica"


@dataclass
class BadgeAwardResult:
    """Equivalente a BadgeAwardResult de TS."""

    badge_slug: str
    badge_name: str
    badge_icon: str
    badge_tier: str
    newly_awarded: bool = True

    def to_dict(self) -> dict:
        return {
            "badgeSlug": self.badge_slug,
            "badgeName": self.badge_name,
            "badgeIcon": self.badge_icon,
            "badgeTier": self.badge_tier,
            "newlyAwarded": self.newly_awarded,
        }


def _award_if_missing(
    slug: str,
    condition: bool,
    badge_by_slug: dict,
    existing_badge_ids: set,
    user_id: str,
    newly_awarded: list,
) -> None:
    """Otorga la insignia si la condición se cumple y no se tenía ya.

    Snapshot-once: NO muta existing_badge_ids (parity con badges.ts).
    """
    if not condition:
        return
    badge = badge_by_slug.get(slug)
    if badge is None or badge.id in existing_badge_ids:
        return
    UserBadge.objects.create(user_id=user_id, badge_id=badge.id)
    newly_awarded.append(
        BadgeAwardResult(
            badge_slug=slug,
            badge_name=badge.name,
            badge_icon=badge.icon,
            badge_tier=badge.tier,
        )
    )


def check_and_award_badges(user: User) -> List[BadgeAwardResult]:
    """Evalúa las 5 reglas y otorga las insignias nuevas.

    Devuelve solo las NUEVAMENTE otorgadas (para celebración UI).
    """
    # --- Step A: cargar datos de referencia ---
    all_badges = Badge.objects.all()
    badge_by_slug = {b.slug: b for b in all_badges}
    if not badge_by_slug:
        return []

    existing_badge_ids = set(
        UserBadge.objects.filter(user=user).values_list("badge_id", flat=True)
    )

    # --- Step B: estadísticas del usuario ---
    # distinct activityId entre intentos correctos
    total_correct_activities = (
        user.attempts.filter(correct=True).values("activity_id").distinct().count()
    )

    progress_rows = list(
        Progress.objects.filter(user=user).select_related("unit")
    )
    visited_units = sum(1 for p in progress_rows if p.last_visited is not None)

    user_fresh = User.objects.filter(pk=user.pk).values("streak").first()
    user_streak = user_fresh["streak"] if user_fresh else 0

    # --- Step C: aplicar reglas (snapshot-once) ---
    newly_awarded: list[BadgeAwardResult] = []

    # Regla 1: primer-paso (>=1 actividad correcta)
    _award_if_missing(
        "primer-paso", total_correct_activities >= 1,
        badge_by_slug, existing_badge_ids, user.id, newly_awarded,
    )

    # Regla 2: explorador (>=5 unidades visitadas)
    _award_if_missing(
        "explorador", visited_units >= 5,
        badge_by_slug, existing_badge_ids, user.id, newly_awarded,
    )

    # Regla 3: racha-7 (streak >= 7)
    _award_if_missing(
        "racha-7", user_streak >= 7,
        badge_by_slug, existing_badge_ids, user.id, newly_awarded,
    )

    # Regla 4: maestro-ecg (mastery >= 80 en unidad 'electrocardiografia')
    ecg_progress = next(
        (p for p in progress_rows if p.unit.slug == ECG_UNIT_SLUG), None
    )
    ecg_mastery = ecg_progress.mastery if ecg_progress else 0
    _award_if_missing(
        "maestro-ecg", ecg_mastery >= 80,
        badge_by_slug, existing_badge_ids, user.id, newly_awarded,
    )

    # Regla 5: centinela (todas las actividades completadas en 'seguridad-electrica')
    from curriculum.models import Activity, Unit

    safety_unit = Unit.objects.filter(slug=SAFETY_UNIT_SLUG).first()
    safety_total = 0
    if safety_unit:
        safety_total = Activity.objects.filter(lesson__unit=safety_unit).count()
    safety_progress = next(
        (p for p in progress_rows if p.unit.slug == SAFETY_UNIT_SLUG), None
    )
    safety_completed = safety_progress.completed if safety_progress else 0
    centinela_cond = (
        safety_progress is not None
        and safety_total > 0
        and safety_completed >= safety_total
    )
    _award_if_missing(
        "centinela", centinela_cond,
        badge_by_slug, existing_badge_ids, user.id, newly_awarded,
    )

    return newly_awarded
