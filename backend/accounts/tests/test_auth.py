"""
Tests del módulo de acceso: login por identificador y cambio de contraseña.

Cubre:
- Login por código de estudiante (anonimizado) y por email de docente
- Identifier inválido / contraseña incorrecta
- Change-password: éxito limpia must_change_password, actual incorrecta 400,
  contraseña débil 400, requiere autenticación
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

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
