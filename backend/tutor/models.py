"""
App tutor — capa de abstracción de IA (tutor/ai/), motor pedagógico CAAMI
(caami.py), retrieval RAG básico (rag.py) y servicios (services.py).

Histórico: esta app alojaba el chat socrático (modelo ChatMessage y endpoint
/api/tutor), eliminado del producto. La capa tutor/ai/ se mantiene porque la
usan la retroalimentación de actividades y la personalización de unidades.

Modelos CAAMI:
- ScaffoldingState: estado determinista del andamiaje por (usuario, actividad).
- AIInteraction: trazabilidad de cada llamada al proveedor de IA (sin PII:
  jamás guarda la respuesta del estudiante, solo metadatos de la llamada).
- KnowledgeChunk: corpus de conocimiento embebido para el RAG (el embedding
  vive en un JSONField y la similitud coseno se calcula en Python: decisión
  deliberada para no exigir pgvector en Postgres ni romper los tests SQLite).
"""
import uuid

from django.conf import settings
from django.db import models


def _cuid_default() -> str:
    """Generador de PKs usado por las migraciones históricas de la app."""
    return f"c{uuid.uuid4().hex[:24]}"


def _kb_version_default() -> str:
    """Versión del corpus vigente (settings.KB_VERSION) como default."""
    return getattr(settings, "KB_VERSION", "KB_v1")


class ScaffoldingState(models.Model):
    """Estado del andamiaje CAAMI de un estudiante en una actividad.

    current_level: 0 = A0 (sin ayuda), 1-5 = A1-A5. Lo muta SOLO el motor
    determinista tutor/caami.py (decide_scaffold + apply_decision).
    """

    ERROR_TYPE_CHOICES = [
        ("none", "Sin error"),
        ("conceptual", "Conceptual"),
        ("procedural", "Procedimental"),
        ("mixed", "Mixto"),
        ("indeterminate", "Indeterminado"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="scaffolding_states")
    activity = models.ForeignKey("curriculum.Activity", on_delete=models.CASCADE, related_name="scaffolding_states")
    current_level = models.IntegerField("nivel actual (0=A0, 1-5=A1-A5)", default=0)
    failed_attempts = models.IntegerField("intentos fallidos", default=0)
    help_requests = models.IntegerField("solicitudes de ayuda", default=0)
    last_error_type = models.CharField("último tipo de error", max_length=20, choices=ERROR_TYPE_CHOICES, default="none")
    awaiting_verification = models.BooleanField("esperando verificación (tras A5)", default=False)
    verified = models.BooleanField("verificado (correcta tras andamiaje)", default=False)
    verified_at = models.DateTimeField("fecha de verificación", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "estado de andamiaje"
        verbose_name_plural = "estados de andamiaje"
        unique_together = [("user", "activity")]

    def __str__(self) -> str:
        return f"{self.user} → {self.activity} (A{self.current_level})"


class AIInteraction(models.Model):
    """Trazabilidad de una llamada al proveedor de IA.

    Sin PII por diseño: nunca almacena la respuesta del estudiante ni el
    payload generado; solo metadatos (operación, modelo, versión de prompt,
    latencia, tokens y chunks recuperados por el RAG).
    """

    STATUS_CHOICES = [
        ("ok", "OK"),
        ("fallback", "Fallback"),
        ("error", "Error"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_interactions")
    activity = models.ForeignKey(
        "curriculum.Activity", on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_interactions"
    )
    # Referencia por string para evitar import circular con learning
    attempt = models.ForeignKey(
        "learning.Attempt", on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_interactions"
    )
    operation_type = models.CharField("tipo de operación", max_length=40)
    provider = models.CharField("proveedor", max_length=30)
    model = models.CharField("modelo", max_length=80, blank=True, default="")
    prompt_version = models.CharField("versión del prompt", max_length=40, blank=True, default="")
    scaffolding_level = models.CharField("nivel de andamiaje", max_length=2, blank=True, default="")
    latency_ms = models.IntegerField("latencia (ms)", null=True, blank=True)
    input_tokens = models.IntegerField("tokens de entrada", null=True, blank=True)
    output_tokens = models.IntegerField("tokens de salida", null=True, blank=True)
    retrieved_chunk_ids = models.JSONField("chunks recuperados (RAG)", null=True, blank=True)
    kb_version = models.CharField("versión del corpus", max_length=40, blank=True, default="")
    status = models.CharField("estado", max_length=10, choices=STATUS_CHOICES)
    error_detail = models.CharField("detalle del error", max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "interacción de IA"
        verbose_name_plural = "interacciones de IA"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "operation_type"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.operation_type} ({self.provider}, {self.status})"


class KnowledgeChunk(models.Model):
    """Fragmento del corpus de conocimiento autorizado para el RAG.

    El embedding es una lista de floats en JSONField: la similitud coseno se
    calcula en Python (tutor/rag.py), sin extensión pgvector, suficiente a la
    escala del MVP y compatible con los tests sobre SQLite en memoria.
    """

    chunk_id = models.CharField("ID del fragmento", max_length=60, unique=True)
    kb_version = models.CharField("versión del corpus", max_length=40, default=_kb_version_default)
    course = models.CharField("curso", max_length=80, default="Electromedicina_II")
    unit = models.CharField("unidad", max_length=20, blank=True, default="")
    topic = models.CharField("tópico", max_length=120, blank=True, default="")
    document_id = models.CharField("documento origen", max_length=80)
    document_version = models.CharField("versión del documento", max_length=20, default="1")
    content = models.TextField("contenido")
    embedding = models.JSONField("embedding (lista de floats)", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "fragmento de conocimiento"
        verbose_name_plural = "fragmentos de conocimiento"
        ordering = ["chunk_id"]
        indexes = [
            models.Index(fields=["kb_version", "unit"]),
        ]

    def __str__(self) -> str:
        return f"{self.chunk_id} ({self.kb_version})"
