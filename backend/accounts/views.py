"""
Vistas de cuentas — Módulo de acceso del lineamiento.

Endpoints:
- GET    /api/auth/csrf       — token CSRF para el frontend React
- POST   /api/auth/register   — registro de estudiantes
- POST   /api/auth/login      — login (cookie de sesión)
- POST   /api/auth/logout     — logout
- GET    /api/me              — usuario actual
- GET    /api/users           — lista de usuarios (para selector/switcher)
- PATCH  /api/user/weekly-goal — actualiza meta semanal
"""
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status, views
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import (
    LoginSerializer,
    RegisterSerializer,
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
    }


class CsrfTokenView(views.APIView):
    """GET /api/auth/csrf — devuelve el token CSRF para el frontend React.

    El frontend debe llamar este endpoint antes de cualquier POST/PATCH/DELETE
    y enviar el token en el header X-CSRFToken.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(views.APIView):
    """Registro de nuevos estudiantes."""

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Log in automáticamente tras registro (UX del piloto)
        login(request, user)
        return Response({"user": _serialize_user(user)}, status=status.HTTP_201_CREATED)


class LoginView(views.APIView):
    """Login por email + password. Crea sesión Django (cookie)."""

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


class MeView(views.APIView):
    """Usuario actual.

    Mantiene compatibilidad con el frontend Next.js que llama /api/me?userId=...
    Si no hay sesión y se pasa ?userId=, devuelve ese usuario (modo demo/switcher).
    Si no hay nada, devuelve el primer estudiante (parity con Next.js).
    """

    permission_classes = [AllowAny]  # allowAny para preservar UX de demo

    def get(self, request):
        user = request.user if request.user.is_authenticated else None

        # Modo demo/switcher: ?userId=<id> explícito
        explicit_id = request.query_params.get("userId")
        if explicit_id:
            try:
                user = User.objects.get(pk=explicit_id)
            except User.DoesNotExist:
                user = None

        # Fallback: primer estudiante (parity con Next.js me/route.ts)
        if user is None:
            user = User.objects.filter(role=User.ROLE_STUDENT).order_by("created_at").first()

        if user is None:
            return Response({"user": None})

        return Response({"user": _serialize_user(user)})


class UsersView(views.APIView):
    """Lista todos los usuarios (para el selector/switcher de usuario del header)."""

    permission_classes = [AllowAny]

    def get(self, request):
        users = User.objects.all().order_by("role", "name")
        return Response({"users": [_serialize_user(u) for u in users]})


class WeeklyGoalView(views.APIView):
    """Actualiza la meta semanal de estudio del usuario autenticado."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WeeklyGoalSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"ok": True, "weeklyGoalMin": request.user.weekly_goal_min})
