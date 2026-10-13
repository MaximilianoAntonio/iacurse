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
    "captcha",  # django-simple-captcha: captcha autoalojado del login
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
# Hashing de contraseñas (seguridad por diseño: "claves encriptadas").
# Argon2id como hasher primario (recomendación OWASP: resistente a GPU/ASIC
# por costo de memoria). Los hashers PBKDF2 quedan como fallback para verificar
# contraseñas creadas antes del cambio; Django las migra a Argon2
# automáticamente en el próximo login exitoso del usuario.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Sesiones por cookie (front React en otro origen).
# SESSION_COOKIE_AGE_DAYS: días de INACTIVIDAD antes de expirar (con
# SESSION_SAVE_EVERY_REQUEST en prod la cookie se renueva con cada request).
SESSION_COOKIE_AGE = 60 * 60 * 24 * int(os.environ.get("SESSION_COOKIE_AGE_DAYS", "7"))
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
CORS_ALLOW_HEADERS = ["content-type", "x-csrftoken", "authorization", "x-requested-with"]


# ---------------------------------------------------------------------------
# Captcha del login (anti fuerza bruta) — django-simple-captcha
# ---------------------------------------------------------------------------
# Operación matemática en imagen (autoalojada: no envía datos a terceros).
CAPTCHA_CHALLENGE_FUNCT = "captcha.helpers.math_challenge"
CAPTCHA_TIMEOUT = 5  # minutos de validez del desafío
CAPTCHA_IMAGE_SIZE = (200, 60)  # px — el default (~60x30) es demasiado pequeño
CAPTCHA_FONT_SIZE = 40
# Kill switch por entorno (los tests lo desactivan en settings/test.py)
LOGIN_CAPTCHA_ENABLED = env_bool("LOGIN_CAPTCHA_ENABLED", True)


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
    "DEFAULT_PAGINATION_CLASS": None,  # sin paginación global (parity con Next.js)
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # Rate limiting (protección contra abuso/fuerza bruta). Los scopes
    # específicos se asignan por vista (login, telemetría). En tests se
    # elevan los límites (ver config/settings/test.py).
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON", "60/minute"),
        "user": os.environ.get("THROTTLE_USER", "600/minute"),
        "login": os.environ.get("LOGIN_THROTTLE_RATE", os.environ.get("THROTTLE_LOGIN", "5/min")),
        "telemetry_events": os.environ.get("THROTTLE_TELEMETRY", "240/minute"),
        # Límite de uso de IA por usuario (hallazgo 2.18): endpoints que
        # gatillan llamadas al proveedor externo (feedback y adaptación).
        "ai": os.environ.get("AI_THROTTLE_RATE", "30/hour"),
    },
}


# ---------------------------------------------------------------------------
# IA generativa — capa abstracta configurable (lineamiento)
# ---------------------------------------------------------------------------
# settings.AI_PROVIDER: "fallback" | "openai" | "gemini"
# Hallazgo 2.3 (informe de seguridad oct-2026): la IA queda DESACTIVADA por
# defecto ("fallback", sin envío de datos a terceros) hasta regularizar la
# transferencia a proveedores externos (certificación DTIC + pronunciamiento
# del DPO). Para reactivarla: AI_PROVIDER=openai|gemini con su API key.
# Con OPENAI_BASE_URL se puede apuntar a cualquier API OpenAI-compatible
# (p. ej. Kimi/Moonshot: https://api.kimi.com/coding/v1).
AI_PROVIDER = os.environ.get("AI_PROVIDER", "fallback")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
# Si no hay API key, los servicios de IA usan fallbacks (no bloquean el piloto)
AI_FALLBACK_ENABLED = True

