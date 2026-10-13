"""Proveedor de IA: OpenAI (API oficial)."""
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

# Límite de tokens de salida por operación CAAMI (los niveles altos permiten
# intervenciones más extensas: secuencia guiada y resolución explicada).
_CLASSIFY_MAX_TOKENS = 300
_SCAFFOLD_MAX_TOKENS = {"A1": 150, "A2": 250, "A3": 500, "A4": 700, "A5": 900}

# Temperaturas bajas: clasificación casi determinista, andamiaje con un poco
# más de variabilidad de redacción (algunos modelos no aceptan el parámetro;
# en ese caso se reintenta sin él).
_CLASSIFY_TEMPERATURE = 0.2
_SCAFFOLD_TEMPERATURE = 0.4


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
        # Base URL opcional: permite APIs OpenAI-compatibles (Kimi/Moonshot,
        # Azure, proxies locales, etc.). Vacío = API oficial de OpenAI.
        base_url = getattr(settings, "OPENAI_BASE_URL", "") or None
        self.client = OpenAI(api_key=api_key, base_url=base_url)
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

    # ------------------------------------------------------------------
    # CAAMI — clasificación de error y andamiaje A1-A5
    # ------------------------------------------------------------------
    def _json_call(self, *, user_prompt, max_tokens, temperature):
        """Llamada JSON estricta con medición de latencia y tokens.

        Devuelve (texto, latency_ms, input_tokens, output_tokens).
        El parámetro temperature se omite si el modelo no lo admite.
        """
        kwargs = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": CAAMI_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        start = time.monotonic()
        try:
            resp = self.client.chat.completions.create(**kwargs)
        except TypeError:
            # Modelo/API que no admite temperature: reintento sin el parámetro
            kwargs.pop("temperature", None)
            resp = self.client.chat.completions.create(**kwargs)
        latency_ms = int((time.monotonic() - start) * 1000)
        text = (resp.choices[0].message.content or "").strip()
        usage = getattr(resp, "usage", None)
        input_tokens = getattr(usage, "prompt_tokens", None) if usage else None
        output_tokens = getattr(usage, "completion_tokens", None) if usage else None
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
                    model=self.model,
                    prompt_version=prompt_version,
                    latency_ms=latency_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    provider="openai",
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
        """Embeddings para el RAG (un vector por texto)."""
        try:
            resp = self.client.embeddings.create(
                model=getattr(settings, "AI_EMBEDDING_MODEL", "text-embedding-3-small"),
                input=list(texts),
            )
            return [list(item.embedding) for item in resp.data]
        except Exception as e:
            raise AIServiceError(str(e)) from e
