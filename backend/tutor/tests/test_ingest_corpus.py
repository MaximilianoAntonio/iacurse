"""
Tests del comando de ingesta del corpus RAG (tutor/management/commands).

Directorio temporal con 2 archivos .md y provider mock de embeddings:
verifica chunking, chunk_id, metadata, embedding y upsert idempotente.
"""
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from tutor.ai.base import AIServiceError
from tutor.models import KnowledgeChunk


class EmbedProviderMock:
    """Embeddings sintéticos: un vector derivado del largo del texto."""

    def embed(self, texts):
        return [[float(len(t)), 1.0] for t in texts]


class SinEmbeddingsProviderMock:
    def embed(self, texts):
        raise AIServiceError("No AI provider configured")


@pytest.fixture
def corpus(tmp_path):
    """Dos documentos Markdown con encabezados y párrafos."""
    (tmp_path / "bioseñales.md".encode("utf-8").decode("unicode_escape") if False else tmp_path / "biosenales.md").write_text(
        "# Bioseñales\n\n"
        "Las bioseñales son señales eléctricas del cuerpo humano.\n\n"
        "## ECG\n\n"
        "El electrocardiograma registra la actividad eléctrica cardíaca.\n\n"
        "## EMG\n\n"
        "El electromiograma registra la actividad muscular.\n",
        encoding="utf-8",
    )
    (tmp_path / "seguridad.txt").write_text(
        "La seguridad eléctrica en equipos médicos es normativa.\n\n"
        "La norma IEC 60601 regula los equipos electromédicos.\n",
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture
def provider(monkeypatch):
    p = EmbedProviderMock()
    monkeypatch.setattr(
        "tutor.management.commands.ingest_corpus.get_ai_provider", lambda: p
    )
    return p


@pytest.mark.django_db
class TestIngestCorpus:
    def test_crea_chunks_con_metadata_y_embedding(self, corpus, provider):
        call_command("ingest_corpus", str(corpus), unit="U01", topic="Bioseñales", kb_version="KB_test")
        chunks = KnowledgeChunk.objects.all()
        assert chunks.count() >= 3  # biosenales.md se fragmenta por secciones
        for chunk in chunks:
            assert chunk.kb_version == "KB_test"
            assert chunk.unit == "U01"
            assert chunk.topic == "Bioseñales"
            assert chunk.embedding  # lista de floats no vacía
            assert chunk.content.strip()
        # chunk_id = {document_id}_{seq:04d}
        assert KnowledgeChunk.objects.filter(chunk_id="biosenales_0001").exists()
        assert KnowledgeChunk.objects.filter(chunk_id="seguridad_0001").exists()

    def test_upsert_idempotente(self, corpus, provider):
        """Re-ejecutar la ingesta actualiza en lugar de duplicar."""
        call_command("ingest_corpus", str(corpus), unit="U01", kb_version="KB_test")
        total = KnowledgeChunk.objects.count()
        call_command("ingest_corpus", str(corpus), unit="U02", kb_version="KB_test")
        assert KnowledgeChunk.objects.count() == total
        assert set(KnowledgeChunk.objects.values_list("unit", flat=True)) == {"U02"}

    def test_max_chunk_chars_configurable(self, corpus, provider):
        call_command("ingest_corpus", str(corpus), max_chunk_chars=80, kb_version="KB_test")
        assert all(len(c.content) <= 80 for c in KnowledgeChunk.objects.all())

    def test_sin_provider_de_embeddings_aborta(self, corpus, monkeypatch):
        monkeypatch.setattr(
            "tutor.management.commands.ingest_corpus.get_ai_provider",
            lambda: SinEmbeddingsProviderMock(),
        )
        with pytest.raises(CommandError, match="embeddings"):
            call_command("ingest_corpus", str(corpus), kb_version="KB_test")
        # Sin chunks a medio ingerir
        assert KnowledgeChunk.objects.count() == 0

    def test_directorio_inexistente_aborta(self, provider):
        with pytest.raises(CommandError, match="no encontrado"):
            call_command("ingest_corpus", "ruta/que/no/existe", kb_version="KB_test")
