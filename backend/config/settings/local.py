"""Settings local para pruebas sin Docker (SQLite archivo)."""
from .dev import *  # noqa: F401,F403

import os

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.path.join(BASE_DIR, "db.sqlite3"),  # noqa: F405
    }
}
