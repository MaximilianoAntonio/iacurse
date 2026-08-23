"""
Vistas de telemetría — endpoints del lineamiento.

- POST /api/telemetry/event           — endpoint genérico de eventos (analítica flexible)
- POST /api/telemetry/session/start   — inicia sesión de estudio
- POST /api/telemetry/session/heartbeat — heartbeat (cada 30s)
- POST /api/telemetry/session/end     — finaliza sesión

La alarma de uso diario vive en ``services.check_daily_usage_alert`` y llega
al estudiante vía ``GET /api/notifications``.
"""
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .models import EventLog


class EventView(views.APIView):
    """Endpoint genérico de telemetría: registra cualquier evento del frontend.

    Body: {
        event_type: "page_view" | "open_lesson" | "request_hint" | ...,
        metadata: {...},          # libre (JSON)
        unitId?: "...",
        lessonId?: "...",
        activityId?: "...",
    }
    """

    permission_classes = [IsAuthenticated]

    VALID_TYPES = {code for code, _ in EventLog.EVENT_TYPES}

    def post(self, request):
        event_type = request.data.get("eventType") or request.data.get("event_type")
        if not event_type:
            return Response(
                {"error": "Falta eventType"}, status=status.HTTP_400_BAD_REQUEST
            )
        # Aceptar tipos fuera de la lista como "custom"
        if event_type not in self.VALID_TYPES:
            event_type = "custom"

        metadata = request.data.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {"raw": metadata}

        kwargs = {"user": request.user, "event_type": event_type, "metadata": metadata}
        # Resolver FKs: el frontend envía IDs (strings); validar que existan
        from curriculum.models import Activity, Lesson, Unit

        fk_models = {"unit": Unit, "lesson": Lesson, "activity": Activity}
        for fk, model in fk_models.items():
            val = (
                request.data.get(fk)
                or request.data.get(f"{fk}Id")
                or request.data.get(f"{fk}_id")
            )
            if val:
                try:
                    kwargs[fk] = model.objects.get(pk=val)
                except model.DoesNotExist:
                    pass  # FK opcional: si no existe, se ignora

        EventLog.objects.create(**kwargs)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class SessionStartView(views.APIView):
    """Inicia una sesión de estudio (tiempo de interacción real)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        unit_id = request.data.get("unitId") or request.data.get("unit_id")
        session = services.start_session(request.user, unit_id=unit_id)
        return Response(
            {
                "sessionId": session.id,
                "startedAt": session.started_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


class SessionHeartbeatView(views.APIView):
    """Heartbeat de sesión (el frontend lo llama cada 30s)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.data.get("sessionId") or request.data.get("session_id")
        if not session_id:
            return Response(
                {"error": "Falta sessionId"}, status=status.HTTP_400_BAD_REQUEST
            )
        session = services.heartbeat(session_id)
        if session is None:
            return Response(
                {"error": "Sesión no encontrada o finalizada"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                "sessionId": session.id,
                "durationSec": session.duration,
                "lastHeartbeatAt": session.last_heartbeat_at.isoformat(),
            }
        )


from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from .auth import SessionAuthenticationWithoutCSRF


@method_decorator(csrf_exempt, name="dispatch")
class SessionEndView(views.APIView):
    """Finaliza una sesión de estudio calculando la duración.

    Exenta de CSRF: el frontend la invoca vía navigator.sendBeacon() al cerrar
    la pestaña, lo que NO permite enviar headers (como X-CSRFToken). Es seguro
    porque: (a) requiere cookie de sesión válida (HttpOnly), (b) solo cierra
    una sesión identificada por su ID (que solo el usuario legítimo conoce),
    (c) es idempotente, (d) se valida que la sesión pertenezca al usuario.
    """

    authentication_classes = [SessionAuthenticationWithoutCSRF]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.data.get("sessionId") or request.data.get("session_id")
        if not session_id:
            return Response(
                {"error": "Falta sessionId"}, status=status.HTTP_400_BAD_REQUEST
            )
        session = services.end_session(session_id)
        if session is None:
            return Response(
                {"error": "Sesión no encontrada"}, status=status.HTTP_404_NOT_FOUND
            )
        # Seguridad: validar que la sesión pertenece al usuario autenticado
        if session.user_id != request.user.pk:
            return Response(
                {"error": "Sesión no encontrada"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(
            {
                "sessionId": session.id,
                "durationSec": session.duration,
                "endedAt": session.ended_at.isoformat() if session.ended_at else None,
            }
        )
