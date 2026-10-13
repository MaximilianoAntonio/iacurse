"""
Tests del retrieval RAG básico (tutor/rag.py).

Con embeddings sintéticos (vectores cortos hechos a mano) y un provider mock
cuyo embed devuelve un vector fijo: ranking por similitud coseno, filtros de
metadata (unit / kb_version), top_k y comportamiento fail-open.
"""
import pytest
from django.test import override_settings

from tutor.ai.base import AIServiceError
from tutor.models import KnowledgeChunk
from tutor.rag import cosine_similarity, format_chunks_for_prompt, retrieve_chunks

KB = "KB_test"


class EmbedProviderMock:
    """Provider cuyo embed devuelve siempre el vector fijo de consulta."""

    query_vector = [1.0, 0.0]
    error = None

    def embed(self, texts):
        if self.error:
            raise self.error
        return [list(self.query_vector) for _ in texts]


@pytest.fixture
def provider(monkeypatch):
    p = EmbedProviderMock()
    monkeypatch.setattr("tutor.rag.get_ai_provider", lambda: p)
    return p


@pytest.fixture
def chunks(db):
    """Corpus sintético: 3 chunks en U01/KB_test + ruido de otra unidad,
    otra versión de corpus y un chunk sin embedding."""
    c1 = KnowledgeChunk.objects.create(
        chunk_id="doc_0001", kb_version=KB, unit="U01", document_id="doc",
        content="Cercano al query", embedding=[1.0, 0.0],
    )
    c2 = KnowledgeChunk.objects.create(
        chunk_id="doc_0002", kb_version=KB, unit="U01", document_id="doc",
        content="Medianamente cercano", embedding=[1.0, 1.0],
    )
    c3 = KnowledgeChunk.objects.create(
        chunk_id="doc_0003", kb_version=KB, unit="U01", document_id="doc",
        content="Ortogonal al query", embedding=[0.0, 1.0],
    )
    KnowledgeChunk.objects.create(
        chunk_id="otra_u", kb_version=KB, unit="U02", document_id="doc",
        content="De otra unidad", embedding=[1.0, 0.0],
    )
    KnowledgeChunk.objects.create(
        chunk_id="otra_kb", kb_version="KB_vieja", unit="U01", document_id="doc",
        content="De otra versión del corpus", embedding=[1.0, 0.0],
    )
    KnowledgeChunk.objects.create(
        chunk_id="sin_emb", kb_version=KB, unit="U01", document_id="doc",
        content="Sin embedding", embedding=None,
    )
    return c1, c2, c3


class TestCosineSimilarity:
    def test_vectores_identicos(self):
        assert cosine_similarity([1.0, 2.0], [1.0, 2.0]) == pytest.approx(1.0)

    def test_vectores_ortogonales(self):
        assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_vector_cero(self):
        assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


@pytest.mark.django_db
@override_settings(RAG_ENABLED=True, KB_VERSION=KB, RAG_TOP_K=3)
class TestRetrieveChunks:
    def test_ranking_por_similitud_coseno(self, provider, chunks):
        c1, c2, c3 = chunks
        resultado = retrieve_chunks(query_text="consulta", unit="U01")
        assert [c.chunk_id for c in resultado] == [c1.chunk_id, c2.chunk_id, c3.chunk_id]

    def test_top_k_limita_resultados(self, provider, chunks):
        c1, c2, _ = chunks
        with override_settings(RAG_TOP_K=2):
            resultado = retrieve_chunks(query_text="consulta", unit="U01")
        assert [c.chunk_id for c in resultado] == [c1.chunk_id, c2.chunk_id]

    def test_filtro_por_unidad(self, provider, chunks):
        resultado = retrieve_chunks(query_text="consulta", unit="U02")
        assert [c.chunk_id for c in resultado] == ["otra_u"]

    def test_filtro_por_kb_version(self, provider, chunks):
        """Solo se recuperan chunks de la versión vigente del corpus."""
        resultado = retrieve_chunks(query_text="consulta", unit="U01")
        assert all(c.kb_version == KB for c in resultado)
        with override_settings(KB_VERSION="KB_vieja"):
            resultado = retrieve_chunks(query_text="consulta", unit="U01")
        assert [c.chunk_id for c in resultado] == ["otra_kb"]

    def test_sin_filtro_de_unidad(self, provider, chunks):
        resultado = retrieve_chunks(query_text="consulta")
        ids = [c.chunk_id for c in resultado]
        assert "otra_u" in ids  # sin filtro entran todas las unidades
        assert "otra_kb" not in ids  # pero nunca otra versión del corpus

    def test_rag_desactivado_devuelve_vacio(self, provider, chunks):
        with override_settings(RAG_ENABLED=False):
            assert retrieve_chunks(query_text="consulta", unit="U01") == []

    def test_sin_embeddings_devuelve_vacio(self, provider, db):
        """Corpus sin embeddings (versión vigente vacía) → lista vacía."""
        assert retrieve_chunks(query_text="consulta", unit="U01") == []

    def test_provider_sin_embeddings_nunca_bloquea(self, provider, chunks):
        """Ante AIServiceError el RAG devuelve [] (fail-open)."""
        provider.error = AIServiceError("sin embeddings")
        assert retrieve_chunks(query_text="consulta", unit="U01") == []


class TestFormatChunks:
    def test_bloque_contexto_autorizado(self):
        class FakeChunk:
            def __init__(self, content):
                self.content = content

        texto = format_chunks_for_prompt([FakeChunk("Fragmento A"), FakeChunk("Fragmento B")])
        assert "<<<CONTEXTO_AUTORIZADO" in texto
        assert "[1] Fragmento A" in texto
        assert "[2] Fragmento B" in texto

    def test_sin_chunks_string_vacio(self):
        assert format_chunks_for_prompt([]) == ""
