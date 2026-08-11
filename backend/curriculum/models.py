"""
Modelos de currículo — contenido pedagógico del piloto Electromedicina II.

Mapeo 1:1 desde prisma/schema.prisma:
- Unit → Lesson → Activity → Attempt (learning)
- LearningObjective, Rubric, ActivityObjective (metadatos pedagógicos)

Lineamiento: "Módulo temático", "Módulo de aprendizaje activo".
"""
import uuid

from django.conf import settings
from django.db import models


def _cuid_default() -> str:
    """Genera un ID tipo CUID (compatibilidad con datos existentes de Prisma)."""
    return f"c{uuid.uuid4().hex[:24]}"


class TimeStampedModel(models.Model):
    """Base con created_at / updated_at."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Unit(TimeStampedModel):
    """Unidad temática del curso (ej. Bioseñales, ECG, Seguridad Eléctrica)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField("título", max_length=200)
    summary = models.CharField("resumen", max_length=500, blank=True, default="")
    description = models.TextField("descripción", blank=True, default="")
    icon = models.CharField("icono", max_length=64, default="BookOpen")
    color = models.CharField("color", max_length=32, default="sky")
    order = models.IntegerField("orden", default=0)
    content = models.TextField("contenido base (markdown)", blank=True, default="")

    class Meta:
        verbose_name = "unidad"
        verbose_name_plural = "unidades"
        ordering = ["order", "title"]

    def __str__(self) -> str:
        return self.title


class CourseConfig(models.Model):
    """Configuración global del curso (singleton: siempre pk=1).

    - ``diagnostic_questions``: preguntas del diagnóstico GENERAL del curso
      (lista de strings). Es obligatorio para estudiantes al primer uso y sus
      respuestas alimentan la adaptación por IA de cada unidad.
    - ``final_exam_questions``: preguntas de la prueba de cierre, lista de
      ``{"question": str, "options": [str, ...], "correctIndex": int}``.
    """

    diagnostic_questions = models.JSONField("preguntas del diagnóstico general", default=list)
    final_exam_questions = models.JSONField("preguntas de la prueba de cierre", default=list)
    final_exam_pass_score = models.IntegerField("puntaje mínimo de aprobación (%)", default=70)
    final_exam_max_attempts = models.IntegerField("intentos máximos de la prueba de cierre", default=3)

    class Meta:
        verbose_name = "configuración del curso"
        verbose_name_plural = "configuración del curso"

    @classmethod
    def load(cls) -> "CourseConfig":
        """Devuelve la única fila de configuración (la crea si no existe)."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return "Configuración del curso"


class Lesson(TimeStampedModel):
    """Lección dentro de una unidad."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="lessons")
    slug = models.SlugField(max_length=160)
    title = models.CharField("título", max_length=200)
    description = models.TextField("descripción", blank=True, default="")
    content = models.TextField("contenido (markdown)", blank=True, default="")
    duration_min = models.IntegerField("duración (min)", default=15)
    order = models.IntegerField("orden", default=0)
    # Borrador docente: una lección no publicada se edita en el Course Builder
    # pero no es visible para los estudiantes hasta publicarla.
    is_published = models.BooleanField("publicada", default=True)

    class Meta:
        verbose_name = "lección"
        verbose_name_plural = "lecciones"
        ordering = ["order", "title"]
        unique_together = [("unit", "slug")]
        indexes = [models.Index(fields=["unit"])]

    def __str__(self) -> str:
        return f"{self.unit.title} — {self.title}"


class Rubric(TimeStampedModel):
    """Rúbrica de evaluación para respuestas abiertas.

    ``criteria`` es un JSON con la forma:
    [{"name", "weight", "levels": [{"score", "label", "description"}]}]
    """

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rubrics"
    )
    name = models.CharField("nombre", max_length=200)
    description = models.TextField("descripción", blank=True, default="")
    criteria = models.JSONField("criterios", default=list)

    class Meta:
        verbose_name = "rúbrica"
        verbose_name_plural = "rúbricas"
        ordering = ["name"]
        indexes = [models.Index(fields=["author"])]

    def __str__(self) -> str:
        return self.name


