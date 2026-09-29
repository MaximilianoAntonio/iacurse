"""
Vistas de currículo — units, lessons.

Reproducen src/app/api/units/route.ts, units/[slug]/route.ts, lessons/[id]/route.ts.
Todas requieren sesión real (sin modo demo).
"""
from django.db.models import Count, Prefetch, Q
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from learning.models import Attempt, CourseDiagnosticResult, Progress, PersonalizedUnit
from learning.ai_services import adapt_unit_for_student
from learning.grading import sanitize_activity_data
from .models import Activity, Lesson, Unit


def _attempt_summary(attempts: list, with_last_answer: bool = False) -> dict:
    """Resume en memoria los intentos del usuario en una actividad.

    Recibe la lista ya cargada (ordenada por created_at) para evitar una
    query por actividad (N+1) en los detalles de unidad/lección.
    """
    scores = [a.score for a in attempts if a.score is not None]
    summary = {
        "attempts": len(attempts),
        "completed": any(a.correct for a in attempts),
        "bestScore": max(scores) if scores else None,
    }
    if with_last_answer:
        summary["lastAnswer"] = attempts[-1].answer if attempts else None
    return summary


def _unit_to_dict(unit, lessons=None):
    return {
        "id": unit.id,
        "slug": unit.slug,
        "title": unit.title,
        "summary": unit.summary,
        "description": unit.description,
        "icon": unit.icon,
        "color": unit.color,
        "order": unit.order,
        "lessons": lessons or [],
    }


