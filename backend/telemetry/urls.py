"""URLs de telemetría — telemetría exigida por el lineamiento."""
from django.urls import path

from . import views

app_name = "telemetry"

urlpatterns = [
    # Endpoint genérico de eventos (analítica flexible)
    path("telemetry/event", views.EventView.as_view(), name="event"),
    # Ciclo de vida de sesión (tiempo de interacción real)
    path("telemetry/session/start", views.SessionStartView.as_view(), name="session-start"),
    path("telemetry/session/heartbeat", views.SessionHeartbeatView.as_view(), name="session-heartbeat"),
    path("telemetry/session/end", views.SessionEndView.as_view(), name="session-end"),
    # Uso diario + alarma de dependencia tecnológica
    path("telemetry/usage", views.UsageView.as_view(), name="usage"),
]
