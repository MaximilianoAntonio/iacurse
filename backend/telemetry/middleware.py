"""
Middleware de telemetría — registra accesos autenticados (AccessLog).

Cumple el lineamiento "Número de accesos" y "Frecuencia de uso" del Panel Docente.
También actualiza User.last_active para reflejar la última actividad real.

Para evitar ruido y sobrecarga:
- No loguea pings de heartbeat ni assets estáticos (configurable en settings).
- Solo registra requests autenticadas (usuarios reales).
"""
from django.conf import settings
from django.utils import timezone

from .models import AccessLog


# Prefijos/rutas a ignorar (configurables)
_EXACT_SKIP = getattr(settings, "TELEMETRY_LOG_PATHS_EXACT", set())
_PREFIX_SKIP = tuple(getattr(settings, "TELEMETRY_LOG_PATH_PREFIXES", ()))


def _get_client_ip(request) -> str:
    """Extrae la IP real del cliente (respeta X-Forwarded-For de Caddy/proxy)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _should_log(path: str) -> bool:
    if path in _EXACT_SKIP:
        return False
    if path.startswith(_PREFIX_SKIP):
        return False
    return True


class AccessLogMiddleware:
    """Registra cada request autenticada en AccessLog (métrica de accesos)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Solo logueamos requests autenticadas (usuarios reales)
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return response

        path = request.path
        if not _should_log(path):
            return response

        # Registrar el acceso
        try:
            AccessLog.objects.create(
                user=user,
                ip=_get_client_ip(request) or None,
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
                path=path[:255],
                method=request.method[:8],
                status_code=response.status_code,
            )
        except Exception:
            # La telemetría nunca debe romper la request
            pass

        # Actualizar last_active (throttle: máximo una vez por minuto)
        now = timezone.now()
        if user.last_active is None or (now - user.last_active).total_seconds() > 60:
            try:
                # Update directo para evitar recursión del save()
                type(user).objects.filter(pk=user.pk).update(last_active=now)
            except Exception:
                pass

        return response
