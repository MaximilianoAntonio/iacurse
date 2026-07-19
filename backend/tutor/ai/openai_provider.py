"""Proveedor de IA: OpenAI (API oficial)."""
import logging

from django.conf import settings

from .base import AIProvider, AIServiceError, ChatMessage
from .prompts import (
    FEEDBACK_FALLBACK_CORRECT,
    FEEDBACK_FALLBACK_INCORRECT,
    FEEDBACK_SYSTEM_PROMPT,
    build_feedback_prompt,
)

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    """Implementación con el SDK oficial openai (compatible con modelos GPT)."""

    def __init__(self):
        api_key = getattr(settings, "OPENAI_API_KEY", "")
        if not api_key:
            raise AIServiceError("OPENAI_API_KEY no configurada")
        try:
            from openai import OpenAI
        except ImportError as e:
            raise AIServiceError("SDK openai no instalado") from e
        self.client = OpenAI(api_key=api_key)
        self.model = getattr(settings, "AI_MODEL", "gpt-4o-mini")

    def chat(self, messages, system_prompt=None):
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend({"role": m.role, "content": m.content} for m in messages)
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=api_messages,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            raise AIServiceError(str(e)) from e

    def generate_feedback(self, **opts):
        user_prompt = build_feedback_prompt(opts)
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": FEEDBACK_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = (resp.choices[0].message.content or "").strip()
            # Fallback si la respuesta viene vacía
            if not content:
                raise AIServiceError("Respuesta vacía")
            return content
        except AIServiceError:
            raise
        except Exception as e:
            raise AIServiceError(str(e)) from e