# CAAMI — Ciclo de Aprendizaje Adaptativo Mediado por IA (tutor/)
# CAAMI_ENABLED: activa la clasificación de error y la generación de
# andamiaje con IA. Con False (o AI_PROVIDER=fallback) las intervenciones
# usan los fallbacks pedagógicos de tutor/ai/prompts.py — el MOTOR de niveles
# (tutor/caami.py) es determinista y funciona siempre.
CAAMI_ENABLED = env_bool("CAAMI_ENABLED", True)
# RAG básico (retrieval del corpus KnowledgeChunk, similitud coseno en Python,
# sin pgvector). Desactivado por defecto: requiere corpus ingerido
# (manage.py ingest_corpus) y un provider con embeddings.
RAG_ENABLED = env_bool("RAG_ENABLED", False)
# Modelo de embeddings del provider (OpenAI: text-embedding-3-small; Gemini:
# models/text-embedding-004) y versión del corpus vigente para el retrieval.
AI_EMBEDDING_MODEL = os.environ.get("AI_EMBEDDING_MODEL", "text-embedding-3-small")
KB_VERSION = os.environ.get("KB_VERSION", "KB_v1")
RAG_TOP_K = int(os.environ.get("RAG_TOP_K", "3"))


# ---------------------------------------------------------------------------
# Telemetría (lineamiento: número de accesos, tiempo, frecuencia)
# ---------------------------------------------------------------------------
# Muestreo de AccessLog: no loguear cada asset estático ni ping de heartbeat
TELEMETRY_LOG_PATHS_EXACT = {"/api/telemetry/session/heartbeat", "/api/health"}
TELEMETRY_LOG_PATH_PREFIXES = ("/static/", "/admin/jsi18n/", "/api/telemetry/session/heartbeat")
# Umbral de alarma de uso diario (lineamiento: "sistema de alarma si sobrepasa umbral")
TELEMETRY_DAILY_USAGE_ALERT_MIN = int(os.environ.get("TELEMETRY_DAILY_USAGE_ALERT_MIN", "360"))

# Retención de registros (política de trazabilidad 2.9: 12 meses en caliente).
# ``manage.py purge_telemetry`` aplica estos plazos; el archivo en frío
# (24 meses) es responsabilidad de la operación (respaldos de la DB).
TELEMETRY_RETENTION_DAYS = int(os.environ.get("TELEMETRY_RETENTION_DAYS", "365"))
AUDIT_LOG_RETENTION_DAYS = int(os.environ.get("AUDIT_LOG_RETENTION_DAYS", "365"))

# Consentimiento informado electrónico (uso científico de datos académicos):
# versión del documento que se registra como evidencia y plazo máximo para
# retirar la autorización (fecha ISO; pasada esa fecha el retiro se rechaza).
CONSENT_VERSION = os.environ.get("CONSENT_VERSION", "2026-08-V2")
CONSENT_REVOKE_DEADLINE = os.environ.get("CONSENT_REVOKE_DEADLINE", "2026-12-11")


# ---------------------------------------------------------------------------
# Email — envío del código MFA docente (hallazgo 2.9)
# ---------------------------------------------------------------------------
# En dev/test el default es la consola (el código aparece en los logs del
# backend). En producción prod.py EXIGE SMTP real si el MFA está activo.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", "Plataforma Electromedicina II <no-reply@uv.cl>"
)

# MFA docente por código de un solo uso (OTP de 6 dígitos) enviado al email
# institucional tras validar la contraseña. Los estudiantes (anonimizados,
# sin email real) quedan exentos. Default False en dev/test; prod.py lo
# activa por defecto.
TEACHER_MFA_ENABLED = env_bool("TEACHER_MFA_ENABLED", False)
MFA_CODE_TTL_MINUTES = int(os.environ.get("MFA_CODE_TTL_MINUTES", "10"))
MFA_MAX_ATTEMPTS = int(os.environ.get("MFA_MAX_ATTEMPTS", "5"))


# ---------------------------------------------------------------------------
# Logging — salida estructurada a stdout (recolectable por Docker/gunicorn)
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        # Errores de request (5xx) y de seguridad de Django
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        # Canal de auditoría de seguridad (telemetry.audit)
        "security": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
