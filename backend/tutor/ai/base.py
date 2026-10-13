"""
Interfaz abstracta del proveedor de IA generativa.

Lineamiento (Sección 12): "API de IA generativa compatible con generación de
texto y retroalimentación automatizada".

La implementación concreta se elige vía settings.AI_PROVIDER ("openai" | "gemini").
Si no hay API key configurada, se usan fallbacks (no bloquean el piloto).

CAAMI: la interfaz incluye las operaciones del motor pedagógico
(classify_error / generate_scaffold) y embeddings para el RAG básico. Todas
devuelven AIResult (payload + metadatos de la llamada para AIInteraction).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class ChatMessage:
    """Mensaje en una conversación (role + content)."""

    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class AIResult:
    """Resultado estructurado de una llamada de IA (CAAMI).

    ``payload`` es el JSON ya parseado y validado según el schema de la
    operación; los demás campos alimentan el registro de trazabilidad
    (tutor.AIInteraction).
    """

    payload: Dict
    model: str
    prompt_version: str
    latency_ms: int
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    provider: str = ""


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

    @abstractmethod
    def classify_error(
        self,
        *,
        activity_type: str,
        activity_title: str,
        prompt: str,
        student_answer: str,
        correct_answer: Optional[str] = None,
        context: Optional[str] = None,
        rag_chunks: str = "",
    ) -> AIResult:
        """Clasifica la respuesta del estudiante (result + error_type).

        Devuelve AIResult con payload según el schema de
        ``build_classify_prompt``. Errores → AIServiceError (con un retry
        técnico interno antes de fallar).
        """
        ...

    @abstractmethod
    def generate_scaffold(
        self,
        *,
        level: str,
        activity_type: str,
        activity_title: str,
        prompt: str,
        student_answer: str,
        correct_answer: Optional[str] = None,
        error_type: str = "indeterminate",
        context: Optional[str] = None,
        rag_chunks: str = "",
    ) -> AIResult:
        """Genera el texto de la intervención de andamiaje del nivel indicado.

        ``level`` es la etiqueta "A1".."A5" decidida por el motor CAAMI; el
        payload sigue el schema de ese nivel y se valida pedagógicamente
        (tutor/ai/validation.py). Errores → AIServiceError.
        """
        ...

    @abstractmethod
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Devuelve un embedding por texto (para el retrieval del RAG).

        Si el proveedor no soporta embeddings, lanza AIServiceError.
        """
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

    def classify_error(self, **kwargs):
        raise AIServiceError("No AI provider configured")

    def generate_scaffold(self, **kwargs):
        raise AIServiceError("No AI provider configured")

    def embed(self, texts):
        raise AIServiceError("No AI provider configured")
