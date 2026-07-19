"""
Tests de telemetría — valida el cumplimiento del lineamiento.

Cubre:
- Endpoint genérico de eventos (EventLog)
- Ciclo de vida de sesión (start/heartbeat/end → StudySession real)
- Middleware AccessLog (número de accesos)
- Alarma de uso diario (dependencia tecnológica)
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import StudySession
from telemetry.models import AccessLog, EventLog
from telemetry import services

User = get_user_model()


@pytest.fixture
def student(db):
    user = User.objects.create_user(
        username="estudiante1",
        email="estudiante@uv.cl",
        password="Test1234!",
        role=User.ROLE_STUDENT,
        name="Estudiante Uno",
    )
    return user


@pytest.fixture
def auth_client(student):
    """Cliente autenticado vía sesión."""
    client = APIClient()
    client.force_authenticate(user=student)
    return client


@pytest.mark.django_db
class TestEventEndpoint:
    """POST /api/telemetry/event — endpoint genérico de eventos."""

    def test_creates_event_log(self, auth_client, student):
        """Un evento válido se persiste en EventLog."""
        resp = auth_client.post(
            "/api/telemetry/event",
            {
                "eventType": "open_lesson",
                "metadata": {"source": "sidebar"},
                "lessonId": "cl lesson xxx",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert EventLog.objects.filter(user=student, event_type="open_lesson").count() == 1
        ev = EventLog.objects.get()
        assert ev.metadata == {"source": "sidebar"}

    def test_requires_auth(self):
        """Sin auth → 403 (no 201)."""
        client = APIClient()
        resp = client.post("/api/telemetry/event", {"eventType": "page_view"}, format="json")
        assert resp.status_code in (401, 403)

    def test_missing_event_type(self, auth_client):
        """Sin eventType → 400."""
        resp = auth_client.post("/api/telemetry/event", {"metadata": {}}, format="json")
        assert resp.status_code == 400

    def test_unknown_type_becomes_custom(self, auth_client, student):
        """Tipos desconocidos se guardan como 'custom' (analítica flexible)."""
        resp = auth_client.post(
            "/api/telemetry/event",
            {"eventType": "algo_nuevo_raro"},
            format="json",
        )
        assert resp.status_code == 201
        assert EventLog.objects.get().event_type == "custom"


@pytest.mark.django_db
class TestSessionLifecycle:
    """Tiempo de interacción real — el bug de la versión Next.js.

    En Next.js StudySession solo se escribía desde prisma/seed.ts.
    Aquí el backend lo escribe en producción vía start/heartbeat/end.
    """

    def test_start_creates_active_session(self, auth_client, student):
        """POST /session/start crea una StudySession activa."""
        resp = auth_client.post("/api/telemetry/session/start", {}, format="json")
        assert resp.status_code == 201
        assert StudySession.objects.filter(user=student).count() == 1
        session = StudySession.objects.get()
        assert session.is_active is True
        assert session.duration == 0
        assert session.ended_at is None

    def test_heartbeat_updates_duration(self, auth_client, student):
        """El heartbeat actualiza la duración en vivo."""
        auth_client.post("/api/telemetry/session/start", {}, format="json")
        session = StudySession.objects.get()
        # Simular que el inicio fue hace 60s
        StudySession.objects.filter(pk=session.pk).update(
            started_at=timezone.now() - timedelta(seconds=60)
        )
        resp = auth_client.post(
            "/api/telemetry/session/heartbeat",
            {"sessionId": session.id},
            format="json",
        )
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.duration >= 60
        assert session.last_heartbeat_at is not None

    def test_end_finalizes_session(self, auth_client, student):
        """POST /session/end calcula duration y marca is_active=False."""
        auth_client.post("/api/telemetry/session/start", {}, format="json")
        session = StudySession.objects.get()
        StudySession.objects.filter(pk=session.pk).update(
            started_at=timezone.now() - timedelta(seconds=120)
        )
        resp = auth_client.post(
            "/api/telemetry/session/end",
            {"sessionId": session.id},
            format="json",
        )
        assert resp.status_code == 200
        session.refresh_from_db()
        assert session.is_active is False
        assert session.ended_at is not None
        assert session.duration > 0

    def test_direct_service_start_heartbeat_end(self, student):
        """Validación directa del módulo services (sin HTTP)."""
        session = services.start_session(student)
        assert session.is_active
        services.heartbeat(session.id)
        services.end_session(session.id)
        session.refresh_from_db()
        assert session.is_active is False
        assert session.duration >= 0


@pytest.mark.django_db
class TestAccessLogMiddleware:
    """Número de accesos — se registra cada request autenticada.

    Nota: en config.settings.test el middleware está desactivado para aislar
    los tests unitarios. Aquí lo re-activamos para validar su comportamiento.
    """

    def test_authenticated_request_creates_access_log(self, student):
        """Una request autenticada genera un AccessLog."""
        from django.test import override_settings

        AccessLog.objects.all().delete()
        middleware = "telemetry.middleware.AccessLogMiddleware"
        with override_settings(MIDDLEWARE=[
            "django.contrib.sessions.middleware.SessionMiddleware",
            "django.contrib.auth.middleware.AuthenticationMiddleware",
            middleware,
        ]):
            client = APIClient()
            client.force_authenticate(user=student)
            client.get("/api/me")
        assert AccessLog.objects.filter(user=student).count() >= 1

    def test_anonymous_request_no_access_log(self):
        """Una request anónima NO genera AccessLog."""
        from django.test import override_settings

        middleware = "telemetry.middleware.AccessLogMiddleware"
        with override_settings(MIDDLEWARE=[
            "django.contrib.sessions.middleware.SessionMiddleware",
            "django.contrib.auth.middleware.AuthenticationMiddleware",
            middleware,
        ]):
            client = APIClient()
            client.get("/api/me")
        assert AccessLog.objects.filter(user__isnull=False).count() == 0


@pytest.mark.django_db
class TestUsageAlert:
    """Alarma de dependencia tecnológica (lineamiento: umbral de uso diario)."""

    def test_usage_under_threshold(self, auth_client):
        """Sin sesiones hoy → 0 minutos, no excedido."""
        resp = auth_client.get("/api/telemetry/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["minutesToday"] == 0
        assert data["exceeded"] is False

    def test_usage_aggregates_today_sessions(self, student, auth_client):
        """Las sesiones de hoy se suman correctamente."""
        # Crear 2 sesiones hoy de 1h cada una
        StudySession.objects.create(
            user=student, started_at=timezone.now() - timedelta(hours=2), duration=3600
        )
        StudySession.objects.create(
            user=student, started_at=timezone.now() - timedelta(hours=1), duration=3600
        )
        resp = auth_client.get("/api/telemetry/usage")
        data = resp.json()
        assert data["minutesToday"] == 120  # 2h = 120 min
