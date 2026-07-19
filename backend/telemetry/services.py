"""
Servicios de telemetría — sesiones de estudio reales (tiempo de interacción).

Esta es la pieza clave que faltaba en la versión Next.js: StudySession ahora se
escribe en PRODUCCIÓN vía heartbeat del frontend, no solo desde el seed.

Flujo:
  1. Frontend monta vista → POST /api/telemetry/session/start
  2. Cada 30s → POST /api/telemetry/session/heartbeat (actualiza last_heartbeat_at)
  3. Al desmontar/unload → POST /api/telemetry/session/end (calcula duration)

Cumple lineamiento: "Tiempo de interacción", "Frecuencia de uso".
"""
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from accounts.models import User
from curriculum.models import Unit
from learning.models import StudySession


def start_session(user: User, unit_id: Optional[str] = None) -> StudySession:
    """Crea una nueva sesión de estudio activa.

    Si ya existe una sesión activa del usuario hace más de 30 min sin heartbeat,
    se cierra automáticamente antes de crear la nueva (evita sesiones zombi).
    """
    # Cerrar sesiones inactivas (sin heartbeat > 30 min)
    stale_threshold = timezone.now() - timedelta(minutes=30)
    for stale in StudySession.objects.filter(
        user=user, is_active=True, last_heartbeat_at__lt=stale_threshold
    ):
        _finalize_session(stale)

    unit = None
    if unit_id:
        unit = Unit.objects.filter(pk=unit_id).first()

    session = StudySession.objects.create(
        user=user,
        unit=unit,
        started_at=timezone.now(),
        is_active=True,
        last_heartbeat_at=timezone.now(),
        duration=0,
    )
    return session


def heartbeat(session_id: str) -> Optional[StudySession]:
    """Actualiza el último heartbeat de una sesión (el frontend lo llama cada 30s)."""
    try:
        session = StudySession.objects.get(pk=session_id, is_active=True)
    except StudySession.DoesNotExist:
        return None

    now = timezone.now()
    # Duration en vivo = tiempo transcurrido desde inicio
    duration = int((now - session.started_at).total_seconds())
    StudySession.objects.filter(pk=session.pk).update(
        last_heartbeat_at=now,
        duration=duration,
    )
    session.last_heartbeat_at = now
    session.duration = duration
    return session


def end_session(session_id: str) -> Optional[StudySession]:
    """Finaliza una sesión calculando la duración total."""
    try:
        session = StudySession.objects.get(pk=session_id)
    except StudySession.DoesNotExist:
        return None
    return _finalize_session(session)


def _finalize_session(session: StudySession) -> StudySession:
    """Calcula duration final y marca la sesión como cerrada."""
    now = timezone.now()
    # Usar el último heartbeat como referencia si existe (más realista que started_at)
    end_ref = session.last_heartbeat_at or session.started_at
    # Limitar la duración: si el gap desde el último heartbeat es muy grande,
    # asumir que el usuario se fue (no contar todo el tiempo).
    if session.last_heartbeat_at and (now - session.last_heartbeat_at).total_seconds() > 300:
        end_ref = session.last_heartbeat_at
    duration = max(0, int((end_ref - session.started_at).total_seconds()))
    StudySession.objects.filter(pk=session.pk).update(
        duration=duration,
        ended_at=end_ref,
        is_active=False,
    )
    session.duration = duration
    session.ended_at = end_ref
    session.is_active = False
    return session


def get_daily_usage_minutes(user: User) -> int:
    """Minutos de uso del usuario hoy (para alarma de dependencia tecnológica).

    Lineamiento: "Establecer sistema de alarma si el estudiante sobrepasa un
    umbral de uso diario."
    """
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    result = StudySession.objects.filter(
        user=user, started_at__gte=today_start
    ).aggregate(total=Sum("duration"))
    total_seconds = result["total"] or 0
    return total_seconds // 60


def check_daily_usage_alert(user: User) -> dict:
    """Verifica si el usuario supera el umbral de uso diario configurado."""
    threshold = getattr(settings, "TELEMETRY_DAILY_USAGE_ALERT_MIN", 360)
    minutes = get_daily_usage_minutes(user)
    return {
        "minutesToday": minutes,
        "thresholdMin": threshold,
        "exceeded": minutes >= threshold,
    }