class UnitsListView(views.APIView):
    """GET /api/units — lista unidades con progreso real del usuario y flags
    de adaptación (hasAdaptedContent / diagnosticSkipped)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        units = Unit.objects.order_by("order", "title")
        pers_units = {
            pu.unit_id: pu.skipped
            for pu in PersonalizedUnit.objects.filter(user=user)
        }
        progress_map = {p.unit_id: p for p in Progress.objects.filter(user=user)}
        lesson_counts = {
            row["unit"]: row["n"]
            for row in Lesson.objects.filter(is_published=True)
            .values("unit")
            .annotate(n=Count("id"))
        }
        activity_counts = {
            row["lesson__unit"]: row["n"]
            for row in Activity.objects.filter(lesson__is_published=True)
            .values("lesson__unit")
            .annotate(n=Count("id"))
        }

        result = []
        for u in units:
            has_adapted = u.id in pers_units
            prog_obj = progress_map.get(u.id)
            total_activities = activity_counts.get(u.id, 0)
            d = _unit_to_dict(u, lessons=[])
            d["lessonCount"] = lesson_counts.get(u.id, 0)
            d["activityCount"] = total_activities
            d["hasAdaptedContent"] = has_adapted
            d["diagnosticSkipped"] = pers_units.get(u.id, False) if has_adapted else False
            d["progress"] = {
                "completed": prog_obj.completed if prog_obj else 0,
                "total": prog_obj.total if prog_obj else total_activities,
                "mastery": min(100, prog_obj.mastery) if prog_obj else 0,
            }
            result.append(d)
        return Response({"units": result})


class UnitDetailView(views.APIView):
    """GET /api/units/<slug_or_id> — detalle de unidad adaptada con progreso.
    POST /api/units/<slug_or_id> — {action: "adapt"|"skip"}: personalizar la
    unidad con IA (usa las respuestas del diagnóstico general del curso) o
    usar el contenido base.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        unit = Unit.objects.filter(Q(slug=slug) | Q(pk=slug)).first()
        if not unit:
            return Response({"error": "Unidad no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user

        # Buscar unidad personalizada (adaptada con IA o con contenido base)
        pers_unit = PersonalizedUnit.objects.filter(user=user, unit=unit).first()
        has_adapted = pers_unit is not None
        # El botón "Personalizar con IA" solo tiene sentido si el estudiante
        # ya respondió el diagnóstico general del curso.
        has_course_diagnostic = CourseDiagnosticResult.objects.filter(user=user).exists()

        # Lecciones publicadas con actividades y resumen de intentos del usuario
        # (los borradores del docente no son visibles para estudiantes).
        # Los intentos se cargan en UNA sola query para toda la unidad y se
        # agrupan en memoria (evita el N+1 de 3 queries por actividad).
        attempts_by_id: dict[str, list] = {}
        for att in (
            Attempt.objects.filter(user=user, activity__lesson__unit=unit)
            .only("activity_id", "score", "correct", "created_at", "answer")
            .order_by("created_at")
        ):
            attempts_by_id.setdefault(att.activity_id, []).append(att)

        lessons = []
        published_lessons = unit.lessons.filter(is_published=True).order_by("order").prefetch_related(
            Prefetch("activities", queryset=Activity.objects.order_by("order"))
        )
        for l in published_lessons:
            activities = []
            for a in l.activities.all():
                activities.append({
                    "id": a.id,
                    "type": a.type,
                    "title": a.title,
                    "points": a.points,
                    "difficulty": a.difficulty,
                    "order": a.order,
                    "attemptSummary": _attempt_summary(attempts_by_id.get(a.id, [])),
                })
            lessons.append({
                "id": l.id, "slug": l.slug, "title": l.title,
                "description": l.description,
                "durationMin": l.duration_min, "order": l.order,
                "activities": activities,
            })

        # Progreso real del usuario en la unidad (actividades completadas).
        # El total considera solo lecciones publicadas: las actividades de
        # borradores no son visibles ni completables por el estudiante.
        prog_obj = Progress.objects.filter(user=user, unit=unit).first()
        total_activities = Activity.objects.filter(
            lesson__unit=unit, lesson__is_published=True
        ).count()
        progress = {
            "completed": prog_obj.completed if prog_obj else 0,
            "total": prog_obj.total if prog_obj else total_activities,
            "mastery": min(100, prog_obj.mastery) if prog_obj else 0,
            "lastVisited": (
                prog_obj.last_visited.isoformat()
                if prog_obj and prog_obj.last_visited
                else None
            ),
        }

        # attemptsByActivity: map activityId → resumen, consumido por el frontend
        attempts_by_activity = {}
        for l in lessons:
            for a in l["activities"]:
                attempts_by_activity[a["id"]] = a["attemptSummary"]

        return Response({
            "unit": {
                "id": unit.id, "slug": unit.slug, "title": unit.title,
                "summary": unit.summary, "description": unit.description,
                "icon": unit.icon, "color": unit.color, "order": unit.order,
                "content": unit.content,
                "lessons": lessons,
                "hasAdaptedContent": has_adapted,
                "adaptedContent": pers_unit.adapted_content if pers_unit else "",
                "diagnosticSkipped": pers_unit.skipped if pers_unit else False,
                "hasCourseDiagnostic": has_course_diagnostic,
            },
            "progress": progress,
            "attemptsByActivity": attempts_by_activity,
        })

    def post(self, request, slug):
        unit = Unit.objects.filter(Q(slug=slug) | Q(pk=slug)).first()
        if not unit:
            return Response({"error": "Unidad no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user

        action = request.data.get("action")
        if action not in ("adapt", "skip"):
            return Response(
                {"error": "Acción inválida (usa 'adapt' o 'skip')"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # "Usar contenido base": se desbloquea la unidad sin adaptar y queda
        # marcada (skipped) para personalizarla más tarde si el estudiante quiere.
        if action == "skip":
            PersonalizedUnit.objects.update_or_create(
                user=user,
                unit=unit,
                defaults={
                    "diagnostic_answers": [],
                    "adapted_content": unit.content,
                    "skipped": True,
                },
            )
            return Response({
                "ok": True,
                "hasAdaptedContent": True,
                "adaptedContent": unit.content,
                "diagnosticSkipped": True,
            })

        # "Personalizar con IA": exige el diagnóstico general del curso ya
        # respondido; sus respuestas describen el perfil del estudiante.
        diagnostic = CourseDiagnosticResult.objects.filter(user=user).first()
        if not diagnostic:
            return Response(
                {"error": "Debes completar el diagnóstico general del curso antes de personalizar esta unidad"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Adaptar contenido base usando la IA (fallback: contenido base)
        adapted_content = adapt_unit_for_student(unit.title, unit.content, diagnostic.answers)

        PersonalizedUnit.objects.update_or_create(
            user=user,
            unit=unit,
            defaults={
                "diagnostic_answers": diagnostic.answers,
                "adapted_content": adapted_content,
                "skipped": False,
            }
        )

        return Response({
            "ok": True,
            "hasAdaptedContent": True,
            "adaptedContent": adapted_content,
            "diagnosticSkipped": False,
        })


class LessonDetailView(views.APIView):
    """GET /api/lessons/<id> — detalle de lección con actividades + intentos.
    Incluye siblingLessons (lecciones hermanas de la misma unidad, publicadas
    y ordenadas) para la navegación anterior/siguiente del frontend."""

    permission_classes = [IsAuthenticated]

    def get(self, request, lesson_id):
        lesson = Lesson.objects.filter(pk=lesson_id, is_published=True).select_related("unit").first()
        if not lesson:
            return Response({"error": "Lección no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user

        sibling_lessons = [
            {"id": s.id, "slug": s.slug, "title": s.title, "order": s.order, "durationMin": s.duration_min}
            for s in lesson.unit.lessons.filter(is_published=True).order_by("order")
        ]

        # Intentos del usuario en la lección: una sola query agrupada en
        # memoria (evita el N+1 por actividad).
        attempts_by_id: dict[str, list] = {}
        for att in (
            Attempt.objects.filter(user=user, activity__lesson=lesson)
            .only("activity_id", "score", "correct", "created_at", "answer")
            .order_by("created_at")
        ):
            attempts_by_id.setdefault(att.activity_id, []).append(att)

        activities = []
        for a in lesson.activities.order_by("order"):
            act_dict = {
                "id": a.id, "type": a.type, "title": a.title, "prompt": a.prompt,
                # Nunca exponer la pauta (correctIndex, answers, keywords) al
                # cliente: llega solo tras el envío, en reviewData del attempt.
                "data": sanitize_activity_data(a.data),
                "points": a.points, "difficulty": a.difficulty,
                "order": a.order, "assessmentType": a.assessment_type,
                "bloomLevel": a.bloom_level, "maxAttempts": a.max_attempts,
                "masteryThreshold": a.mastery_threshold, "weight": a.weight,
                "timeLimitMin": a.time_limit_min,
                "lessonId": lesson.id,
            }
            act_dict["attemptSummary"] = _attempt_summary(
                attempts_by_id.get(a.id, []), with_last_answer=True
            )
            activities.append(act_dict)

        # attemptsByActivity: map activityId → resumen, consumido por el frontend.
        attempts_by_activity = {a["id"]: a["attemptSummary"] for a in activities}

        return Response({
            "lesson": {
                "id": lesson.id, "slug": lesson.slug, "title": lesson.title,
                "description": lesson.description, "content": lesson.content,
                "durationMin": lesson.duration_min, "order": lesson.order,
                "unitId": lesson.unit.id,
                "unit": {
                    "id": lesson.unit.id, "title": lesson.unit.title,
                    "color": lesson.unit.color, "icon": lesson.unit.icon,
                    "slug": lesson.unit.slug,
                },
                "activities": activities,
            },
            "siblingLessons": sibling_lessons,
            "attemptsByActivity": attempts_by_activity,
        })
