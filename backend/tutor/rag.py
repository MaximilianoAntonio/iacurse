"""
Retrieval RAG básico para CAAMI.

Sin pgvector: los embeddings viven en KnowledgeChunk.embedding (JSONField) y
la similitud coseno se calcula en Python. Decisión deliberada: a la escala del
MVP es suficiente y mantiene los tests sobre SQLite en memoria.

Principios:
- RAG NUNCA bloquea: ante cualquier error del provider de embeddings se
  devuelve lista vacía (log warning) y la intervención sigue sin contexto.
- Solo se recuperan chunks de la versión de corpus vigente (settings.KB_VERSION)
  con filtro opcional por unidad (metadata filtering).
"""
import logging
import math
from typing import List, Optional

from django.conf import settings

from .ai.base import AIServiceError
from .ai.factory import get_ai_provider
from .models import KnowledgeChunk

logger = logging.getLogger(__name__)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Similitud coseno entre dos vectores (0 si alguno tiene norma cero)."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def retrieve_chunks(
    *, query_text: str, unit: Optional[str] = None, top_k: Optional[int] = None
) -> List[KnowledgeChunk]:
    """Devuelve los top_k chunks más similares a la consulta.

    Vacío si RAG está desactivado (settings.RAG_ENABLED), si no hay chunks
    con embedding en la versión vigente o si el provider de embeddings falla.
    """
    if not getattr(settings, "RAG_ENABLED", False):
        return []
    kb_version = getattr(settings, "KB_VERSION", "KB_v1")
    if top_k is None:
        top_k = getattr(settings, "RAG_TOP_K", 3)

    queryset = KnowledgeChunk.objects.filter(kb_version=kb_version).exclude(embedding__isnull=True)
    if unit:
        queryset = queryset.filter(unit=unit)
    chunks = list(queryset)
    if not chunks:
        return []

    try:
        provider = get_ai_provider()
        query_embedding = provider.embed([query_text])[0]
    except (AIServiceError, IndexError) as e:
        logger.warning("RAG: no se pudo embeber la consulta, siguiendo sin contexto: %s", e)
        return []

    scored = sorted(
        chunks,
        key=lambda chunk: cosine_similarity(query_embedding, chunk.embedding),
        reverse=True,
    )
    return scored[:top_k]


def format_chunks_for_prompt(chunks: List[KnowledgeChunk]) -> str:
    """Formatea los chunks recuperados como bloque de contexto autorizado.

    String vacío si no hay chunks. El delimitador <<<CONTEXTO_AUTORIZADO>>>
    lo reconoce el system prompt CAAMI como material de apoyo válido.
    """
    if not chunks:
        return ""
    lines = ["<<<CONTEXTO_AUTORIZADO (material del curso de apoyo):"]
    for index, chunk in enumerate(chunks, start=1):
        lines.append(f"[{index}] {chunk.content}")
    lines.append("CONTEXTO_AUTORIZADO>>>")
    return "\n".join(lines)
