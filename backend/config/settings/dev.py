"""Settings de desarrollo."""
from .base import *  # noqa: F401,F403

DEBUG = True

# En dev permitimos el navegador DRF para inspección
REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]
