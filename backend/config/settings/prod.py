"""Settings de producción — más estrictos en seguridad."""
from .base import *  # noqa: F401,F403
from .base import env_bool

DEBUG = False

# Cookies seguras por defecto (despliegue detrás de HTTPS).
# Si el piloto se despliega por HTTP plano (sin TLS), definir en el .env:
#   SESSION_COOKIE_SECURE=0
#   CSRF_COOKIE_SECURE=0
#   SESSION_COOKIE_SAMESITE=Lax
#   CSRF_COOKIE_SAMESITE=Lax
# Ojo: los navegadores rechazan cookies SameSite=None sin Secure.
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", True)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", True)
SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "None")  # noqa: F405
CSRF_COOKIE_SAMESITE = os.environ.get("CSRF_COOKIE_SAMESITE", "None")  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# WhiteNoise: gunicorn no sirve archivos estáticos; sin esto el admin de
# Django y los assets de DRF quedan sin CSS/JS en producción.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
