"""
Vistas del sandbox docente (Course Builder).

Reproduce src/app/api/courses/* y admin/* (units/lessons/activities/rubrics/
objectives/question-banks/data-resources).

Las acciones complejas (publishToCurriculum) delegan a sandbox/services.py.
"""
import json

from django.db import transaction
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from curriculum.models import (
    Activity,
    LearningObjective,
    Lesson,
    Rubric,
    Unit,
)
from learning.models import Progress
from .models import Course, CourseLesson, CourseUnit, DataResource, Question, QuestionBank
from .services import publish_to_curriculum


# ---------------------------------------------------------------------------
# Courses (lista + CRUD)
# ---------------------------------------------------------------------------
class CoursesView(views.APIView):
    """GET/POST/PATCH/DELETE /api/courses — gestión de cursos sandbox."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        author_id = request.query_params.get("authorId") or request.user.id
        courses = Course.objects.filter(author_id=author_id).order_by("order", "title")
        return Response({
            "courses": [
                {
                    "id": c.id, "title": c.title, "description": c.description,
                    "color": c.color, "icon": c.icon, "status": c.status,
                    "order": c.order, "unitCount": c.units.count(),
                }
                for c in courses
            ]
        })

    def post(self, request):
        course = Course.objects.create(
            author=request.user,
            title=request.data.get("title", "Nuevo curso"),
            description=request.data.get("description", ""),
            color=request.data.get("color", "sky"),
            icon=request.data.get("icon", "BookOpen"),
        )
        return Response({"id": course.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        course_id = request.data.get("courseId")
        if not course_id:
            return Response({"error": "Falta courseId"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            course = Course.objects.get(pk=course_id, author=request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        for field in ("title", "description", "color", "icon", "status", "order"):
            if field in request.data:
                setattr(course, field, request.data[field])
        course.save()
        return Response({"ok": True})

    def delete(self, request):
        course_id = request.query_params.get("courseId")
        Course.objects.filter(pk=course_id, author=request.user).delete()
        return Response({"ok": True})


class CourseDetailView(views.APIView):
    """GET/POST/PATCH/DELETE /api/courses/<id> — detalle + action dispatch.

    El PATCH usa body.action para dispatch a operaciones sobre unidades,
    lecciones, preguntas y publicación.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.prefetch_related(
                "units__lessons__questions"
            ).get(pk=course_id)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "course": {
                "id": course.id, "title": course.title, "description": course.description,
                "color": course.color, "icon": course.icon, "status": course.status,
                "units": [
                    {
                        "id": u.id, "title": u.title, "summary": u.summary,
                        "description": u.description, "icon": u.icon, "color": u.color,
                        "order": u.order,
                        "lessons": [
                            {
                                "id": l.id, "title": l.title, "description": l.description,
                                "content": l.content, "durationMin": l.duration_min,
                                "order": l.order,
                                "questions": [
                                    {
                                        "id": q.id, "type": q.type, "title": q.title,
                                        "prompt": q.prompt, "data": q.data,
                                        "points": q.points, "difficulty": q.difficulty,
                                        "tags": q.tags,
                                    }
                                    for q in l.questions.order_by("id")
                                ],
                            }
                            for l in u.lessons.order_by("order")
                        ],
                    }
                    for u in course.units.order_by("order")
                ],
            }
        })

    def post(self, request, course_id):
        """Crea una unidad en el curso."""
        try:
            course = Course.objects.get(pk=course_id, author=request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        order = course.units.count()
        unit = CourseUnit.objects.create(
            course=course,
            title=request.data.get("title", "Nueva unidad"),
            summary=request.data.get("summary", ""),
            description=request.data.get("description", ""),
            icon=request.data.get("icon", "BookOpen"),
            color=request.data.get("color", "sky"),
            order=order,
        )
        return Response({"id": unit.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request, course_id):
        action = request.data.get("action")
        try:
            course = Course.objects.get(pk=course_id, author=request.user)
        except Course.DoesNotExist:
            return Response({"error": "Curso no encontrado"}, status=status.HTTP_404_NOT_FOUND)

        if action == "updateUnit":
            CourseUnit.objects.filter(
                pk=request.data.get("unitId"), course=course
            ).update(**{
                k: request.data[k] for k in ("title", "summary", "description", "icon", "color")
                if k in request.data
            })
            return Response({"ok": True})

        if action == "deleteUnit":
            CourseUnit.objects.filter(pk=request.data.get("unitId"), course=course).delete()
            return Response({"ok": True})

        if action == "createLesson":
            unit = CourseUnit.objects.get(pk=request.data.get("unitId"), course=course)
            order = unit.lessons.count()
            lesson = CourseLesson.objects.create(
                unit=unit,
                title=request.data.get("title", "Nueva lección"),
                description=request.data.get("description", ""),
                content=request.data.get("content", ""),
                duration_min=request.data.get("durationMin", 15),
                order=order,
            )
            return Response({"id": lesson.id, "ok": True}, status=status.HTTP_201_CREATED)

        if action == "updateLesson":
            CourseLesson.objects.filter(pk=request.data.get("lessonId"), unit__course=course).update(**{
                k: request.data[k] for k in ("title", "description", "content", "durationMin")
                if k in request.data
            })
            return Response({"ok": True})

        if action == "deleteLesson":
            CourseLesson.objects.filter(pk=request.data.get("lessonId"), unit__course=course).delete()
            return Response({"ok": True})

        if action == "createQuestionInLesson":
            lesson = CourseLesson.objects.get(pk=request.data.get("lessonId"), unit__course=course)
            q = Question.objects.create(
                lesson=lesson,
                type=request.data.get("type", "multiple_choice"),
                title=request.data.get("title", "Nueva pregunta"),
                prompt=request.data.get("prompt", ""),
                data=request.data.get("data", {}),
                points=request.data.get("points", 10),
                difficulty=request.data.get("difficulty", "medium"),
            )
            return Response({"id": q.id, "ok": True}, status=status.HTTP_201_CREATED)

        if action == "updateQuestion":
            Question.objects.filter(
                pk=request.data.get("questionId"), lesson__unit__course=course
            ).update(**{
                k: request.data[k] for k in ("type", "title", "prompt", "data", "points", "difficulty", "tags")
                if k in request.data
            })
            return Response({"ok": True})

        if action == "deleteQuestion":
            Question.objects.filter(
                pk=request.data.get("questionId"), lesson__unit__course=course
            ).delete()
            return Response({"ok": True})

        if action == "publishToCurriculum":
            result = publish_to_curriculum(course)
            return Response(result)

        # default: update course itself
        for field in ("title", "description", "color", "icon", "status", "order"):
            if field in request.data:
                setattr(course, field, request.data[field])
        course.save()
        return Response({"ok": True})

    def delete(self, request, course_id):
        Course.objects.filter(pk=course_id, author=request.user).delete()
        return Response({"ok": True})


# ---------------------------------------------------------------------------
# Question Banks
# ---------------------------------------------------------------------------
class QuestionBanksView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        author_id = request.query_params.get("authorId") or request.user.id
        banks = QuestionBank.objects.filter(author_id=author_id)
        return Response({
            "banks": [
                {
                    "id": b.id, "name": b.name, "description": b.description,
                    "category": b.category, "questionCount": b.questions.count(),
                }
                for b in banks
            ]
        })

    def post(self, request):
        bank = QuestionBank.objects.create(
            author=request.user,
            name=request.data.get("name", "Nuevo banco"),
            description=request.data.get("description", ""),
            category=request.data.get("category", "general"),
        )
        return Response({"id": bank.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        bank_id = request.data.get("bankId")
        QuestionBank.objects.filter(pk=bank_id, author=request.user).update(**{
            k: request.data[k] for k in ("name", "description", "category") if k in request.data
        })
        return Response({"ok": True})

    def delete(self, request):
        bank_id = request.query_params.get("bankId")
        QuestionBank.objects.filter(pk=bank_id, author=request.user).delete()
        return Response({"ok": True})


class QuestionsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bank_id = request.query_params.get("bankId")
        author_id = request.query_params.get("authorId")
        qs = Question.objects.all()
        if bank_id:
            qs = qs.filter(bank_id=bank_id)
        elif author_id:
            bank_ids = QuestionBank.objects.filter(author_id=author_id).values_list("id", flat=True)
            qs = qs.filter(bank_id__in=list(bank_ids))
        else:
            return Response({"questions": []})
        return Response({
            "questions": [
                {
                    "id": q.id, "type": q.type, "title": q.title, "prompt": q.prompt,
                    "data": q.data, "points": q.points, "difficulty": q.difficulty,
                    "tags": q.tags, "bankId": q.bank_id,
                }
                for q in qs
            ]
        })

    def post(self, request):
        q = Question.objects.create(
            bank_id=request.data.get("bankId"),
            type=request.data.get("type", "multiple_choice"),
            title=request.data.get("title", "Nueva pregunta"),
            prompt=request.data.get("prompt", ""),
            data=request.data.get("data", {}),
            points=request.data.get("points", 10),
            difficulty=request.data.get("difficulty", "medium"),
            tags=request.data.get("tags", ""),
        )
        return Response({"id": q.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        qid = request.data.get("questionId")
        Question.objects.filter(pk=qid).update(**{
            k: request.data[k] for k in ("type", "title", "prompt", "data", "points", "difficulty", "tags")
            if k in request.data
        })
        return Response({"ok": True})

    def delete(self, request):
        qid = request.query_params.get("questionId")
        Question.objects.filter(pk=qid).delete()
        return Response({"ok": True})


# ---------------------------------------------------------------------------
# Data Resources
# ---------------------------------------------------------------------------
class DataResourcesView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        author_id = request.query_params.get("authorId") or request.user.id
        resources = DataResource.objects.filter(author_id=author_id)
        return Response({
            "resources": [
                {"id": r.id, "name": r.name, "type": r.type, "content": r.content, "tags": r.tags}
                for r in resources
            ]
        })

    def post(self, request):
        r = DataResource.objects.create(
            author=request.user,
            name=request.data.get("name", "Recurso"),
            type=request.data.get("type", "reference"),
            content=request.data.get("content", ""),
            tags=request.data.get("tags", ""),
        )
        return Response({"id": r.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        rid = request.data.get("resourceId")
        DataResource.objects.filter(pk=rid, author=request.user).update(**{
            k: request.data[k] for k in ("name", "type", "content", "tags") if k in request.data
        })
        return Response({"ok": True})

    def delete(self, request):
        rid = request.query_params.get("resourceId")
        DataResource.objects.filter(pk=rid, author=request.user).delete()
        return Response({"ok": True})


# ---------------------------------------------------------------------------
# Admin: Units / Lessons / Activities / Objectives / Rubrics (currículo live)
# ---------------------------------------------------------------------------
class AdminUnitsView(views.APIView):
    """CRUD admin de unidades live."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        units = Unit.objects.order_by("order")
        return Response({
            "units": [
                {
                    "id": u.id, "title": u.title, "slug": u.slug, "summary": u.summary,
                    "description": u.description, "icon": u.icon, "color": u.color,
                    "order": u.order,
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
            order=order,
        )
        return Response({"id": unit.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        uid = request.data.get("unitId")
        Unit.objects.filter(pk=uid).update(**{
            k: request.data[k] for k in ("title", "summary", "description", "icon", "color", "order")
            if k in request.data
        })
        return Response({"ok": True})

    def delete(self, request):
        uid = request.query_params.get("unitId")
        Unit.objects.filter(pk=uid).delete()
        return Response({"ok": True})


class AdminLessonsView(views.APIView):
    permission_classes = [IsAuthenticated]

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
        )
        _resync_progress_totals(unit)
        return Response({"id": lesson.id, "ok": True}, status=status.HTTP_201_CREATED)

    def patch(self, request):
        lid = request.data.get("lessonId")
        lesson = Lesson.objects.get(pk=lid)
        for k in ("title", "description", "content", "durationMin", "order"):
            if k in request.data:
                setattr(lesson, k.replace("durationMin", "duration_min"), request.data[k])
        lesson.save()
        return Response({"ok": True})

    def delete(self, request):
        lid = request.query_params.get("lessonId")
        lesson = Lesson.objects.get(pk=lid)
        unit = lesson.unit
        lesson.delete()
        _resync_progress_totals(unit)
        return Response({"ok": True})


class AdminActivitiesView(views.APIView):
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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
