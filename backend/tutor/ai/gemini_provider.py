"""Proveedor de IA: Google Gemini."""
import json
import logging
import time

from django.conf import settings

from .base import AIProvider, AIResult, AIServiceError, ChatMessage
from .prompts import (
    CAAMI_CLASSIFY_VERSION,
    CAAMI_SCAFFOLD_VERSIONS,
    CAAMI_SYSTEM_PROMPT,
    FEEDBACK_SYSTEM_PROMPT,
    build_classify_prompt,
    build_feedback_prompt,
    build_scaffold_prompt,
)
from .validation import validate_classify_payload, validate_scaffold_payload

logger = logging.getLogger(__name__)

# Límite de tokens de salida por operación CAAMI (mismo criterio que OpenAI).
_CLASSIFY_MAX_TOKENS = 300
_SCAFFOLD_MAX_TOKENS = {"A1": 150, "A2": 250, "A3": 500, "A4": 700, "A5": 900}

_CLASSIFY_TEMPERATURE = 0.2
_SCAFFOLD_TEMPERATURE = 0.4


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

    # ------------------------------------------------------------------
    # CAAMI — clasificación de error y andamiaje A1-A5
    # ------------------------------------------------------------------
    def _json_call(self, *, user_prompt, max_tokens, temperature):
        """Llamada JSON estricta (response_mime_type) con latencia y tokens.

        Devuelve (texto, latency_ms, input_tokens, output_tokens).
        El parámetro temperature se omite si el modelo no lo admite.
        """
        model = self._genai.GenerativeModel(
            self.model_name, system_instruction=CAAMI_SYSTEM_PROMPT
        )
        generation_config = {
            "response_mime_type": "application/json",
            "max_output_tokens": max_tokens,
            "temperature": temperature,
        }
        start = time.monotonic()
        try:
            resp = model.generate_content(
                user_prompt, generation_config=generation_config
            )
        except TypeError:
            # Modelo que no admite temperature: reintento sin el parámetro
            generation_config.pop("temperature", None)
            resp = model.generate_content(
                user_prompt, generation_config=generation_config
            )
        latency_ms = int((time.monotonic() - start) * 1000)
        text = (resp.text or "").strip()
        usage = getattr(resp, "usage_metadata", None)
        input_tokens = getattr(usage, "prompt_token_count", None) if usage else None
        output_tokens = getattr(usage, "candidates_token_count", None) if usage else None
        return text, latency_ms, input_tokens, output_tokens

    def _json_operation(self, *, user_prompt, prompt_version, max_tokens, temperature, validator):
        """Ejecuta una operación CAAMI: parseo JSON + validación pedagógica.

        Ante JSON inválido o validación fallida hace UN retry técnico; si
        vuelve a fallar lanza AIServiceError.
        """
        last_error = None
        for _ in range(2):  # intento original + un retry
            try:
                text, latency_ms, input_tokens, output_tokens = self._json_call(
                    user_prompt=user_prompt, max_tokens=max_tokens, temperature=temperature
                )
                payload = json.loads(text)
                validator(payload)
                return AIResult(
                    payload=payload,
                    model=self.model_name,
                    prompt_version=prompt_version,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    provider="gemini",
                )
            except AIServiceError:
                raise
            except Exception as e:  # JSON inválido, validación o error de API
                last_error = e
                logger.warning("CAAMI: intento fallido (%s): %s", prompt_version, e)
        raise AIServiceError(f"CAAMI falló tras retry ({prompt_version}): {last_error}")

    def classify_error(self, *, activity_type, activity_title, prompt, student_answer,
                       correct_answer=None, context=None, rag_chunks=""):
        user_prompt = build_classify_prompt(
            activity_type=activity_type, activity_title=activity_title,
            prompt=prompt, student_answer=student_answer,
            correct_answer=correct_answer, context=context, rag_chunks=rag_chunks,
        )
        return self._json_operation(
            user_prompt=user_prompt,
            prompt_version=CAAMI_CLASSIFY_VERSION,
            max_tokens=_CLASSIFY_MAX_TOKENS,
            temperature=_CLASSIFY_TEMPERATURE,
            validator=validate_classify_payload,
        )

    def generate_scaffold(self, *, level, activity_type, activity_title, prompt, student_answer,
                          correct_answer=None, error_type="indeterminate", context=None, rag_chunks=""):
        user_prompt = build_scaffold_prompt(
            level=level, activity_type=activity_type, activity_title=activity_title,
            prompt=prompt, student_answer=student_answer,
            correct_answer=correct_answer, error_type=error_type,
            context=context, rag_chunks=rag_chunks,
        )
        return self._json_operation(
            user_prompt=user_prompt,
            prompt_version=CAAMI_SCAFFOLD_VERSIONS[level],
            max_tokens=_SCAFFOLD_MAX_TOKENS[level],
            temperature=_SCAFFOLD_TEMPERATURE,
            validator=lambda payload: validate_scaffold_payload(level, payload),
        )

    def embed(self, texts):
        """Embeddings para el RAG vía genai.embed_content (un vector por texto)."""
        try:
            resp = self._genai.embed_content(
                model=getattr(settings, "AI_EMBEDDING_MODEL", "models/text-embedding-004"),
                content=list(texts),
            )
            embeddings = resp["embedding"]
            # Con un solo texto el SDK puede devolver un vector simple
            if embeddings and isinstance(embeddings[0], (int, float)):
                embeddings = [embeddings]
            return [list(vector) for vector in embeddings]
        except Exception as e:
            raise AIServiceError(str(e)) from e
