"""Settings de producción — más estrictos en seguridad."""
import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import env_bool

DEBUG = False

# La clave de desarrollo es pública (está en el repo): prohibida en producción.
if SECRET_KEY == "dev-insecure-key-change-in-prod":  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY no configurada: en producción debes definir una clave "
        "única en el entorno (genera una con `python -c \"import secrets; "
        "print(secrets.token_urlsafe(64))\"`)."
    )

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

# Cabeceras de seguridad de transporte (SecurityMiddleware). Inactivas por
# defecto porque el piloto puede ir por HTTP plano; ACTIVAR junto con TLS:
#   SECURE_SSL_REDIRECT=1
#   SECURE_HSTS_SECONDS=31536000   # 1 año, solo con HTTPS ya funcionando
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
if SECURE_SSL_REDIRECT:
    # El healthcheck interno de Docker (curl http://localhost:8000/api/health)
    # no pasa por el proxy TLS: eximirlo o el redirect a HTTPS lo rompe.
    SECURE_REDIRECT_EXEMPT = [r"^api/health$"]
SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "0"))
if SECURE_HSTS_SECONDS > 0:
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)

# WhiteNoise: gunicorn no sirve archivos estáticos; sin esto el admin de
# Django y los assets de DRF quedan sin CSS/JS en producción.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
