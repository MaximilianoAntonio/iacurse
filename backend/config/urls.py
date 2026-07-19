"""
URLs raíz del backend Electromedicina II.

Todas las rutas de API cuelgan de /api/ para parity con el frontend Next.js
que ya llama a /api/... (cambiando solo el host base).
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    """Health check para docker-compose y Caddy."""
    return JsonResponse({"status": "ok", "service": "electromed-backend"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health, name="health"),
    # Auth (Módulo de acceso del lineamiento)
    path("api/", include("accounts.urls")),
    path("api/", include("curriculum.urls")),
    path("api/", include("learning.urls")),
    path("api/", include("telemetry.urls")),
    path("api/", include("analytics.urls")),
    path("api/", include("tutor.urls")),
    path("api/", include("sandbox.urls")),
    path("api/", include("reports.urls")),
    path("api/", include("search.urls")),
]
