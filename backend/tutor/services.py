"""
Servicios de IA para aprendizaje — orquesta el proveedor con fallbacks.

- generate_activity_feedback(opts) → retroalimentación formativa de actividades

Reproduce la lógica de src/lib/ai.ts, incluyendo los fallbacks en español
cuando la IA falla. La personalización de unidades vive en
learning/ai_services.py y usa la misma capa tutor/ai/.
"""
import logging

from tutor.ai.base import AIServiceError
from tutor.ai.factory import get_ai_provider
from tutor.ai.prompts import (
    FEEDBACK_FALLBACK_CORRECT,
    FEEDBACK_FALLBACK_INCORRECT,
)

logger = logging.getLogger(__name__)


def generate_activity_feedback(**opts) -> str:
    """Genera retroalimentación formativa. Fallback si la IA falla.

    Kwargs: activity_type, activity_title, prompt, student_answer,
            is_correct, correct_answer?, context?, assessment_type?,
            bloom_level?, objectives?, rubric_criteria?
    """
    provider = get_ai_provider()
    try:
        return provider.generate_feedback(**opts)
    except AIServiceError as e:
        logger.warning("IA feedback falló, usando fallback: %s", e)
        is_correct = opts.get("is_correct", False)
        return FEEDBACK_FALLBACK_CORRECT if is_correct else FEEDBACK_FALLBACK_INCORRECT
