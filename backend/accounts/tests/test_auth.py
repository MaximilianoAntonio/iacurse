"""
Tests del módulo de acceso: login por identificador y cambio de contraseña.

Cubre:
- Login por código de estudiante (anonimizado) y por email de docente
- Identifier inválido / contraseña incorrecta
- Captcha del login (LOGIN_CAPTCHA_ENABLED): requerido, un solo uso, anti fuerza bruta
- Rate limit del login (ScopedRateThrottle, scope "login")
- Change-password: éxito limpia must_change_password, actual incorrecta 400,
  contraseña débil 400, requiere autenticación
"""
from datetime import timedelta

import pytest
from captcha.models import CaptchaStore
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

User = get_user_model()

STRONG_PASSWORD = "Clave-Segura-2026"


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="EM-0001",
        email="em-0001@students.local",
        password="Temporal-123",
        role=User.ROLE_STUDENT,
        student_code="EM-0001",
        name="",
        must_change_password=True,
    )


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        username="hermes.mora",
        email="hermes.mora@uv.cl",
        password="Docente-123",
        role=User.ROLE_TEACHER,
        name="Prof. Hermes Mora",
    )


@pytest.mark.django_db
class TestLogin:
    def test_login_por_codigo_estudiante(self, student):
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "EM-0001", "password": "Temporal-123"},
            format="json",
        )
        assert resp.status_code == 200
        user = resp.json()["user"]
        assert user["studentCode"] == "EM-0001"
        assert user["mustChangePassword"] is True

    def test_login_codigo_case_insensitive(self, student):
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "em-0001", "password": "Temporal-123"},
            format="json",
        )
        assert resp.status_code == 200

    def test_login_por_email_docente(self, teacher):
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "hermes.mora@uv.cl", "password": "Docente-123"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "teacher"

    def test_identifier_invalido(self, db):
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "NO-EXISTE", "password": "x"},
            format="json",
        )
        assert resp.status_code == 400
        assert "Credenciales inválidas" in str(resp.json())

    def test_password_incorrecta(self, student):
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "EM-0001", "password": "incorrecta"},
            format="json",
        )
        assert resp.status_code == 400
        assert "Credenciales inválidas" in str(resp.json())

    def test_registro_publico_eliminado(self, db):
        client = APIClient()
        resp = client.post(
            "/api/auth/register",
            {"email": "nuevo@uv.cl", "password": "X", "password2": "X"},
            format="json",
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestChangePassword:
    def test_exito_limpia_flag(self, student):
        client = APIClient()
        client.force_authenticate(user=student)
        resp = client.post(
            "/api/auth/change-password",
            {"currentPassword": "Temporal-123", "newPassword": STRONG_PASSWORD},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        student.refresh_from_db()
        assert student.must_change_password is False
        assert student.check_password(STRONG_PASSWORD)

    def test_actual_incorrecta_400(self, student):
        client = APIClient()
        client.force_authenticate(user=student)
        resp = client.post(
            "/api/auth/change-password",
            {"currentPassword": "incorrecta", "newPassword": STRONG_PASSWORD},
            format="json",
        )
        assert resp.status_code == 400
        student.refresh_from_db()
        assert student.must_change_password is True

    def test_password_debil_400(self, student):
        client = APIClient()
        client.force_authenticate(user=student)
        resp = client.post(
            "/api/auth/change-password",
            {"currentPassword": "Temporal-123", "newPassword": "123"},
            format="json",
        )
        assert resp.status_code == 400

    def test_requiere_autenticacion(self, db):
        client = APIClient()
        resp = client.post(
            "/api/auth/change-password",
            {"currentPassword": "x", "newPassword": STRONG_PASSWORD},
            format="json",
        )
        assert resp.status_code in (401, 403)

    def test_sesion_sigue_viva_tras_cambio(self, student):
        # Flujo real por cookie de sesión: tras cambiar la contraseña el
        # usuario NO debe quedar deslogueado (update_session_auth_hash).
        from django.core.cache import cache

        cache.clear()  # el login tiene rate limit (5/min) compartido entre tests
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "EM-0001", "password": "Temporal-123"},
            format="json",
        )
        assert resp.status_code == 200
        resp = client.post(
            "/api/auth/change-password",
            {"currentPassword": "Temporal-123", "newPassword": STRONG_PASSWORD},
            format="json",
        )
        assert resp.status_code == 200
        resp = client.get("/api/me")
        assert resp.status_code == 200
        assert resp.json()["user"]["mustChangePassword"] is False


def _crear_captcha(response="5"):
    """Crea un CaptchaStore válido (como lo haría /api/captcha/refresh/)."""
    return CaptchaStore.objects.create(
        challenge="2+3=",
        response=response,
        expiration=timezone.now() + timedelta(minutes=5),
    )


@pytest.fixture
def captcha_enabled(settings):
    settings.LOGIN_CAPTCHA_ENABLED = True


@pytest.mark.django_db
@pytest.mark.usefixtures("captcha_enabled")
class TestLoginCaptcha:
    """Captcha del login: obligatorio, de un solo uso y previo a las credenciales."""

    def test_login_sin_captcha_400(self, student):
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {"identifier": "EM-0001", "password": "Temporal-123"},
            format="json",
        )
        assert resp.status_code == 400
        assert "captcha" in str(resp.json()).lower()

    def test_captcha_incorrecto_no_loguea(self, student):
        store = _crear_captcha()
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {
                "identifier": "EM-0001",
                "password": "Temporal-123",
                "captchaKey": store.hashkey,
                "captchaValue": "999",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "Captcha" in str(resp.json())

    def test_captcha_expirado_400(self, student):
        store = _crear_captcha()
        store.expiration = timezone.now() - timedelta(minutes=1)
        store.save()
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {
                "identifier": "EM-0001",
                "password": "Temporal-123",
                "captchaKey": store.hashkey,
                "captchaValue": "5",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "Captcha" in str(resp.json())

    def test_captcha_correcto_login_ok(self, student):
        store = _crear_captcha()
        client = APIClient()
        resp = client.post(
            "/api/auth/login",
            {
                "identifier": "EM-0001",
                "password": "Temporal-123",
                "captchaKey": store.hashkey,
                "captchaValue": "5",
            },
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["studentCode"] == "EM-0001"

    def test_captcha_un_solo_uso(self, student):
        # El mismo captcha no debe servir dos veces (anti replay):
        # se elimina incluso cuando la respuesta es incorrecta.
        store = _crear_captcha()
        client = APIClient()
        payload = {
            "identifier": "EM-0001",
            "password": "Temporal-123",
            "captchaKey": store.hashkey,
            "captchaValue": "5",
        }
        resp = client.post("/api/auth/login", payload, format="json")
        assert resp.status_code == 200
        resp = client.post("/api/auth/login", payload, format="json")
        assert resp.status_code == 400
        assert not CaptchaStore.objects.filter(hashkey=store.hashkey).exists()


@pytest.mark.django_db
class TestLoginThrottle:
    """Rate limit del login por IP (ScopedRateThrottle, scope "login")."""

    def test_rate_limit_login_429(self, student, monkeypatch):
        cache.clear()  # historial de throttling limpio para el test
        monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "login", "2/min")
        client = APIClient()
        payload = {"identifier": "EM-0001", "password": "incorrecta"}
        for _ in range(2):
            resp = client.post("/api/auth/login", payload, format="json")
            assert resp.status_code == 400
        resp = client.post("/api/auth/login", payload, format="json")
        assert resp.status_code == 429
