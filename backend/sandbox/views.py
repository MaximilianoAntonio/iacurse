"""
Vistas del Course Builder docente — CRUD admin del currículo live.

Reproduce src/app/api/admin/* (units/lessons/activities/rubrics/objectives)
más la subida de imágenes del editor. Todos los endpoints son solo docentes
(IsTeacher). El flujo sandbox de cursos (courses/question-banks/data-resources)
fue eliminado del producto.
"""
import json
import uuid

from django.conf import settings
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsTeacher
from curriculum.models import (
    Activity,
    CourseConfig,
    LearningObjective,
    Lesson,
    Rubric,
    Unit,
)
from learning.models import CourseDiagnosticResult, Progress


# ---------------------------------------------------------------------------
# Admin: Units / Lessons / Activities / Objectives / Rubrics (currículo live)
# ---------------------------------------------------------------------------
class AdminUnitsView(views.APIView):
    """CRUD admin de unidades live."""

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        units = Unit.objects.order_by("order")
        return Response({
            "units": [
                {
                    "id": u.id, "title": u.title, "slug": u.slug, "summary": u.summary,
                    "description": u.description, "icon": u.icon, "color": u.color,
                    "order": u.order,
                    "content": u.content,
                    "lessonCount": u.lessons.count(),
                    "activityCount": Activity.objects.filter(lesson__unit=u).count(),
                    "sourceCourseId": u.slug[3:] if u.slug.startswith("sc-") else None,
                }
                for u in units
            ]
        })

    def post(self, request):
        order = (Unit.objects.order_by("-order").first().order + 1) if Unit.objects.exists() else 0
        unit = Unit.objects.create(
            title=request.data.get("title", "Nueva unidad"),
            slug=request.data.get("slug") or f"unit-{Unit.objects.count() + 1}",
            summary=request.data.get("summary", ""),
            description=request.data.get("description", ""),
            icon=request.data.get("icon", "BookOpen"),
            color=request.data.get("color", "sky"),
            content=request.data.get("content", ""),
            order=order,
        )
        return Response({"id": unit.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        uid = request.data.get("unitId")
        update_data = {}
        for k in ("title", "summary", "description", "icon", "color", "order", "content"):
            if k in request.data:
                update_data[k] = request.data[k]
        Unit.objects.filter(pk=uid).update(**update_data)
        return Response({"ok": True})

    def delete(self, request):
        uid = request.query_params.get("unitId")
        Unit.objects.filter(pk=uid).delete()
        return Response({"ok": True})


class AdminUnitDetailView(views.APIView):
    """GET /api/admin/units/<unit_id> — obtiene el detalle de una unidad del currículo."""

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request, unit_id):
        unit = Unit.objects.filter(pk=unit_id).first()
        if not unit:
            return Response({"error": "Unidad no encontrada"}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "unit": {
                "id": unit.id,
                "slug": unit.slug,
                "title": unit.title,
                "summary": unit.summary,
                "description": unit.description,
                "icon": unit.icon,
                "color": unit.color,
                "order": unit.order,
                "content": unit.content or "",
                "objectives": [
                    {
                        "id": obj.id,
                        "code": obj.code,
                        "description": obj.description,
                        "bloomLevel": obj.bloom_level,
                    }
                    for obj in unit.objectives.all()
                ],
                "lessons": [
                    {
                        "id": l.id,
                        "unitId": l.unit_id,
                        "slug": l.slug,
                        "title": l.title,
                        "description": l.description,
                        "content": l.content,
                        "durationMin": l.duration_min,
                        "order": l.order,
                        "isPublished": l.is_published,
                        "activities": [
                            {
                                "id": a.id,
                                "lessonId": a.lesson_id,
                                "type": a.type,
                                "title": a.title,
                                "prompt": a.prompt,
                                "points": a.points,
                                "difficulty": a.difficulty,
                                "order": a.order,
                            }
                            for a in l.activities.order_by("order")
                        ]
                    }
                    for l in unit.lessons.order_by("order")
                ]
            }
        })


