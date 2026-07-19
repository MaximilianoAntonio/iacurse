"""
Serializers de cuentas — login, registro, perfil.

Módulo de acceso del lineamiento: "registro y autenticación de estudiantes".
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serialización pública del usuario (para /me, /users, panel docente)."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "role",
            "avatar",
            "points",
            "streak",
            "weekly_goal_min",
            "last_active",
        ]
        read_only_fields = ["id", "points", "streak", "last_active"]


class LoginSerializer(serializers.Serializer):
    """Login por email + password (sesión Django por cookie)."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password", "")

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "Credenciales inválidas."})

        # check_password directo (USERNAME_FIELD=email, authenticate espera email kwarg)
        if not user.check_password(password):
            raise serializers.ValidationError({"password": "Credenciales inválidas."})
        if not user.is_active:
            raise serializers.ValidationError("Cuenta desactivada.")
        attrs["user"] = user
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    """Registro de nuevos estudiantes (rol student por defecto)."""

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password],
        style={"input_type": "password"},
    )
    password2 = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"},
        label="Confirmar contraseña",
    )

    class Meta:
        model = User
        fields = ["email", "name", "password", "password2"]
        extra_kwargs = {"name": {"required": False}}

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value.strip().lower()

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("password2"):
            raise serializers.ValidationError({"password2": "Las contraseñas no coinciden."})
        return attrs

    def create(self, validated_data: dict) -> User:
        validated_data.pop("password2")
        password = validated_data.pop("password")
        email = validated_data["email"]
        # username derivado del email (Django lo requiere, pero login es por email)
        username = email.split("@")[0]
        # Evitar colisión de username
        base, n = username, 1
        while User.objects.filter(username=username).exists():
            n += 1
            username = f"{base}{n}"
        user = User(username=username, role=User.ROLE_STUDENT, **validated_data)
        user.set_password(password)
        user.save()
        return user


class WeeklyGoalSerializer(serializers.ModelSerializer):
    """Actualización de la meta semanal de estudio."""

    class Meta:
        model = User
        fields = ["weekly_goal_min"]

    def validate_weekly_goal_min(self, value: int) -> int:
        if not (30 <= value <= 1200):
            raise serializers.ValidationError("La meta debe estar entre 30 y 1200 minutos.")
        return value
