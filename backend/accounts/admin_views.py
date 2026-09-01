"""
Gestión de estudiantes por el docente (cuentas anonimizadas).

El docente crea cuentas en lote a partir de códigos asignados externamente
y resetea contraseñas manualmente. Las contraseñas temporales se generan en
el servidor y se muestran UNA sola vez en la respuesta; el estudiante está
obligado a cambiarla en su próximo inicio de sesión
(``must_change_password=True``).

Endpoints (todos exclusivos de docentes, ``IsTeacher``):
- GET  /api/admin/students                      — lista estudiantes por código
- POST /api/admin/students                      — creación en lote (máx. 200)
- POST /api/admin/students/<id>/reset-password  — nueva contraseña temporal
"""
import secrets
import string

from django.contrib.auth import get_user_model
from rest_framework import status, views
from rest_framework.response import Response

from telemetry.audit import log_security_event

from .permissions import IsTeacher

User = get_user_model()

# Máximo de cuentas por llamada de creación en lote
MAX_BULK_CREATE = 200

# Alfabeto de contraseñas temporales: sin caracteres ambiguos (l/1/I, O/0)
_TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_temporary_password(length: int = 11) -> str:
    """Contraseña temporal aleatoria y legible (letras + dígitos, 10-12 chars).

    Garantiza al menos una minúscula, una mayúscula y un dígito para pasar
    los validadores habituales, sin caracteres ambiguos (l/1/I/O/0).
    """
    while True:
        pwd = "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))
        if (
            any(c in string.ascii_lowercase for c in pwd)
            and any(c in string.ascii_uppercase for c in pwd)
            and any(c in string.digits for c in pwd)
        ):
            return pwd


def _serialize_student_admin(user):
    """Fila de la tabla de gestión de estudiantes (panel docente)."""
    return {
        "id": user.id,
        "studentCode": user.student_code,
        "mustChangePassword": user.must_change_password,
        "lastActive": user.last_active.isoformat() if user.last_active else None,
        "createdAt": user.created_at.isoformat(),
        "points": user.points,
        "streak": user.streak,
    }


class StudentsAdminView(views.APIView):
    """GET/POST /api/admin/students — lista y creación en lote de estudiantes."""

    permission_classes = [IsTeacher]

    def get(self, request):
        students = (
            User.objects.filter(role=User.ROLE_STUDENT)
            .order_by("student_code")
        )
        return Response({"students": [_serialize_student_admin(s) for s in students]})

    def post(self, request):
        codes = request.data.get("codes")
        if not isinstance(codes, list) or not codes:
            return Response(
                {"error": "Se esperaba una lista no vacía de códigos en 'codes'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(codes) > MAX_BULK_CREATE:
            return Response(
                {"error": f"Máximo {MAX_BULK_CREATE} códigos por llamada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalizar y validar formato básico
        normalized = []
        errors = []
        for raw in codes:
            code = str(raw).strip() if raw is not None else ""
            if not code:
                errors.append({"studentCode": raw, "error": "Código vacío."})
            elif len(code) > 32:
                errors.append(
                    {"studentCode": code, "error": "El código excede 32 caracteres."}
                )
            else:
                normalized.append(code)

        # Duplicados dentro del payload (case-insensitive)
        seen = set()
        unique_codes = []
        for code in normalized:
            key = code.lower()
            if key in seen:
                errors.append(
                    {"studentCode": code, "error": "Código duplicado en la lista."}
                )
            else:
                seen.add(key)
                unique_codes.append(code)

        # Duplicados contra la DB
        existing = set(
            code.lower()
            for code in User.objects.filter(
                student_code__in=unique_codes
            ).values_list("student_code", flat=True)
        )
        created = []
        for code in unique_codes:
            if code.lower() in existing:
                errors.append({"studentCode": code, "error": "El código ya existe."})
                continue
            temp_password = generate_temporary_password()
            user = User(
                username=code,
                student_code=code,
                # Email placeholder único y no identificable (el modelo lo exige)
                email=f"{code.lower()}@students.local",
                name="",
                role=User.ROLE_STUDENT,
                must_change_password=True,
            )
            user.set_password(temp_password)
            user.save()
            created.append(
                {"studentCode": code, "temporaryPassword": temp_password}
            )
            log_security_event(
                "student_created", actor=request.user, request=request, target=code
            )

        return Response(
            {"created": created, "errors": errors},
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )


class StudentResetPasswordView(views.APIView):
    """POST /api/admin/students/<id>/reset-password — nueva contraseña temporal."""

    permission_classes = [IsTeacher]

    def post(self, request, user_id):
        try:
            student = User.objects.get(pk=user_id, role=User.ROLE_STUDENT)
        except User.DoesNotExist:
            return Response(
                {"error": "Estudiante no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        temp_password = generate_temporary_password()
        student.set_password(temp_password)
        student.must_change_password = True
        student.save(update_fields=["password", "must_change_password", "updated_at"])
        log_security_event(
            "password_reset_admin",
            actor=request.user,
            request=request,
            target=student.student_code or str(student.pk),
        )
        return Response(
            {
                "studentCode": student.student_code,
                "temporaryPassword": temp_password,
            }
        )