class AdminLessonsView(views.APIView):
    permission_classes = [IsAuthenticated, IsTeacher]

    def post(self, request):
        unit = Unit.objects.get(pk=request.data.get("unitId"))
        order = unit.lessons.count()
        lesson = Lesson.objects.create(
            unit=unit,
            title=request.data.get("title", "Nueva lección"),
            slug=request.data.get("slug") or f"lesson-{order + 1}",
            description=request.data.get("description", ""),
            content=request.data.get("content", ""),
            duration_min=request.data.get("durationMin", 15),
            order=order,
            is_published=request.data.get("isPublished", True),
        )
        _resync_progress_totals(unit)
        return Response({"id": lesson.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        lid = request.data.get("lessonId")
        lesson = Lesson.objects.get(pk=lid)
        for k in ("title", "description", "content", "durationMin", "order", "isPublished"):
            if k in request.data:
                attr = k.replace("durationMin", "duration_min").replace("isPublished", "is_published")
                setattr(lesson, attr, request.data[k])
        lesson.save()
        return Response({"ok": True})

    def delete(self, request):
        lid = request.query_params.get("lessonId")
        lesson = Lesson.objects.get(pk=lid)
        unit = lesson.unit
        lesson.delete()
        _resync_progress_totals(unit)
        return Response({"ok": True})


# ---------------------------------------------------------------------------
# Subida de imágenes para el editor de contenido (unidades/lecciones)
# ---------------------------------------------------------------------------

# Tamaño máximo (5 MB) para imágenes del editor.
# SVG queda excluido a propósito: puede llevar <script> y se serviría desde
# el mismo origen (XSS almacenado).
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# Firmas mágicas de los formatos permitidos: el content_type declarado por el
# cliente NO es confiable (un .txt renombrado pasaría). Se valida el contenido.
_IMAGE_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


def _sniff_image_type(head: bytes) -> str | None:
    """Detecta el tipo real de imagen por sus bytes iniciales."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"GIF8"):
        return "image/gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    return None


class UploadImageView(views.APIView):
    """POST /api/uploads — sube una imagen para el editor de contenido.

    Solo docentes (IsTeacher). Devuelve la URL pública bajo MEDIA_URL para
    insertarla en el Markdown como ![descripción](url). El tipo real del
    archivo se valida por firma mágica (no por el content_type declarado).
    """

    permission_classes = [IsAuthenticated, IsTeacher]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "Falta el archivo (campo 'file')"}, status=status.HTTP_400_BAD_REQUEST)
        if file.size > MAX_UPLOAD_BYTES:
            return Response({"error": "La imagen supera el máximo de 5 MB"}, status=status.HTTP_400_BAD_REQUEST)

        head = file.read(512)
        file.seek(0)
        real_type = _sniff_image_type(head)
        if real_type is None:
            return Response(
                {"error": "El archivo no es una imagen válida (PNG, JPEG, GIF o WebP; SVG no permitido)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = _IMAGE_EXTENSIONS[real_type]
        name = f"{uuid.uuid4().hex}{ext}"
        dest_dir = settings.MEDIA_ROOT / "uploads"
        dest_dir.mkdir(parents=True, exist_ok=True)
        with open(dest_dir / name, "wb") as out:
            for chunk in file.chunks():
                out.write(chunk)
        return Response({"url": f"{settings.MEDIA_URL}uploads/{name}"}, status=status.HTTP_201_CREATED)


class AdminActivitiesView(views.APIView):
    permission_classes = [IsAuthenticated, IsTeacher]

    def post(self, request):
        lesson = Lesson.objects.get(pk=request.data.get("lessonId"))
        order = lesson.activities.count()
        activity = Activity.objects.create(
            lesson=lesson,
            type=request.data.get("type", "multiple_choice"),
            title=request.data.get("title", "Nueva actividad"),
            prompt=request.data.get("prompt", ""),
            data=request.data.get("data", {}),
            points=request.data.get("points", 10),
            difficulty=request.data.get("difficulty", "medium"),
            assessment_type=request.data.get("assessmentType", "formative"),
            bloom_level=request.data.get("bloomLevel", "apply"),
            max_attempts=request.data.get("maxAttempts", 3),
            mastery_threshold=request.data.get("masteryThreshold", 70),
            weight=request.data.get("weight", 1),
            time_limit_min=request.data.get("timeLimitMin"),
            rubric_id=request.data.get("rubricId"),
            order=order,
        )
        # Vincular objetivos
        objective_ids = request.data.get("objectiveIds") or []
        for oid in objective_ids:
            activity.objectives.get_or_create(objective_id=oid)
        _resync_progress_totals(lesson.unit)
        return Response({"id": activity.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        aid = request.data.get("activityId")
        activity = Activity.objects.get(pk=aid)
        for k in ("type", "title", "prompt", "data", "points", "difficulty", "order"):
            if k in request.data:
                setattr(activity, k, request.data[k])
        for k_api, k_model in [
            ("assessmentType", "assessment_type"), ("bloomLevel", "bloom_level"),
            ("maxAttempts", "max_attempts"), ("masteryThreshold", "mastery_threshold"),
            ("weight", "weight"), ("timeLimitMin", "time_limit_min"), ("rubricId", "rubric_id"),
        ]:
            if k_api in request.data:
                setattr(activity, k_model, request.data[k_api])
        activity.save()
        # Resincronizar objetivos
        if "objectiveIds" in request.data:
            activity.objectives.all().delete()
            for oid in request.data["objectiveIds"]:
                activity.objectives.get_or_create(objective_id=oid)
        return Response({"ok": True})

    def delete(self, request):
        aid = request.query_params.get("activityId")
        activity = Activity.objects.get(pk=aid)
        unit = activity.lesson.unit
        activity.delete()
        _resync_progress_totals(unit)
        return Response({"ok": True})


class AdminObjectivesView(views.APIView):
    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        unit_id = request.query_params.get("unitId")
        lesson_id = request.query_params.get("lessonId")
        qs = LearningObjective.objects.all()
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        return Response({
            "objectives": [
                {
                    "id": o.id, "code": o.code, "description": o.description,
                    "bloomLevel": o.bloom_level, "unitId": o.unit_id, "lessonId": o.lesson_id,
                }
                for o in qs
            ]
        })

    def post(self, request):
        unit = Unit.objects.get(pk=request.data.get("unitId"))
        obj = LearningObjective.objects.create(
            unit=unit,
            lesson_id=request.data.get("lessonId"),
            code=request.data.get("code") or f"O{LearningObjective.objects.filter(unit=unit).count() + 1}",
            description=request.data.get("description", ""),
            bloom_level=request.data.get("bloomLevel", "apply"),
        )
        return Response({"id": obj.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        oid = request.data.get("objectiveId")
        LearningObjective.objects.filter(pk=oid).update(**{
            k: request.data[k] for k in ("code", "description", "bloomLevel", "lessonId") if k in request.data
        })
        return Response({"ok": True})

    def delete(self, request):
        oid = request.query_params.get("objectiveId")
        LearningObjective.objects.filter(pk=oid).delete()
        return Response({"ok": True})


class AdminRubricsView(views.APIView):
    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        author_id = request.query_params.get("authorId") or request.user.id
        rubrics = Rubric.objects.filter(author_id=author_id)
        return Response({
            "rubrics": [
                {
                    "id": r.id, "name": r.name, "description": r.description,
                    "criteria": r.criteria, "activityCount": r.activities.count(),
                }
                for r in rubrics
            ]
        })

    def post(self, request):
        criteria = request.data.get("criteria", "[]")
        if isinstance(criteria, str):
            try:
                json.loads(criteria)
            except json.JSONDecodeError:
                return Response({"error": "criteria debe ser JSON válido"}, status=status.HTTP_400_BAD_REQUEST)
        rubric = Rubric.objects.create(
            author=request.user,
            name=request.data.get("name", "Nueva rúbrica"),
            description=request.data.get("description", ""),
            criteria=criteria,
        )
        return Response({"id": rubric.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        rid = request.data.get("rubricId")
        rubric = Rubric.objects.get(pk=rid, author=request.user)
        for k in ("name", "description"):
            if k in request.data:
                setattr(rubric, k, request.data[k])
        if "criteria" in request.data:
            criteria = request.data["criteria"]
            if isinstance(criteria, str):
                json.loads(criteria)  # valida
            rubric.criteria = criteria
        rubric.save()
        return Response({"ok": True})

    def delete(self, request):
        rid = request.query_params.get("rubricId")
        Rubric.objects.filter(pk=rid, author=request.user).delete()
        return Response({"ok": True})


def _resync_progress_totals(unit: Unit) -> None:
    """Re-sync Progress.total para todos los usuarios de una unidad."""
    total = Activity.objects.filter(lesson__unit=unit).count()
    Progress.objects.filter(unit=unit).update(total=total)


# ---------------------------------------------------------------------------
# Admin: evaluaciones del curso (diagnóstico general + prueba de cierre)
# ---------------------------------------------------------------------------
class AdminCourseDiagnosticView(views.APIView):
    """GET/PATCH /api/admin/course/diagnostic — preguntas del diagnóstico
    general del curso.

    Al guardar cambios se BORRAN todos los CourseDiagnosticResult: las
    respuestas previas quedaron obsoletas y cada estudiante repite el
    diagnóstico con la nueva pauta (mismo criterio que el flujo por unidad).
    """

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        return Response({"questions": CourseConfig.load().diagnostic_questions or []})

    def patch(self, request):
        questions = request.data.get("questions")
        if not isinstance(questions, list) or len(questions) > 50:
            return Response(
                {"error": "questions debe ser una lista de hasta 50 preguntas"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        clean = []
        for q in questions:
            if not isinstance(q, str) or not q.strip():
                return Response(
                    {"error": "Todas las preguntas deben ser texto no vacío"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            clean.append(q.strip()[:500])

        config = CourseConfig.load()
        config.diagnostic_questions = clean
        config.save(update_fields=["diagnostic_questions"])
        # Invalida las respuestas existentes: los estudiantes repiten el diagnóstico.
        CourseDiagnosticResult.objects.all().delete()
        return Response({"ok": True, "questions": clean})


class AdminFinalExamView(views.APIView):
    """GET/PUT /api/admin/course/final-exam — configuración de la prueba de
    cierre (preguntas con correctIndex, puntaje mínimo y límite de intentos)."""

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        config = CourseConfig.load()
        return Response({
            "questions": config.final_exam_questions or [],
            "passScore": config.final_exam_pass_score,
            "maxAttempts": config.final_exam_max_attempts,
        })

    def put(self, request):
        questions = request.data.get("questions")
        pass_score = request.data.get("passScore")
        max_attempts = request.data.get("maxAttempts")

        # Validación de preguntas: enunciado + ≥2 opciones no vacías + índice en rango.
        if not isinstance(questions, list) or len(questions) > 100:
            return Response(
                {"error": "questions debe ser una lista de hasta 100 preguntas"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        clean_questions = []
        for item in questions:
            if not isinstance(item, dict):
                return Response(
                    {"error": "Formato de preguntas inválido"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            q_text = str(item.get("question", "")).strip()
            options = item.get("options")
            correct = item.get("correctIndex")
            if not q_text:
                return Response(
                    {"error": "Todas las preguntas deben tener enunciado"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not isinstance(options, list) or len(options) < 2 or len(options) > 6:
                return Response(
                    {"error": "Cada pregunta debe tener entre 2 y 6 opciones"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            clean_options = [str(o).strip() for o in options]
            if any(not o for o in clean_options):
                return Response(
                    {"error": "Las opciones no pueden estar vacías"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                not isinstance(correct, int)
                or isinstance(correct, bool)
                or correct < 0
                or correct >= len(clean_options)
            ):
                return Response(
                    {"error": "correctIndex fuera de rango en alguna pregunta"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            clean_questions.append({
                "question": q_text[:1000],
                "options": clean_options,
                "correctIndex": correct,
            })

        if not isinstance(pass_score, int) or isinstance(pass_score, bool) or not 1 <= pass_score <= 100:
            return Response(
                {"error": "passScore debe ser un entero entre 1 y 100"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(max_attempts, int) or isinstance(max_attempts, bool) or not 1 <= max_attempts <= 10:
            return Response(
                {"error": "maxAttempts debe ser un entero entre 1 y 10"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = CourseConfig.load()
        config.final_exam_questions = clean_questions
        config.final_exam_pass_score = pass_score
        config.final_exam_max_attempts = max_attempts
        config.save(update_fields=[
            "final_exam_questions", "final_exam_pass_score", "final_exam_max_attempts",
        ])
        return Response({"ok": True})
