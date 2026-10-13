"""
Comando de ingesta del corpus de conocimiento para el RAG de CAAMI.

Recorre archivos .md/.txt de un directorio, los fragmenta por encabezados
Markdown y párrafos (chunking semántico), genera embeddings con el provider
de IA configurado y hace upsert de KnowledgeChunk por chunk_id.

Uso:
    python manage.py ingest_corpus <directorio> [--unit U01] [--topic "..."]
        [--document-id ID] [--document-version 1] [--kb-version KB_v1]
        [--max-chunk-chars 1200]
"""
import logging
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from tutor.ai.base import AIServiceError
from tutor.ai.factory import get_ai_provider
from tutor.models import KnowledgeChunk

logger = logging.getLogger(__name__)

# Lotes de embeddings por llamada (evita payloads excesivos al provider).
_EMBED_BATCH_SIZE = 32


def _split_semantic_chunks(text: str, max_chars: int) -> list:
    """Fragmenta por encabezados Markdown y párrafos (chunking semántico).

    Agrupa secciones completas mientras quepan en max_chars; una sección que
    supere el límite se divide por párrafos y, en último término, por corte
    duro de caracteres.
    """
    # Separar por encabezados Markdown conservándolos al inicio de su sección
    sections = re.split(r"(?=^#{1,6}\s)", text, flags=re.MULTILINE)
    chunks: list = []
    current = ""

    def flush():
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for section in sections:
        section = section.strip("\n")
        if not section.strip():
            continue
        if len(section) > max_chars:
            # Sección larga: cerrar lo acumulado y dividir por párrafos
            flush()
            for paragraph in re.split(r"\n\s*\n", section):
                paragraph = paragraph.strip()
                if not paragraph:
                    continue
                while len(paragraph) > max_chars:
                    chunks.append(paragraph[:max_chars].strip())
                    paragraph = paragraph[max_chars:]
                if len(current) + len(paragraph) + 2 <= max_chars:
                    current = f"{current}\n\n{paragraph}" if current else paragraph
                else:
                    flush()
                    current = paragraph
        elif len(current) + len(section) + 2 <= max_chars:
            current = f"{current}\n\n{section}" if current else section
        else:
            flush()
            current = section
    flush()
    return chunks


class Command(BaseCommand):
    help = "Ingesta el corpus de conocimiento del RAG (fragmenta + embebe + upsert)."

    def add_arguments(self, parser):
        parser.add_argument("directory", help="Directorio con archivos .md/.txt")
        parser.add_argument("--unit", default="", help="Código de unidad (p. ej. U01)")
        parser.add_argument("--topic", default="", help="Tópico del corpus")
        parser.add_argument("--document-id", default="", help="ID del documento (default: nombre de archivo)")
        parser.add_argument("--document-version", default="1", help="Versión del documento")
        parser.add_argument("--kb-version", default=None, help="Versión del corpus (default: settings.KB_VERSION)")
        parser.add_argument("--max-chunk-chars", type=int, default=1200, help="Tamaño máximo de fragmento")

    def handle(self, *args, **options):
        directory = Path(options["directory"])
        if not directory.is_dir():
            raise CommandError(f"Directorio no encontrado: {directory}")

        files = sorted(
            p for p in directory.rglob("*") if p.suffix.lower() in (".md", ".txt")
        )
        if not files:
            raise CommandError(f"No hay archivos .md/.txt en {directory}")

        provider = get_ai_provider()
        kb_version = options["kb_version"] or getattr(settings, "KB_VERSION", "KB_v1")
        max_chars = options["max_chunk_chars"]

        created_count = 0
        updated_count = 0
        pending: list = []  # chunks a embeber (dicts con datos + content)

        for path in files:
            document_id = options["document_id"] or path.stem
            text = path.read_text(encoding="utf-8")
            for seq, content in enumerate(_split_semantic_chunks(text, max_chars), start=1):
                pending.append(
                    {
                        "chunk_id": f"{document_id}_{seq:04d}",
                        "document_id": document_id,
                        "content": content,
                    }
                )

        if not pending:
            self.stdout.write(self.style.WARNING("No se generaron fragmentos."))
            return

        # Embeddings en lotes; si el provider no los soporta, abortar con
        # mensaje claro (sin dejar chunks sin embedding).
        embeddings: list = []
        try:
            for start in range(0, len(pending), _EMBED_BATCH_SIZE):
                batch = [c["content"] for c in pending[start:start + _EMBED_BATCH_SIZE]]
                embeddings.extend(provider.embed(batch))
        except AIServiceError as e:
            raise CommandError(
                f"El provider de IA configurado no soporta embeddings: {e}. "
                "Configura un provider con embeddings (OPENAI_API_KEY / GEMINI_API_KEY)."
            ) from e

        for chunk, embedding in zip(pending, embeddings):
            _, created = KnowledgeChunk.objects.update_or_create(
                chunk_id=chunk["chunk_id"],
                defaults={
                    "kb_version": kb_version,
                    "unit": options["unit"],
                    "topic": options["topic"],
                    "document_id": chunk["document_id"],
                    "document_version": options["document_version"],
                    "content": chunk["content"],
                    "embedding": embedding,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        message = (
            f"Ingesta completa: {created_count} fragmentos creados, "
            f"{updated_count} actualizados (kb_version={kb_version})."
        )
        logger.info(message)
        self.stdout.write(self.style.SUCCESS(message))
