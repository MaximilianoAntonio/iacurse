"""
Interfaz abstracta del proveedor de IA generativa.

Lineamiento (Sección 12): "API de IA generativa compatible con generación de
texto y retroalimentación automatizada".

La implementación concreta se elige vía settings.AI_PROVIDER ("openai" | "gemini").
Si no hay API key configurada, se usan fallbacks (no bloquean el piloto).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ChatMessage:
    """Mensaje en una conversación (role + content)."""

    role: str  # "system" | "user" | "assistant"
    content: str


class AIProvider(ABC):
    """Interfaz que deben implementar los proveedores de IA."""

    @abstractmethod
    def chat(self, messages: List[ChatMessage], system_prompt: Optional[str] = None) -> str:
        """Genera una respuesta de chat dado el historial.

        Args:
            messages: historial de la conversación (sin system prompt).
            system_prompt: prompt de sistema opcional (se antepone).

        Returns:
            El contenido de texto de la respuesta. Si hay error, debe lanzar
            AIServiceError (los callers deben tener fallback).
        """
        ...

    @abstractmethod
    def generate_feedback(
        self,
        activity_type: str,
        activity_title: str,
        prompt: str,
        student_answer: str,
        is_correct: bool,
        correct_answer: Optional[str] = None,
        context: Optional[str] = None,
        assessment_type: Optional[str] = None,
        bloom_level: Optional[str] = None,
        objectives: Optional[List[str]] = None,
        rubric_criteria: Optional[str] = None,
    ) -> str:
        """Genera retroalimentación formativa para una respuesta de actividad."""
        ...


class AIServiceError(Exception):
    """Error al invocar el proveedor de IA (triggers fallback)."""


class FallbackProvider(AIProvider):
    """Proveedor que SIEMPRE lanza error (para forzar fallback).

    Útil cuando no hay API key configurada: el piloto sigue funcionando
    con las respuestas de fallback hardcoded en español.
    """

    def chat(self, messages, system_prompt=None):
        raise AIServiceError("No AI provider configured")

    def generate_feedback(self, **kwargs):
        raise AIServiceError("No AI provider configured")
