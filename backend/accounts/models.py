"""
Modelos de cuentas — Módulo de acceso del lineamiento.

Custom User model que extiende AbstractUser añadiendo los campos pedagógicos
del schema Prisma original (role, points, streak, weeklyGoalMin, lastActive, avatar).

Lineamiento (Sección 12): "Módulo de acceso: registro y autenticación de estudiantes."
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Usuario de la plataforma: estudiante o docente.

    Extiende AbstractUser (email/password/sessions de Django) con los campos
    de gamificación y seguimiento del piloto. El ``username`` heredado se
    conserva para el admin; el login se hace por ``email``.
    """

    ROLE_STUDENT = "student"
    ROLE_TEACHER = "teacher"
    ROLE_CHOICES = [
        (ROLE_STUDENT, "Estudiante"),
        (ROLE_TEACHER, "Docente"),
    ]

    # El email es el identificador de login del docente (lineamiento: @uv.cl).
    # Los estudiantes usan un email placeholder no identificable (<code>@students.local).
    email = models.EmailField("correo electrónico", unique=True)

    # Código anonimizado asignado externamente (identificador de login del
    # estudiante). Solo los estudiantes lo tienen; los docentes entran por email.
    student_code = models.CharField(
        "código de estudiante", max_length=32, unique=True, null=True, blank=True
    )

    # Fuerza el cambio de contraseña en el próximo inicio de sesión (cuentas
    # nuevas y resets del docente usan una contraseña temporal).
    must_change_password = models.BooleanField("debe cambiar contraseña", default=False)

    # display name (ej. "Hermes Mora"; vacío o neutral para estudiantes anonimizados)
    name = models.CharField("nombre", max_length=200, blank=True)

    role = models.CharField(
        "rol", max_length=16, choices=ROLE_CHOICES, default=ROLE_STUDENT
    )
    avatar = models.CharField("avatar", max_length=255, blank=True, default="")

    # --- Gamificación y seguimiento (parity con Prisma User) ---
    points = models.IntegerField("puntos", default=0)
    streak = models.IntegerField("racha (días)", default=0)
    weekly_goal_min = models.IntegerField(
        "meta semanal de estudio (min)", default=180
    )
    last_active = models.DateTimeField("última actividad", null=True, blank=True)

    # Fechas de auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Login por email en lugar de username
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]  # createsuperuser aún los pide

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["role", "name"]

    def __str__(self) -> str:
        return self.name or self.email

    @property
    def is_student(self) -> bool:
        return self.role == self.ROLE_STUDENT

    @property
    def is_teacher(self) -> bool:
        return self.role == self.ROLE_TEACHER

    def save(self, *args, **kwargs):
        # Si no se setea name, usar el username/email como fallback
        if not self.name:
            self.name = self.username or self.email.split("@")[0]
        super().save(*args, **kwargs)
