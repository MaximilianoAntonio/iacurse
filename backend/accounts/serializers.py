"""
Serializers de cuentas — login, cambio de contraseña, perfil.

Módulo de acceso del lineamiento. El registro público fue eliminado: el
docente crea las cuentas de estudiantes (ver ``accounts/admin_views.py``).
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    """Login por identificador + password (sesión Django por cookie).

    El ``identifier`` es el correo institucional del docente o el código
    anonimizado del estudiante (si contiene ``@`` se busca por email, si no
    por ``student_code``).
    """

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        identifier = attrs.get("identifier", "").strip()
        password = attrs.get("password", "")

        if "@" in identifier:
            lookup = {"email__iexact": identifier.lower()}
        else:
            lookup = {"student_code__iexact": identifier}

        try:
            user = User.objects.get(**lookup)
        except User.DoesNotExist:
            raise serializers.ValidationError({"identifier": "Credenciales inválidas."})

        # check_password directo (USERNAME_FIELD=email, authenticate espera email kwarg)
        if not user.check_password(password):
            raise serializers.ValidationError({"password": "Credenciales inválidas."})
        if not user.is_active:
            raise serializers.ValidationError("Cuenta desactivada.")
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """Cambio de contraseña (obligatorio tras el primer login o un reset)."""

    currentPassword = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )
    newPassword = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    def validate_currentPassword(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def validate_newPassword(self, value: str) -> str:
        # Validadores de Django (longitud mínima, contraseñas comunes, etc.)
        validate_password(value, user=self.context["request"].user)
        return value
