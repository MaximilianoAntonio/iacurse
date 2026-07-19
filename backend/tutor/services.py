"""
Servicios del tutor IA — orquesta el proveedor con fallbacks.

- tutor_chat(user, message, context) → genera respuesta socrática
- generate_activity_feedback(opts) → retroalimentación formativa

Reproduce la lógica de src/lib/ai.ts y src/app/api/tutor/route.ts,
incluyendo los fallbacks en español cuando la IA falla.
"""
import logging
from typing import List, Optional

from accounts.models import User
from tutor.ai.base import AIServiceError, ChatMessage
from tutor.ai.factory import get_ai_provider
from tutor.ai.prompts import (
    FEEDBACK_FALLBACK_CORRECT,
    FEEDBACK_FALLBACK_INCORRECT,
    TUTOR_FALLBACK,
    TUTOR_SYSTEM_PROMPT,
)
from tutor.models import ChatMessage as ChatMessageModel

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


def tutor_chat(user: User, message: str, context: Optional[str] = None) -> dict:
    """Procesa un mensaje del tutor: guarda historial, llama IA, devuelve respuesta.

    Reproduce tutor/route.ts POST.
    """
    # Cargar historial reciente (últimos 10 mensajes)
    history = list(
        ChatMessageModel.objects.filter(user=user).order_by("-created_at")[:10]
    )
    history.reverse()
    history_messages = [ChatMessage(role=m.role, content=m.content) for m in history]

    # Guardar mensaje del usuario
    ChatMessageModel.objects.create(
        user=user, role="user", content=message, context=context or ""
    )

    # Construir prompt de sistema con contexto
    system_prompt = TUTOR_SYSTEM_PROMPT
    if context:
        system_prompt += f"\n\n[Contexto actual del estudiante: está estudiando \"{context}\"]"

    # Llamar a la IA
    provider = get_ai_provider()
    all_messages = history_messages + [ChatMessage(role="user", content=message)]
    try:
        assistant_content = provider.chat(all_messages, system_prompt=system_prompt)
    except AIServiceError as e:
        logger.warning("IA tutor falló, usando fallback: %s", e)
        assistant_content = TUTOR_FALLBACK

    # Guardar respuesta del asistente
    saved = ChatMessageModel.objects.create(
        user=user, role="assistant", content=assistant_content, context=context or ""
    )

    return {
        "id": saved.id,
        "role": "assistant",
        "content": assistant_content,
        "createdAt": saved.created_at.isoformat(),
    }
