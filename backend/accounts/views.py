"""
Vistas de cuentas — Módulo de acceso del lineamiento.

Endpoints:
- GET    /api/auth/csrf            — token CSRF para el frontend React
- POST   /api/auth/login           — login (cookie de sesión)
- POST   /api/auth/logout          — logout
- POST   /api/auth/change-password — cambio de contraseña (obligatorio con flag)
- GET    /api/me                   — usuario actual
- GET    /api/users                — lista de usuarios (solo docentes)
- PATCH  /api/user/weekly-goal     — actualiza meta semanal

El registro público fue eliminado: el docente crea las cuentas de
estudiantes (ver ``accounts/admin_views.py``).
"""
from django.contrib.auth import get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import views
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .permissions import IsTeacher
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    UserSerializer,
    WeeklyGoalSerializer,
)

User = get_user_model()


def _serialize_user(user):
    """Serializa un usuario a dict plano (incluye last_active como ISO)."""
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "avatar": user.avatar or "",
        "points": user.points,
        "streak": user.streak,
        "weeklyGoalMin": user.weekly_goal_min,
        "lastActive": user.last_active.isoformat() if user.last_active else None,
        "studentCode": user.student_code or None,
        "mustChangePassword": user.must_change_password,
    }


def _serialize_student_public(user):
    """Proyección anonimizada de un estudiante (sin email ni nombre real)."""
    return {
        "id": user.id,
        "studentCode": user.student_code,
        "role": user.role,
        "points": user.points,
        "streak": user.streak,
        "lastActive": user.last_active.isoformat() if user.last_active else None,
        "mustChangePassword": user.must_change_password,
    }


class CsrfTokenView(views.APIView):
    """GET /api/auth/csrf — devuelve el token CSRF para el frontend React.

    El frontend debe llamar este endpoint antes de cualquier POST/PATCH/DELETE
    y enviar el token en el header X-CSRFToken.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(views.APIView):
    """Login por identificador (email docente o código estudiante) + password."""

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        # last_active se actualiza vía middleware, pero forzamos en login
        User.objects.filter(pk=user.pk).update(last_active=timezone.now())
        return Response({"user": _serialize_user(user)})


class LogoutView(views.APIView):
    """Cierra la sesión."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"ok": True})


class ChangePasswordView(views.APIView):
    """Cambio de contraseña del usuario autenticado.

    Limpia el flag ``must_change_password``: es la vía para salir del cambio
    obligatorio tras el primer login o un reset del docente.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["newPassword"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password", "updated_at"])
        return Response({"ok": True})


class MeView(views.APIView):
    """Usuario actual (sesión requerida).

    Devuelve el usuario autenticado por la cookie de sesión de Django.
    No hay modo demo: el acceso a la plataforma requiere login real.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": _serialize_user(request.user)})


class UsersView(views.APIView):
    """Lista usuarios para el panel docente (exclusivo de docentes).

    Los estudiantes se devuelven anonimizados (sin email ni nombre real);
    los docentes van completos.
    """

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        users = User.objects.all().order_by("role", "name")
        return Response({
            "users": [
                _serialize_user(u) if u.is_teacher else _serialize_student_public(u)
                for u in users
            ]
        })


class WeeklyGoalView(views.APIView):
    """Actualiza la meta semanal de estudio del usuario autenticado."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WeeklyGoalSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"ok": True, "weeklyGoalMin": request.user.weekly_goal_min})
