"""Proveedor de IA: Google Gemini."""
import logging

from django.conf import settings

from .base import AIProvider, AIServiceError, ChatMessage
from .prompts import (
    FEEDBACK_SYSTEM_PROMPT,
    build_feedback_prompt,
)

logger = logging.getLogger(__name__)


class GeminiProvider(AIProvider):
    """Implementación con el SDK google-generativeai."""

    def __init__(self):
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        if not api_key:
            raise AIServiceError("GEMINI_API_KEY no configurada")
        try:
            import google.generativeai as genai
        except ImportError as e:
            raise AIServiceError("SDK google-generativeai no instalado") from e
        genai.configure(api_key=api_key)
        self._genai = genai
        self.model_name = getattr(settings, "GEMINI_MODEL", "gemini-1.5-flash")
        self.model = genai.GenerativeModel(
            self.model_name, system_instruction=FEEDBACK_SYSTEM_PROMPT
        )

    def chat(self, messages, system_prompt=None):
        # Gemini usa historial plano + instrucción de sistema del modelo
        try:
            # Si el caller pide un system prompt distinto (p. ej. la adaptación
            # de unidades de learning/ai_services.py), se crea un modelo ad-hoc
            # con esa instrucción; si no, se usa el de feedback por defecto.
            model = self.model
            if system_prompt and system_prompt != FEEDBACK_SYSTEM_PROMPT:
                model = self._genai.GenerativeModel(
                    self.model_name, system_instruction=system_prompt
                )
            # Historial sin el último mensaje (ese va como input) y con los
            # roles que espera Gemini ("user" | "model").
            history = [
                {
                    "role": "model" if m.role == "assistant" else "user",
                    "parts": [m.content],
                }
                for m in messages[:-1]
            ]
            convo = model.start_chat(history=history)
            # Último mensaje como input
            last = messages[-1] if messages else None
            if last is None:
                raise AIServiceError("Sin mensajes")
            resp = convo.send_message(last.content)
            return (resp.text or "").strip()
        except AIServiceError:
            raise
        except Exception as e:
            raise AIServiceError(str(e)) from e

    def generate_feedback(self, **opts):
        user_prompt = build_feedback_prompt(opts)
        try:
            convo = self.model.start_chat()
            resp = convo.send_message(user_prompt)
            content = (resp.text or "").strip()
            if not content:
                raise AIServiceError("Respuesta vacía")
            return content
        except AIServiceError:
            raise
        except Exception as e:
            raise AIServiceError(str(e)) from e
