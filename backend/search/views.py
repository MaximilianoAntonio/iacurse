"""
Vistas de búsqueda global — reproduce src/app/api/search/route.ts.

Busca en units, lessons y activities por título/contenido.
Requiere sesión real (sin modo demo).
"""
from django.db.models import Q
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from curriculum.models import Activity, Lesson, Unit
from learning.models import Attempt


class SearchView(views.APIView):
    """GET /api/search?q=... — búsqueda global de contenido.

    Devuelve los resultados agrupados por tipo para que el frontend pueda
    renderizar secciones separadas (units / lessons / activities).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        empty = {"results": {"units": [], "lessons": [], "activities": []}, "query": q, "count": 0}
        if len(q) < 2:
            return Response(empty)

        correct_activity_ids = set(
            Attempt.objects.filter(user=request.user, correct=True)
            .values_list("activity_id", flat=True)
        )

        units = []
        for u in Unit.objects.filter(
            Q(title__icontains=q) | Q(summary__icontains=q) | Q(description__icontains=q)
        ):
            units.append({
                "id": u.id, "title": u.title,
                "summary": (u.summary or "")[:200],
                "icon": u.icon, "color": u.color, "slug": u.slug, "order": u.order,
                "snippet": (u.summary or u.description or "")[:150],
            })

        lessons = []
        for l in Lesson.objects.select_related("unit").filter(
            Q(title__icontains=q) | Q(description__icontains=q) | Q(content__icontains=q)
        ):
            lessons.append({
                "id": l.id, "title": l.title,
                "description": (l.description or "")[:200],
                "durationMin": l.duration_min,
                "unit": {
                    "id": l.unit.id, "title": l.unit.title, "color": l.unit.color,
                    "icon": l.unit.icon, "slug": l.unit.slug,
                },
                "snippet": (l.description or l.content or "")[:150],
            })

        activities = []
        for a in Activity.objects.select_related("lesson__unit").filter(
            Q(title__icontains=q) | Q(prompt__icontains=q)
        ):
            activities.append({
                "id": a.id, "title": a.title, "type": a.type,
                "difficulty": a.difficulty, "points": a.points,
                "lessonId": a.lesson_id,
                "lesson": {
                    "id": a.lesson.id, "title": a.lesson.title,
                    "unit": {
                        "id": a.lesson.unit.id, "title": a.lesson.unit.title,
                        "color": a.lesson.unit.color, "icon": a.lesson.unit.icon,
                        "slug": a.lesson.unit.slug,
                    },
                },
                "completed": a.id in correct_activity_ids,
                "snippet": (a.prompt or "")[:150],
            })

        count = len(units) + len(lessons) + len(activities)
        return Response({
            "results": {"units": units, "lessons": lessons, "activities": activities},
            "query": q,
            "count": count,
        })
