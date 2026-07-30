"""
App tutor — capa de abstracción de IA (tutor/ai/) y servicios de
retroalimentación formativa (services.py).

Histórico: esta app alojaba el chat socrático (modelo ChatMessage y endpoint
/api/tutor), eliminado del producto. La capa tutor/ai/ se mantiene porque la
usan la retroalimentación de actividades y la personalización de unidades.
"""
import uuid


def _cuid_default() -> str:
    """Generador de PKs usado por las migraciones históricas de la app."""
    return f"c{uuid.uuid4().hex[:24]}"

