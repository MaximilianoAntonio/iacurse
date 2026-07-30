"""
App sandbox (Course Builder) — sin modelos propios.

Histórico: alojaba los modelos del flujo sandbox de cursos (Course, CourseUnit,
CourseLesson, QuestionBank, Question, DataResource), eliminado del producto.
El Course Builder opera directamente sobre el currículo live (curriculum.*)
vía los endpoints /api/admin/*.
"""
import uuid


def _cuid_default() -> str:
    """Generador de PKs usado por las migraciones históricas de la app."""
    return f"c{uuid.uuid4().hex[:24]}"