class Activity(TimeStampedModel):
    """Actividad guiada dentro de una lección.

    Tipos (activity.type):
    - multiple_choice | guided_problem | case_analysis
    - progressive_exercise | self_assessment

    ``data`` es un JSON cuya forma depende del tipo (ver learning/grading.py).
    """

    TYPE_MULTIPLE_CHOICE = "multiple_choice"
    TYPE_GUIDED_PROBLEM = "guided_problem"
    TYPE_CASE_ANALYSIS = "case_analysis"
    TYPE_PROGRESSIVE_EXERCISE = "progressive_exercise"
    TYPE_SELF_ASSESSMENT = "self_assessment"
    TYPE_CHOICES = [
        (TYPE_MULTIPLE_CHOICE, "Selección múltiple"),
        (TYPE_GUIDED_PROBLEM, "Problema guiado"),
        (TYPE_CASE_ANALYSIS, "Análisis de caso"),
        (TYPE_PROGRESSIVE_EXERCISE, "Ejercicio progresivo"),
        (TYPE_SELF_ASSESSMENT, "Autoevaluación"),
    ]

    ASSESSMENT_DIAGNOSTIC = "diagnostic"
    ASSESSMENT_FORMATIVE = "formative"
    ASSESSMENT_SUMMATIVE = "summative"
    ASSESSMENT_SELF_REFLECTION = "self_reflection"
    ASSESSMENT_CHOICES = [
        (ASSESSMENT_DIAGNOSTIC, "Diagnóstica"),
        (ASSESSMENT_FORMATIVE, "Formativa"),
        (ASSESSMENT_SUMMATIVE, "Sumativa"),
        (ASSESSMENT_SELF_REFLECTION, "Auto-reflexión"),
    ]

    DIFFICULTY_EASY = "easy"
    DIFFICULTY_MEDIUM = "medium"
    DIFFICULTY_HARD = "hard"
    DIFFICULTY_CHOICES = [
        (DIFFICULTY_EASY, "Fácil"),
        (DIFFICULTY_MEDIUM, "Media"),
        (DIFFICULTY_HARD, "Difícil"),
    ]

    BLOOM_CHOICES = [
        ("remember", "Recordar"),
        ("understand", "Comprender"),
        ("apply", "Aplicar"),
        ("analyze", "Analizar"),
        ("evaluate", "Evaluar"),
        ("create", "Crear"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="activities")
    type = models.CharField("tipo", max_length=32, choices=TYPE_CHOICES)
    title = models.CharField("título", max_length=200)
    prompt = models.TextField("enunciado")
    data = models.JSONField("datos (opciones, respuesta, pistas...)", default=dict)
    points = models.IntegerField("puntos", default=10)
    difficulty = models.CharField("dificultad", max_length=16, choices=DIFFICULTY_CHOICES, default=DIFFICULTY_MEDIUM)
    order = models.IntegerField("orden", default=0)

    # Metadatos pedagógicos
    assessment_type = models.CharField("tipo de evaluación", max_length=24, choices=ASSESSMENT_CHOICES, default=ASSESSMENT_FORMATIVE)
    bloom_level = models.CharField("nivel Bloom", max_length=16, choices=BLOOM_CHOICES, default="apply")
    max_attempts = models.IntegerField("intentos máximos (0=ilimitado)", default=3)
    mastery_threshold = models.IntegerField("umbral de dominio (%)", default=70)
    weight = models.IntegerField("peso en la unidad", default=1)
    time_limit_min = models.IntegerField("límite de tiempo (min)", null=True, blank=True)
    rubric = models.ForeignKey(Rubric, on_delete=models.SET_NULL, null=True, blank=True, related_name="activities")

    class Meta:
        verbose_name = "actividad"
        verbose_name_plural = "actividades"
        ordering = ["order", "title"]
        indexes = [
            models.Index(fields=["lesson"]),
            models.Index(fields=["assessment_type"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.get_type_display()})"


class LearningObjective(TimeStampedModel):
    """Objetivo de aprendizaje (vinculación unit-level o lesson-level)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="objectives")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="objectives", null=True, blank=True)
    code = models.CharField("código", max_length=32)
    description = models.TextField("descripción")
    bloom_level = models.CharField("nivel Bloom", max_length=16, default="apply")

    class Meta:
        verbose_name = "objetivo de aprendizaje"
        verbose_name_plural = "objetivos de aprendizaje"
        indexes = [models.Index(fields=["unit"]), models.Index(fields=["lesson"])]

    def __str__(self) -> str:
        return f"{self.code}: {self.description[:50]}"


class ActivityObjective(models.Model):
    """Mapeo N:M entre actividad y objetivo (con peso pedagógico)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="objectives")
    objective = models.ForeignKey(LearningObjective, on_delete=models.CASCADE, related_name="activities")

    class Meta:
        verbose_name = "actividad-objetivo"
        verbose_name_plural = "actividades-objetivos"
        unique_together = [("activity", "objective")]
        indexes = [models.Index(fields=["activity"])]
