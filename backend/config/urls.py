"""
URLs raíz del backend Electromedicina II.

Todas las rutas de API cuelgan de /api/ para parity con el frontend Next.js
que ya llama a /api/... (cambiando solo el host base).
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve


def health(_request):
    """Health check para docker-compose y Caddy."""
    return JsonResponse({"status": "ok", "service": "electromed-backend"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    # Auth (Módulo de acceso del lineamiento)
    path("api/", include("accounts.urls")),
    # Captcha del login (django-simple-captcha: /api/captcha/refresh/, image/<key>/)
    path("api/captcha/", include("captcha.urls")),
    path("api/", include("curriculum.urls")),
    path("api/", include("learning.urls")),
    path("api/", include("telemetry.urls")),
    path("api/", include("analytics.urls")),
    path("api/", include("sandbox.urls")),
    path("api/", include("reports.urls")),
    path("api/", include("search.urls")),
    # Consentimiento informado: rutas en learning.urls (/api/course/consent[/revoke])
]

# Servir archivos subidos (imágenes del editor docente).
# En desarrollo static() los expone automáticamente; en producción se sirven
# desde Django/gunicorn (detrás de Caddy cuando se usa docker-compose.tls.yml).
# A la escala del piloto es suficiente.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
