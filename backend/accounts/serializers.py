"""
Serializers de cuentas — login, cambio de contraseña, perfil.

Módulo de acceso del lineamiento. El registro público fue eliminado: el
docente crea las cuentas de estudiantes (ver ``accounts/admin_views.py``).
"""
from captcha.models import CaptchaStore
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

User = get_user_model()


def validate_captcha(captcha_key: str, captcha_value: str) -> None:
    """Verifica el captcha del login contra CaptchaStore (un solo uso).

    El registro se elimina siempre tras el intento (éxito o fallo) para
    evitar ataques de replay. El frontend pide uno nuevo vía
    ``GET /api/captcha/refresh/`` después de cada intento.
    """
    try:
        store = CaptchaStore.objects.get(hashkey=captcha_key)
    except CaptchaStore.DoesNotExist:
        raise serializers.ValidationError({"captchaValue": "Captcha incorrecto o expirado."})
    store.delete()  # un solo uso, se valide o no
    if store.expiration < timezone.now() or store.response != captcha_value.strip().lower():
        raise serializers.ValidationError({"captchaValue": "Captcha incorrecto o expirado."})


class LoginSerializer(serializers.Serializer):
    """Login por identificador + password (sesión Django por cookie).

    El ``identifier`` es el correo institucional del docente o el código
    anonimizado del estudiante (si contiene ``@`` se busca por email, si no
    por ``student_code``).

    Exige captcha (``captchaKey``/``captchaValue``, ver
    ``POST /api/captcha/refresh/``) cuando ``LOGIN_CAPTCHA_ENABLED`` está
    activo, como defensa contra fuerza bruta.
    """

    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    captchaKey = serializers.CharField(required=False, allow_blank=True, write_only=True)
    captchaValue = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs):
        if settings.LOGIN_CAPTCHA_ENABLED:
            captcha_key = attrs.get("captchaKey", "")
            captcha_value = attrs.get("captchaValue", "")
            if not captcha_key or not captcha_value:
                raise serializers.ValidationError(
                    {"captchaValue": "Debes resolver el captcha."}
                )
            validate_captcha(captcha_key, captcha_value)

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
