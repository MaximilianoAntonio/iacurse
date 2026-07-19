"""
Modelos de aprendizaje — intentos, progreso, sesiones, gamificación.

Mapeo 1:1 desde prisma/schema.prisma:
- Attempt, Progress, StudySession, Bookmark
- Badge, UserBadge, SelfAssessment, ErrorReport

StudySession ahora se escribe en PRODUCCIÓN vía heartbeat real (telemetría),
no solo en seed como en la versión Next.js.
"""
import uuid

from django.conf import settings
from django.db import models

from curriculum.models import Activity, Lesson, Unit


def _cuid_default() -> str:
    return f"c{uuid.uuid4().hex[:24]}"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# Intentos y progreso
# ---------------------------------------------------------------------------
class Attempt(models.Model):
    """Un intento del estudiante en una actividad.

    Contiene la respuesta, score, retroalimentación IA, tiempo y hints.
    """

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="attempts")
    answer = models.TextField("respuesta")
    feedback = models.TextField("retroalimentación IA", blank=True, default="")
    score = models.IntegerField("puntaje", null=True, blank=True)
    correct = models.BooleanField("¿correcta?", null=True, blank=True)
    time_spent = models.IntegerField("tiempo (s)", null=True, blank=True)
    hints_used = models.IntegerField("pistas usadas", default=0)
    created_at = models.DateTimeField("fecha/hora", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "intento"
        verbose_name_plural = "intentos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "activity"]),
            models.Index(fields=["user", "correct"]),
            models.Index(fields=["activity"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} → {self.activity} ({self.score})"


class Progress(models.Model):
    """Progreso de un usuario en una unidad (agregado).

    unique_together (user, unit) — equivalente al @@unique de Prisma.
    """

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="progress")
    completed = models.IntegerField("completadas", default=0)
    total = models.IntegerField("total", default=0)
    mastery = models.IntegerField("dominio (%)", default=0)
    last_visited = models.DateTimeField("última visita", null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "progreso"
        verbose_name_plural = "progresos"
        unique_together = [("user", "unit")]

    def __str__(self) -> str:
        return f"{self.user} → {self.unit}: {self.completed}/{self.total}"


class StudySession(models.Model):
    """Sesión de estudio — tiempo de interacción real (telemetría).

    En la versión Next.js solo se escribía desde prisma/seed.ts.
    Ahora el backend la escribe en producción vía heartbeat del frontend
    (telemetry/services.py). Esto habilita la métrica "Tiempo de interacción".
    """

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_sessions")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True, blank=True, related_name="study_sessions")
    started_at = models.DateTimeField("inicio", auto_now_add=True, db_index=True)
    duration = models.IntegerField("duración (s)", default=0)
    # --- Campos nuevos para telemetría real ---
    last_heartbeat_at = models.DateTimeField("último heartbeat", null=True, blank=True)
    ended_at = models.DateTimeField("fin", null=True, blank=True)
    is_active = models.BooleanField("activa", default=True)

    class Meta:
        verbose_name = "sesión de estudio"
        verbose_name_plural = "sesiones de estudio"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "-started_at"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} sesión {self.started_at:%Y-%m-%d %H:%M}"


class Bookmark(models.Model):
    """Marcador de actividad del estudiante."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks")
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="bookmarks")
    note = models.CharField("nota", max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "marcador"
        verbose_name_plural = "marcadores"
        unique_together = [("user", "activity")]
        indexes = [models.Index(fields=["user"])]

    def __str__(self) -> str:
        return f"{self.user} ★ {self.activity}"


# ---------------------------------------------------------------------------
# Gamificación
# ---------------------------------------------------------------------------
class Badge(models.Model):
    """Insignia gamificada (lineamiento: ludificación — puntos, medallas)."""

    TIER_BRONZE = "bronze"
    TIER_SILVER = "silver"
    TIER_GOLD = "gold"
    TIER_CHOICES = [
        (TIER_BRONZE, "Bronce"),
        (TIER_SILVER, "Plata"),
        (TIER_GOLD, "Oro"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField("nombre", max_length=120)
    description = models.TextField("descripción", blank=True, default="")
    icon = models.CharField("icono", max_length=64, default="Award")
    tier = models.CharField("nivel", max_length=16, choices=TIER_CHOICES, default=TIER_BRONZE)

    class Meta:
        verbose_name = "insignia"
        verbose_name_plural = "insignias"
        ordering = ["tier", "name"]

    def __str__(self) -> str:
        return self.name


class UserBadge(models.Model):
    """Insignia otorgada a un usuario (unique user+badge)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_badges")
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name="user_badges")
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "insignia otorgada"
        verbose_name_plural = "insignias otorgadas"
        unique_together = [("user", "badge")]

    def __str__(self) -> str:
        return f"{self.user} → {self.badge}"


class SelfAssessment(models.Model):
    """Autoevaluación metacognitiva del estudiante (línea: autorregulación)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="self_assessments")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True, blank=True, related_name="self_assessments")
    confidence = models.IntegerField("confianza (1-5)")
    reflection = models.TextField("reflexión", blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "autoevaluación"
        verbose_name_plural = "autoevaluaciones"


class ErrorReport(models.Model):
    """Reporte de error en respuesta de IA (lineamiento: 'Reportar error')."""

    SOURCE_CHAT = "chat"
    SOURCE_ACTIVITY = "activity"
    SOURCE_CONTENT = "content"
    SOURCE_CHOICES = [
        (SOURCE_CHAT, "Chat"),
        (SOURCE_ACTIVITY, "Actividad"),
        (SOURCE_CONTENT, "Contenido"),
    ]

    REASON_INCORRECT = "incorrect"
    REASON_BIASED = "biased"
    REASON_OFFTOPIC = "offtopic"
    REASON_HARMFUL = "harmful"
    REASON_OTHER = "other"
    REASON_CHOICES = [
        (REASON_INCORRECT, "Incorrecta"),
        (REASON_BIASED, "Sesgada"),
        (REASON_OFFTOPIC, "Fuera de tema"),
        (REASON_HARMFUL, "Dañina"),
        (REASON_OTHER, "Otra"),
    ]

    STATUS_OPEN = "open"
    STATUS_REVIEWED = "reviewed"
    STATUS_RESOLVED = "resolved"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Abierto"),
        (STATUS_REVIEWED, "Revisado"),
        (STATUS_RESOLVED, "Resuelto"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="error_reports")
    source = models.CharField("origen", max_length=16, choices=SOURCE_CHOICES)
    source_id = models.CharField("ID origen", max_length=40, blank=True, default="")
    reason = models.CharField("razón", max_length=16, choices=REASON_CHOICES)
    comment = models.TextField("comentario", blank=True, default="")
    status = models.CharField("estado", max_length=16, choices=STATUS_CHOICES, default=STATUS_OPEN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "reporte de error IA"
        verbose_name_plural = "reportes de error IA"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["status"]),
        ]
