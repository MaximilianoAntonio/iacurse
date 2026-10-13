"""
Servicios de IA para aprendizaje — orquesta el proveedor con fallbacks.

- generate_activity_feedback(opts) → retroalimentación formativa de actividades
- generate_scaffold_support(...) → intervención de andamiaje CAAMI (A1-A5)

Reproduce la lógica de src/lib/ai.ts, incluyendo los fallbacks en español
cuando la IA falla. La personalización de unidades vive en
learning/ai_services.py y usa la misma capa tutor/ai/.

CAAMI: el backend decide el nivel de andamiaje de forma determinista
(tutor/caami.py); aquí solo se clasifica el error, se recupera contexto del
RAG y se le pide al LLM el TEXTO de la intervención del nivel asignado. Cada
llamada queda registrada en AIInteraction (registro defensivo: un fallo de
logging NUNCA rompe la respuesta pedagógica; sin PII: no se guarda la
respuesta del estudiante).
"""
import logging
import time
from dataclasses import dataclass
from typing import List, Optional

from django.conf import settings

from tutor.ai.base import AIServiceError, FallbackProvider
from tutor.ai.factory import get_ai_provider
from tutor.ai.prompts import (
    FEEDBACK_FALLBACK_CORRECT,
    FEEDBACK_FALLBACK_INCORRECT,
    SCAFFOLD_FALLBACKS,
)
from tutor.caami import level_label
from tutor.rag import format_chunks_for_prompt, retrieve_chunks

logger = logging.getLogger(__name__)


def _log_interaction(**fields) -> None:
    """Registra una AIInteraction de forma defensiva (nunca lanza)."""
    try:
        from tutor.models import AIInteraction

        AIInteraction.objects.create(**fields)
    except Exception as e:  # noqa: BLE001 — el logging no rompe la pedagogía
        logger.warning("No se pudo registrar AIInteraction: %s", e)


def generate_activity_feedback(**opts) -> str:
    """Genera retroalimentación formativa. Fallback si la IA falla.

    Kwargs: activity_type, activity_title, prompt, student_answer,
            is_correct, correct_answer?, context?, assessment_type?,
            bloom_level?, objectives?, rubric_criteria?
    Kwargs opcionales para trazabilidad: user, activity, attempt (si están,
    se registra AIInteraction con operation_type="activity_feedback").
    """
    # Metadatos de trazabilidad (no forman parte del prompt)
    user = opts.pop("user", None)
    activity = opts.pop("activity", None)
    attempt = opts.pop("attempt", None)

    provider = get_ai_provider()
    start = time.monotonic()
    try:
        feedback = provider.generate_feedback(**opts)
        latency_ms = int((time.monotonic() - start) * 1000)
        if user is not None:
            _log_interaction(
                user=user, activity=activity, attempt=attempt,
                operation_type="activity_feedback",
                provider=type(provider).__name__.replace("Provider", "").lower(),
                model=getattr(provider, "model", getattr(provider, "model_name", "")) or "",
                latency_ms=latency_ms, status="ok",
            )
        return feedback
    except AIServiceError as e:
        latency_ms = int((time.monotonic() - start) * 1000)
        logger.warning("IA feedback falló, usando fallback: %s", e)
        if user is not None:
            _log_interaction(
                user=user, activity=activity, attempt=attempt,
                operation_type="activity_feedback",
                provider=type(provider).__name__.replace("Provider", "").lower(),
                latency_ms=latency_ms, status="fallback",
                error_detail=str(e)[:200],
            )
        is_correct = opts.get("is_correct", False)
        return FEEDBACK_FALLBACK_CORRECT if is_correct else FEEDBACK_FALLBACK_INCORRECT


@dataclass
class ScaffoldOutcome:
    """Intervención de andamiaje CAAMI lista para entregar al estudiante."""

    level: str  # "A1".."A5"
    support_type: str
    message: str  # para A5 = explanation; para A4 puede ir vacío (hay steps)
    steps: Optional[list]
    key_concepts: Optional[list]
    error_type: str
    source: str  # "ai" | "fallback"


def _outcome_from_payload(payload: dict, *, error_type: str, source: str) -> ScaffoldOutcome:
    """Construye el ScaffoldOutcome desde un payload validado (IA o fallback)."""
    return ScaffoldOutcome(
        level=payload.get("level", ""),
        support_type=payload.get("support_type", ""),
        message=payload.get("message") or payload.get("explanation") or "",
        steps=payload.get("steps"),
        key_concepts=payload.get("key_concepts"),
        error_type=error_type,
        source=source,
    )


