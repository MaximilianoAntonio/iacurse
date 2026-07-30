"""
Settings base del backend Django — Plataforma Electromedicina II.

Lineamientos (Sección 12 del proyecto): Backend Python + PostgreSQL + IA generativa.
Las configuraciones sensibles se leen de variables de entorno (ver .env.example).
"""
from pathlib import Path
import os

from dotenv import load_dotenv

# Carga .env desde backend/.env si existe (no falla si no está)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Seguridad
# ---------------------------------------------------------------------------
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-key-change-in-prod")
DEBUG = False
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0")


# ---------------------------------------------------------------------------
# Aplicaciones
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "django_filters",
]

LOCAL_APPS = [
    "accounts",
    "curriculum",
    "learning",
    "telemetry",
    "analytics",
    "tutor",
    "sandbox",
    "reports",
    "search",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


# ---------------------------------------------------------------------------
# Modelo de usuario custom (accounts.User)
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # debe ir antes de CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Telemetría: registra accesos autenticados (AccessLog, User.last_active)
    "telemetry.middleware.AccessLogMiddleware",
]


# ---------------------------------------------------------------------------
# URLs
# ---------------------------------------------------------------------------
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# ---------------------------------------------------------------------------
# Plantillas (para admin de Django)
# ---------------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ---------------------------------------------------------------------------
# Base de datos — PostgreSQL (lineamiento: PostgreSQL/MySQL)
# ---------------------------------------------------------------------------
# DATABASE_URL tiene precedencia; si no, se construye desde componentes.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    # Formato: postgres://USER:PASS@HOST:PORT/NAME
    import re

    m = re.match(r"postgres(?:ql)?://([^:]+):([^@]*)@([^:/]+)(?::(\d+))?/(.+)", DATABASE_URL)
    if m:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": m.group(5),
                "USER": m.group(1),
                "PASSWORD": m.group(2),
                "HOST": m.group(3),
                "PORT": m.group(4) or "5432",
            }
        }
    else:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": os.environ.get("POSTGRES_DB", "electromed"),
                "USER": os.environ.get("POSTGRES_USER", "electromed"),
                "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "electromed"),
                "HOST": os.environ.get("POSTGRES_HOST", "db"),
                "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            }
        }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "electromed"),
            "USER": os.environ.get("POSTGRES_USER", "electromed"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "electromed"),
            "HOST": os.environ.get("POSTGRES_HOST", "db"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }


# ---------------------------------------------------------------------------
# Autenticación (Módulo de acceso del lineamiento)
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Sesiones por cookie (front React en otro origen)
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 días
SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
SESSION_COOKIE_HTTPONLY = True

CSRF_COOKIE_SAMESITE = os.environ.get("CSRF_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", False)
# Exponer la cookie CSRF para que el frontend React pueda leerla y enviar X-CSRFToken
CSRF_COOKIE_HTTPONLY = False
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)


# ---------------------------------------------------------------------------
# CORS — frontend Next.js (http://localhost:3000 en dev)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CORS_ALLOW_CREDENTIALS = True  # necesario para cookies de sesión cross-origin
CORS_ALLOW_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["content-type", "x-csrftoken", "authorization"]


# ---------------------------------------------------------------------------
# Internacionalización
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "es-cl"
TIME_ZONE = os.environ.get("TIME_ZONE", "America/Santiago")
USE_I18N = True
USE_TZ = True


# ---------------------------------------------------------------------------
# Archivos estáticos
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Archivos subidos por docentes (imágenes del editor de contenido).
# En dev se sirven con static() desde config/urls.py; en producción deben
# servirse detrás del servidor web (Caddy/Nginx) o un storage dedicado.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": None,  # sin paginación global (parity con Next.js)
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}


# ---------------------------------------------------------------------------
# IA generativa — capa abstracta configurable (lineamiento)
# ---------------------------------------------------------------------------
# settings.AI_PROVIDER: "openai" | "gemini"
# Con OPENAI_BASE_URL se puede apuntar a cualquier API OpenAI-compatible
# (p. ej. Kimi/Moonshot: https://api.kimi.com/coding/v1).
AI_PROVIDER = os.environ.get("AI_PROVIDER", "openai")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
# Si no hay API key, los servicios de IA usan fallbacks (no bloquean el piloto)
AI_FALLBACK_ENABLED = True


# ---------------------------------------------------------------------------
# Telemetría (lineamiento: número de accesos, tiempo, frecuencia)
# ---------------------------------------------------------------------------
# Muestreo de AccessLog: no loguear cada asset estático ni ping de heartbeat
TELEMETRY_LOG_PATHS_EXACT = {"/api/telemetry/session/heartbeat", "/api/health"}
TELEMETRY_LOG_PATH_PREFIXES = ("/static/", "/admin/jsi18n/", "/api/telemetry/session/heartbeat")
# Umbral de alarma de uso diario (lineamiento: "sistema de alarma si sobrepasa umbral")
TELEMETRY_DAILY_USAGE_ALERT_MIN = int(os.environ.get("TELEMETRY_DAILY_USAGE_ALERT_MIN", "360"))
