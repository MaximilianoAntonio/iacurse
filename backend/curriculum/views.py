"""
Vistas de currículo — units, lessons, next-activity.

Reproducen src/app/api/units/route.ts, units/[slug]/route.ts, lessons/[id]/route.ts,
next-activity/route.ts. Todas requieren sesión real (sin modo demo).
"""
from django.db.models import Count, Max, Q
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from learning.models import Attempt, Progress
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
    """GET /api/units — lista unidades con lecciones y progreso del usuario."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        units = Unit.objects.order_by("order", "title")
        progress_map = {}
        for p in Progress.objects.filter(user=user):
            progress_map[p.unit_id] = {
                "completed": min(p.completed, p.total),
                "total": p.total,
                "mastery": min(100, p.mastery),
            }

        result = []
        for u in units:
            lessons = [
                {
                    "id": l.id,
                    "slug": l.slug,
                    "title": l.title,
                    "durationMin": l.duration_min,
                    "order": l.order,
                }
                for l in u.lessons.order_by("order")
            ]
            activity_count = Activity.objects.filter(lesson__unit=u).count()
            prog = progress_map.get(u.id, {"completed": 0, "total": activity_count, "mastery": 0})
            d = _unit_to_dict(u, lessons)
            d["lessonCount"] = u.lessons.count()
            d["activityCount"] = activity_count
            d["progress"] = prog
            result.append(d)
        return Response({"units": result})


class UnitDetailView(views.APIView):
    """GET /api/units/<slug_or_id> — detalle de unidad con progreso por actividad."""

    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        unit = Unit.objects.filter(Q(slug=slug) | Q(pk=slug)).first()
        if not unit:
            return Response({"error": "Unidad no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user

        lessons = []
        for l in unit.lessons.order_by("order").prefetch_related("activities"):
            activities = []
            for a in l.activities.order_by("order"):
                act_dict = {
                    "id": a.id,
                    "type": a.type,
                    "title": a.title,
                    "prompt": a.prompt,
                    "data": a.data,
                    "points": a.points,
                    "difficulty": a.difficulty,
                    "order": a.order,
                    "assessmentType": a.assessment_type,
                    "bloomLevel": a.bloom_level,
                    "maxAttempts": a.max_attempts,
                    "masteryThreshold": a.mastery_threshold,
                    "timeLimitMin": a.time_limit_min,
                }
                # Resumen de intentos del usuario
                attempts = a.attempts.filter(user=user)
                best = attempts.order_by("-score").first()
                act_dict["attemptSummary"] = {
                    "attempts": attempts.count(),
                    "completed": attempts.filter(correct=True).exists(),
                    "bestScore": best.score if best else None,
                }
                activities.append(act_dict)
            lessons.append({
                "id": l.id, "slug": l.slug, "title": l.title,
                "description": l.description, "content": l.content,
                "durationMin": l.duration_min, "order": l.order,
                "activities": activities,
            })

        # Progreso de unidad
        progress = None
        try:
            p = Progress.objects.get(user=user, unit=unit)
            progress = {
                "completed": min(p.completed, p.total),
                "total": p.total, "mastery": min(100, p.mastery),
                "lastVisited": p.last_visited.isoformat() if p.last_visited else None,
            }
        except Progress.DoesNotExist:
            pass

        return Response({
            "unit": {
                "id": unit.id, "slug": unit.slug, "title": unit.title,
                "summary": unit.summary, "description": unit.description,
                "icon": unit.icon, "color": unit.color, "order": unit.order,
            },
            "lessons": lessons,
            "progress": progress,
        })


class LessonDetailView(views.APIView):
    """GET /api/lessons/<id> — detalle de lección con actividades + intentos."""

    permission_classes = [IsAuthenticated]

    def get(self, request, lesson_id):
        lesson = Lesson.objects.filter(pk=lesson_id).select_related("unit").first()
        if not lesson:
            return Response({"error": "Lección no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user

        activities = []
        for a in lesson.activities.order_by("order"):
            act_dict = {
                "id": a.id, "type": a.type, "title": a.title, "prompt": a.prompt,
                "data": a.data, "points": a.points, "difficulty": a.difficulty,
                "order": a.order, "assessmentType": a.assessment_type,
                "bloomLevel": a.bloom_level, "maxAttempts": a.max_attempts,
                "masteryThreshold": a.mastery_threshold, "weight": a.weight,
                "timeLimitMin": a.time_limit_min,
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

        return Response({
            "lesson": {
                "id": lesson.id, "slug": lesson.slug, "title": lesson.title,
                "description": lesson.description, "content": lesson.content,
                "durationMin": lesson.duration_min, "order": lesson.order,
                "unit": {
                    "id": lesson.unit.id, "title": lesson.unit.title,
                    "color": lesson.unit.color, "icon": lesson.unit.icon,
                    "slug": lesson.unit.slug,
                },
            },
            "activities": activities,
        })


class NextActivityView(views.APIView):
    """GET /api/next-activity — recomienda la siguiente actividad.

    Lógica: última unidad visitada con actividad incompleta (reason=continue),
    si no, primera unidad con actividad incompleta (reason=new), si no, null.
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

        # Intentar primero la última unidad visitada
        for p in visited:
            for unit_activity in Activity.objects.filter(lesson__unit=p.unit):
                if unit_activity.id not in correct_activity_ids:
                    return Response({
                        "activityId": unit_activity.id,
                        "activityTitle": unit_activity.title,
                        "unitId": p.unit.id,
                        "unitTitle": p.unit.title,
                        "unitColor": p.unit.color,
                        "reason": "continue",
                    })

        # Si no, primera unidad con actividad incompleta
        for unit in Unit.objects.order_by("order"):
            for unit_activity in Activity.objects.filter(lesson__unit=unit):
                if unit_activity.id not in correct_activity_ids:
                    return Response({
                        "activityId": unit_activity.id,
                        "activityTitle": unit_activity.title,
                        "unitId": unit.id,
                        "unitTitle": unit.title,
                        "unitColor": unit.color,
                        "reason": "new",
                    })

        return Response({"activityId": None})
