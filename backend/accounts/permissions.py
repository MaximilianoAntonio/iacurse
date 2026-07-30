"""Permisos DRF compartidos del proyecto.

Por defecto todos los endpoints exigen ``IsAuthenticated`` (ver
``REST_FRAMEWORK`` en config/settings/base.py). Las rutas de gestión de
contenido (Course Builder, currículo admin, moderación de reportes) son
además exclusivas de docentes.
"""
from rest_framework.permissions import BasePermission


class IsTeacher(BasePermission):
    """Solo usuarios con rol docente (``user.is_teacher``)."""

    message = "Solo los docentes pueden realizar esta acción."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_teacher
        )
