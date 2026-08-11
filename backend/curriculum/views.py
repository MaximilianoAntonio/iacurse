"""
Vistas de currículo — units, lessons, next-activity.

Reproducen src/app/api/units/route.ts, units/[slug]/route.ts, lessons/[id]/route.ts,
next-activity/route.ts. Todas requieren sesión real (sin modo demo).
"""
from django.db.models import Count, Max, Q
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from learning.models import Attempt, CourseDiagnosticResult, Progress, PersonalizedUnit
from learning.ai_services import adapt_unit_for_student
from .models import Activity, Lesson, Unit


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
            for row in Activity.objects.values("lesson__unit").annotate(n=Count("id"))
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
        # (los borradores del docente no son visibles para estudiantes)
        lessons = []
        for l in unit.lessons.filter(is_published=True).order_by("order").prefetch_related("activities"):
            activities = []
            for a in l.activities.order_by("order"):
                attempts = a.attempts.filter(user=user)
                best = attempts.order_by("-score").first()
                activities.append({
                    "id": a.id,
                    "type": a.type,
                    "title": a.title,
                    "points": a.points,
                    "difficulty": a.difficulty,
                    "order": a.order,
                    "attemptSummary": {
                        "attempts": attempts.count(),
                        "completed": attempts.filter(correct=True).exists(),
                        "bestScore": best.score if best else None,
                    },
                })
            lessons.append({
                "id": l.id, "slug": l.slug, "title": l.title,
                "description": l.description,
                "durationMin": l.duration_min, "order": l.order,
                "activities": activities,
            })

        # Progreso real del usuario en la unidad (actividades completadas)
        prog_obj = Progress.objects.filter(user=user, unit=unit).first()
        total_activities = Activity.objects.filter(lesson__unit=unit).count()
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

        activities = []
        for a in lesson.activities.order_by("order"):
            act_dict = {
                "id": a.id, "type": a.type, "title": a.title, "prompt": a.prompt,
                "data": a.data, "points": a.points, "difficulty": a.difficulty,
                "order": a.order, "assessmentType": a.assessment_type,
                "bloomLevel": a.bloom_level, "maxAttempts": a.max_attempts,
                "masteryThreshold": a.mastery_threshold, "weight": a.weight,
                "timeLimitMin": a.time_limit_min,
                "lessonId": lesson.id,
            }
            attempts = a.attempts.filter(user=user).order_by("-created_at")
            best = attempts.order_by("-score").first()
            last = attempts.first()
            act_dict["attemptSummary"] = {
                "attempts": attempts.count(),
                "completed": attempts.filter(correct=True).exists(),
                "bestScore": best.score if best else None,
                "lastAnswer": last.answer if last else None,
            }
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


class NextActivityView(views.APIView):
    """GET /api/next-activity — recomienda la siguiente actividad.

    Lógica: última unidad visitada con actividad incompleta (reason=continue),
    si no, primera unidad con actividad incompleta (reason=new), si no, null.

    Devuelve la actividad anidada con su lección y unidad, más el progreso de
    la unidad, para que el dashboard pueda renderizar la tarjeta "Continuar".
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Unidades con lastVisited, ordenadas por última visita
        visited = Progress.objects.filter(
            user=user, last_visited__isnull=False
        ).order_by("-last_visited").select_related("unit")

        correct_activity_ids = set(
            Attempt.objects.filter(user=user, correct=True).values_list("activity_id", flat=True)
        )

        def build_response(unit_activity, unit, reason):
            unit_progress = Progress.objects.filter(user=user, unit=unit).first()
            return Response({
                "recommendation": {
                    "activity": {
                        "id": unit_activity.id,
                        "title": unit_activity.title,
                        "type": unit_activity.type,
                        "difficulty": unit_activity.difficulty,
                        "points": unit_activity.points,
                        "lessonId": unit_activity.lesson_id,
                    },
                    "lesson": {
                        "id": unit_activity.lesson.id,
                        "title": unit_activity.lesson.title,
                    },
                    "unit": {
                        "id": unit.id, "title": unit.title, "color": unit.color,
                        "icon": unit.icon, "slug": unit.slug, "order": unit.order,
                    },
                    "reason": reason,
                    "unitProgress": {
                        "completed": unit_progress.completed if unit_progress else 0,
                        "total": unit_progress.total if unit_progress else 0,
                        "mastery": min(100, unit_progress.mastery) if unit_progress else 0,
                    },
                }
            })

        # Intentar primero la última unidad visitada
        for p in visited:
            for unit_activity in (
                Activity.objects.filter(lesson__unit=p.unit).select_related("lesson").order_by("order")
            ):
                if unit_activity.id not in correct_activity_ids:
                    return build_response(unit_activity, p.unit, "continue")

        # Si no, primera unidad con actividad incompleta
        for unit in Unit.objects.order_by("order"):
            for unit_activity in (
                Activity.objects.filter(lesson__unit=unit).select_related("lesson").order_by("order")
            ):
                if unit_activity.id not in correct_activity_ids:
                    return build_response(unit_activity, unit, "new")

        return Response({"recommendation": None})
