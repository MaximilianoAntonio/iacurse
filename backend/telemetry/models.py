"""
Modelos de telemetría — cumplimiento del lineamiento (Sección 12):

Panel docente con:
- Número de accesos → AccessLog
- Tiempo de interacción → StudySession (learning app) escrito vía heartbeat real
- Actividades completadas → Progress (learning app)
- Frecuencia de uso → derivada de AccessLog + StudySession
- Endpoint genérico de eventos → EventLog
"""
from django.conf import settings
from django.db import models


class AccessLog(models.Model):
    """Registro de cada acceso autenticado a la plataforma.

    Alimenta la métrica "Número de accesos" y "Frecuencia de uso" del
    Panel Docente. Se crea desde AccessLogMiddleware.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="access_logs",
        null=True,
        blank=True,
    )
    ip = models.GenericIPAddressField("IP", null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    path = models.CharField("ruta", max_length=255)
    method = models.CharField("método HTTP", max_length=8)
    status_code = models.IntegerField("código de estado", default=200)
    created_at = models.DateTimeField("fecha/hora", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "registro de acceso"
        verbose_name_plural = "registros de acceso"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.method} {self.path} ({self.created_at:%Y-%m-%d %H:%M})"


class EventLog(models.Model):
    """Evento genérico de telemetría para analítica flexible.

    El frontend envía eventos arbitrarios vía POST /api/telemetry/event:
    page_view, open_lesson, request_hint, submit_attempt, self_assess, etc.
    Esto permite medir patrones de interacción sin acoplar el backend a
    cada evento específico del frontend.
    """

    EVENT_TYPES = [
        ("page_view", "Vista de página"),
        ("open_lesson", "Abrir lección"),
        ("open_activity", "Abrir actividad"),
        ("request_hint", "Solicitar pista"),
        ("submit_attempt", "Enviar intento"),
        ("bookmark", "Marcar actividad"),
        ("self_assess", "Autoevaluación"),
        ("report_error", "Reportar error"),
        ("custom", "Personalizado"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_logs",
        null=True,
        blank=True,
    )
    event_type = models.CharField("tipo de evento", max_length=32, choices=EVENT_TYPES, db_index=True)
    metadata = models.JSONField("metadatos", default=dict, blank=True)
    unit = models.ForeignKey(
        "curriculum.Unit", on_delete=models.SET_NULL, null=True, blank=True
    )
    lesson = models.ForeignKey(
        "curriculum.Lesson", on_delete=models.SET_NULL, null=True, blank=True
    )
    activity = models.ForeignKey(
        "curriculum.Activity", on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField("fecha/hora", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "evento"
        verbose_name_plural = "eventos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"


class AuditLog(models.Model):
    """Registro de auditoría de eventos de seguridad.

    Cubre los eventos obligatorios de la política de trazabilidad
    (autenticaciones exitosas y fallidas, cambios de contraseña, resets por
    el docente, creación de cuentas, moderación de reportes y cambios de
    configuración crítica del curso). A diferencia de AccessLog/EventLog
    (telemetría pedagógica), esta tabla es la evidencia auditable ante un
    incidente: NO se edita ni se borra desde la aplicación; la retención se
    gestiona con ``manage.py purge_telemetry``.
    """

    EVENT_TYPES = [
        ("login_success", "Inicio de sesión exitoso"),
        ("login_failed", "Inicio de sesión fallido"),
        ("password_change", "Cambio de contraseña"),
        ("password_reset_admin", "Reset de contraseña por docente"),
        ("student_created", "Creación de cuenta de estudiante"),
        ("report_moderated", "Moderación de reporte"),
        ("course_config_changed", "Cambio de configuración del curso"),
    ]

    # Quien ejecuta la acción (null en login_failed sin usuario válido)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    event_type = models.CharField("tipo de evento", max_length=32, choices=EVENT_TYPES, db_index=True)
    # Descripción del objetivo (p. ej. código de estudiante afectado);
    # nunca contiene contraseñas ni datos de credenciales.
    target = models.CharField("objetivo", max_length=255, blank=True, default="")
    ip = models.GenericIPAddressField("IP", null=True, blank=True)
    metadata = models.JSONField("metadatos", default=dict, blank=True)
    created_at = models.DateTimeField("fecha/hora", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "evento de auditoría"
        verbose_name_plural = "eventos de auditoría"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["event_type", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"