def generate_scaffold_support(
    *, user, activity, student_answer, correct_answer, state, level: int
) -> ScaffoldOutcome:
    """Genera la intervención de andamiaje CAAMI para el nivel decidido.

    Flujo: (1) RAG de contexto autorizado → (2) clasificación del error
    (actualiza state.last_error_type, sin save: persiste el caller) →
    (3) generación del texto del nivel asignado → (4) ScaffoldOutcome.
    Cada paso queda registrado en AIInteraction; ante cualquier fallo de IA
    se usa el fallback pedagógico del nivel (SCAFFOLD_FALLBACKS).
    """
    label = level_label(level)
    fallback = SCAFFOLD_FALLBACKS[label]
    provider = get_ai_provider()
    provider_name = type(provider).__name__.replace("Provider", "").lower()

    # --- 1. RAG: contexto autorizado (nunca bloquea) ---
    unit = getattr(getattr(activity, "lesson", None), "unit", None)
    unit_label = f"U{unit.order:02d}" if unit is not None else None
    query_text = f"{activity.title} {activity.prompt}"
    chunks: List = []
    if getattr(settings, "RAG_ENABLED", False):
        try:
            chunks = retrieve_chunks(query_text=query_text, unit=unit_label)
        except Exception as e:  # noqa: BLE001 — el RAG nunca bloquea
            logger.warning("RAG falló, siguiendo sin contexto: %s", e)
            chunks = []
    rag_text = format_chunks_for_prompt(chunks)
    retrieved_chunk_ids = [chunk.chunk_id for chunk in chunks] or None
    kb_version = getattr(settings, "KB_VERSION", "KB_v1") if retrieved_chunk_ids else ""

    scaffold_kwargs = dict(
        activity_type=activity.type,
        activity_title=activity.title,
        prompt=activity.prompt,
        student_answer=student_answer,
        correct_answer=correct_answer,
        context=str(unit.title) if unit is not None else None,
        rag_chunks=rag_text,
    )

    # Con CAAMI desactivado o provider fallback: directamente al fallback
    # pedagógico (sin llamadas externas ni clasificación).
    if not getattr(settings, "CAAMI_ENABLED", True) or isinstance(provider, FallbackProvider):
        if not isinstance(provider, FallbackProvider):
            _log_interaction(
                user=user, activity=activity, operation_type=f"scaffold_{label.lower()}",
                provider=provider_name, scaffolding_level=label,
                retrieved_chunk_ids=retrieved_chunk_ids, kb_version=kb_version,
                status="fallback", error_detail="CAAMI desactivado por configuración",
            )
        return _outcome_from_payload(fallback, error_type=state.last_error_type, source="fallback")

    # --- 2. Clasificación del error (alimenta el foco de A2) ---
    error_type = "indeterminate"
    try:
        classify_result = provider.classify_error(**scaffold_kwargs)
        payload = classify_result.payload
        if not payload.get("insufficient_context"):
            error_type = payload.get("error_type") or "indeterminate"
        state.last_error_type = error_type  # sin save: persiste el caller
        _log_interaction(
            user=user, activity=activity, operation_type="classify_error",
            provider=provider_name, model=classify_result.model,
            prompt_version=classify_result.prompt_version,
            latency_ms=classify_result.latency_ms,
            input_tokens=classify_result.input_tokens,
            output_tokens=classify_result.output_tokens,
            retrieved_chunk_ids=retrieved_chunk_ids, kb_version=kb_version,
            status="ok",
        )
    except AIServiceError as e:
        logger.warning("CAAMI clasificación falló: %s", e)
        state.last_error_type = "indeterminate"
        _log_interaction(
            user=user, activity=activity, operation_type="classify_error",
            provider=provider_name,
            retrieved_chunk_ids=retrieved_chunk_ids, kb_version=kb_version,
            status="error", error_detail=str(e)[:200],
        )

    # --- 3. Generación del texto del nivel asignado ---
    try:
        scaffold_result = provider.generate_scaffold(
            level=label, error_type=error_type, **scaffold_kwargs
        )
        payload = scaffold_result.payload
        if payload.get("insufficient_context"):
            raise AIServiceError("Contexto insuficiente declarado por el modelo")
        _log_interaction(
            user=user, activity=activity, operation_type=f"scaffold_{label.lower()}",
            provider=provider_name, model=scaffold_result.model,
            prompt_version=scaffold_result.prompt_version,
            scaffolding_level=label,
            latency_ms=scaffold_result.latency_ms,
            input_tokens=scaffold_result.input_tokens,
            output_tokens=scaffold_result.output_tokens,
            retrieved_chunk_ids=retrieved_chunk_ids, kb_version=kb_version,
            status="ok",
        )
        return _outcome_from_payload(payload, error_type=error_type, source="ai")
    except AIServiceError as e:
        logger.warning("CAAMI andamiaje %s falló, usando fallback: %s", label, e)
        _log_interaction(
            user=user, activity=activity, operation_type=f"scaffold_{label.lower()}",
            provider=provider_name, scaffolding_level=label,
            retrieved_chunk_ids=retrieved_chunk_ids, kb_version=kb_version,
            status="fallback", error_detail=str(e)[:200],
        )
        return _outcome_from_payload(fallback, error_type=error_type, source="fallback")
