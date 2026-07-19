"""
Settings para tests automatizados.

Usa SQLite en memoria para velocidad y aislamiento (no requiere Postgres).
La configuración de producción/base sigue apuntando a PostgreSQL, que es lo
que exige el lineamiento. Los tests unitarios de lógica (grading, badges,
streak) no dependen del motor de DB, así que SQLite es suficiente y portátil.
"""
from .dev import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Desactivar middleware de telemetría en tests unitarios (se prueba por separado)
MIDDLEWARE = [m for m in MIDDLEWARE if "telemetry.middleware" not in m]  # noqa: F405

# Desactivar IA real en tests (usar fallbacks)
AI_PROVIDER = "fallback"

# Password hashing rápido para tests
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
