"""
Factory del proveedor de IA — selecciona según settings.AI_PROVIDER.

Cachéa la instancia (inicialización costosa). Si no hay API key o falla la
inicialización, devuelve FallbackProvider (que siempre lanza AIServiceError,
forzando que los callers usen sus strings de fallback en español).
"""
import logging
from typing import Optional

from django.conf import settings

from .base import AIProvider, AIServiceError, FallbackProvider

logger = logging.getLogger(__name__)

_provider: Optional[AIProvider] = None


def get_ai_provider() -> AIProvider:
    """Devuelve la instancia del proveedor configurado (singleton)."""
    global _provider
    if _provider is not None:
        return _provider

    provider_name = getattr(settings, "AI_PROVIDER", "openai").lower()
    try:
        if provider_name == "openai":
            from .openai_provider import OpenAIProvider
            _provider = OpenAIProvider()
        elif provider_name == "gemini":
            from .gemini_provider import GeminiProvider
            _provider = GeminiProvider()
        elif provider_name == "fallback":
            _provider = FallbackProvider()
        else:
            logger.warning("AI_PROVIDER=%s desconocido, usando fallback", provider_name)
            _provider = FallbackProvider()
    except AIServiceError as e:
        logger.warning("No se pudo inicializar IA (%s): %s — usando fallback", provider_name, e)
        _provider = FallbackProvider()

    return _provider


def reset_provider() -> None:
    """Resetea el singleton (para tests)."""
    global _provider
    _provider = None
