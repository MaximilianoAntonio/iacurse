"""
Modelos del sandbox docente — creación de cursos (Course Builder).

Mapeo 1:1 desde prisma/schema.prisma:
- Course → CourseUnit → CourseLesson → Question
- QuestionBank → Question
- DataResource

La publicación (publishToCurriculum) clona estos modelos sandbox a los modelos
"live" (curriculum.Unit/Lesson/Activity) con slug prefix sc-<courseId>.
"""
import uuid

from django.conf import settings
from django.db import models


def _cuid_default() -> str:
    return f"c{uuid.uuid4().hex[:24]}"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Course(TimeStampedModel):
    """Curso creado por el docente en el sandbox."""

    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Borrador"),
        (STATUS_PUBLISHED, "Publicado"),
        (STATUS_ARCHIVED, "Archivado"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField("título", max_length=200)
    description = models.TextField("descripción", blank=True, default="")
    color = models.CharField("color", max_length=32, default="sky")
    icon = models.CharField("icono", max_length=64, default="BookOpen")
    status = models.CharField("estado", max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    order = models.IntegerField("orden", default=0)

    class Meta:
        verbose_name = "curso (sandbox)"
        verbose_name_plural = "cursos (sandbox)"
        ordering = ["order", "title"]
        indexes = [models.Index(fields=["author"]), models.Index(fields=["status"])]


class CourseUnit(TimeStampedModel):
    """Unidad dentro de un curso sandbox."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="units")
    title = models.CharField("título", max_length=200)
    summary = models.CharField("resumen", max_length=500, blank=True, default="")
    description = models.TextField("descripción", blank=True, default="")
    icon = models.CharField("icono", max_length=64, default="BookOpen")
    color = models.CharField("color", max_length=32, default="sky")
    order = models.IntegerField("orden", default=0)

    class Meta:
        verbose_name = "unidad (sandbox)"
        verbose_name_plural = "unidades (sandbox)"
        ordering = ["order", "title"]
        indexes = [models.Index(fields=["course"])]


class CourseLesson(TimeStampedModel):
    """Lección dentro de una unidad sandbox."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    unit = models.ForeignKey(CourseUnit, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField("título", max_length=200)
    description = models.TextField("descripción", blank=True, default="")
    content = models.TextField("contenido (markdown)", blank=True, default="")
    duration_min = models.IntegerField("duración (min)", default=15)
    order = models.IntegerField("orden", default=0)

    class Meta:
        verbose_name = "lección (sandbox)"
        verbose_name_plural = "lecciones (sandbox)"
        ordering = ["order", "title"]
        indexes = [models.Index(fields=["unit"])]


class QuestionBank(TimeStampedModel):
    """Banco de preguntas reutilizable del docente."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="question_banks")
    name = models.CharField("nombre", max_length=200)
    description = models.TextField("descripción", blank=True, default="")
    category = models.CharField("categoría", max_length=32, default="general")
    questions: "models.Manager[Question]"

    class Meta:
        verbose_name = "banco de preguntas"
        verbose_name_plural = "bancos de preguntas"
        ordering = ["name"]
        indexes = [models.Index(fields=["author"]), models.Index(fields=["category"])]


class Question(TimeStampedModel):
    """Pregunta reutilizable (en banco o vinculada a lección sandbox)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    bank = models.ForeignKey(QuestionBank, on_delete=models.SET_NULL, null=True, blank=True, related_name="questions")
    lesson = models.ForeignKey(CourseLesson, on_delete=models.CASCADE, null=True, blank=True, related_name="questions")
    type = models.CharField("tipo", max_length=32)
    title = models.CharField("título", max_length=200)
    prompt = models.TextField("enunciado")
    data = models.JSONField("datos", default=dict)
    points = models.IntegerField("puntos", default=10)
    difficulty = models.CharField("dificultad", max_length=16, default="medium")
    tags = models.CharField("etiquetas", max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "pregunta"
        verbose_name_plural = "preguntas"
        indexes = [models.Index(fields=["bank"]), models.Index(fields=["lesson"]), models.Index(fields=["type"])]


class DataResource(TimeStampedModel):
    """Recurso de datos reutilizable (glosario, fórmula, dataset...)."""

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="data_resources")
    name = models.CharField("nombre", max_length=200)
    type = models.CharField("tipo", max_length=32)
    content = models.TextField("contenido")
    tags = models.CharField("etiquetas", max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "recurso de datos"
        verbose_name_plural = "recursos de datos"
        indexes = [models.Index(fields=["author"]), models.Index(fields=["type"])]
