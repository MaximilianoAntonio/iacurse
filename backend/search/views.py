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
    """GET /api/search?q=... — búsqueda global de contenido."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"results": [], "query": q})

        correct_activity_ids = set(
            Attempt.objects.filter(user=request.user, correct=True)
            .values_list("activity_id", flat=True)
        )

        results = []
        # Unidades
        for u in Unit.objects.filter(
            Q(title__icontains=q) | Q(summary__icontains=q) | Q(description__icontains=q)
        ):
            results.append({
                "type": "unit", "id": u.id, "title": u.title,
                "snippet": (u.summary or u.description)[:150],
                "slug": u.slug, "color": u.color,
            })

        # Lecciones
        for l in Lesson.objects.select_related("unit").filter(
            Q(title__icontains=q) | Q(description__icontains=q) | Q(content__icontains=q)
        ):
            results.append({
                "type": "lesson", "id": l.id, "title": l.title,
                "snippet": (l.description or l.content)[:150],
                "unitTitle": l.unit.title, "unitColor": l.unit.color,
            })

        # Actividades
        for a in Activity.objects.select_related("lesson__unit").filter(
            Q(title__icontains=q) | Q(prompt__icontains=q)
        ):
            results.append({
                "type": "activity", "id": a.id, "title": a.title,
                "snippet": a.prompt[:150],
                "unitTitle": a.lesson.unit.title, "unitColor": a.lesson.unit.color,
                "completed": a.id in correct_activity_ids,
            })

        return Response({"results": results, "query": q, "count": len(results)})
