"""
Lógica de racha (streak) — reproducida fielmente desde attempt/route.ts:273-309.

Tres branches basados en día local-midnight:
- nunca activo                → streak = 1
- última actividad = ayer     → streak += 1 (consecutivo)
- última actividad < ayer     → streak = 1  (gap > 1 día → reset)
- última actividad = hoy      → sin cambios (no escribe)

Usa timezone.now() y la zona horaria del servidor (settings.TIME_ZONE,
por defecto America/Santiago) para el cálculo de día-midnight — esto
replica el comportamiento de la versión Next.js (server-local time).
"""
from datetime import time
from typing import Optional

from django.utils import timezone

from accounts.models import User


def _local_midnight(dt) -> "object":
    """Devuelve la medianoche local de una fecha dada (misma TZ)."""
    if dt is None:
        return None
    local = timezone.localtime(dt) if timezone.is_aware(dt) else dt
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def update_streak(user: User) -> int:
    """Actualiza el streak del usuario según su última actividad.

    Devuelve el nuevo valor de streak (o el actual si no cambia).
    No lanza errores; si algo falla, deja el streak tal cual.
    """
    # Re-leer fresco
    fresh = User.objects.filter(pk=user.pk).values("last_active", "streak").first()
    if fresh is None:
        return user.streak

    now = timezone.now()
    today = _local_midnight(now)
    from datetime import timedelta

    yesterday = today - timedelta(days=1)

    last_active = fresh["last_active"]
    last_day = _local_midnight(last_active) if last_active else None

    current_streak = fresh["streak"]

    if last_day is None:
        new_streak = 1
        User.objects.filter(pk=user.pk).update(streak=new_streak)
        return new_streak

    if last_day == yesterday:
        new_streak = current_streak + 1
        User.objects.filter(pk=user.pk).update(streak=new_streak)
        return new_streak

    if last_day < yesterday:
        new_streak = 1
        User.objects.filter(pk=user.pk).update(streak=new_streak)
        return new_streak

    # last_day == today → sin cambios
    return current_streak
