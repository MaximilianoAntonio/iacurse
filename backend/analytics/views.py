"""
Vistas del Panel Docente — analytics con telemetría REAL.

Endpoints:
- GET /api/teacher           — métricas agregadas de todos los estudiantes (solo docentes)
- GET /api/teacher/student/<id> — detalle de un estudiante (solo docentes)
- GET /api/progress          — analítica del estudiante autenticado
- GET /api/leaderboard       — ranking por puntos

Ahora incluye número de accesos (AccessLog) y tiempo real (StudySession).
"""
from django.db.models import Count, Q
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsTeacher
from . import aggregations


class TeacherView(views.APIView):
    """GET /api/teacher — Panel docente con métricas agregadas (solo docentes)."""

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request):
        unit_filter = request.query_params.get("unitId")
        data = aggregations.teacher_dashboard(unit_filter=unit_filter)
        return Response(data)


class TeacherStudentDetailView(views.APIView):
    """GET /api/teacher/student/<id> — detalle de un estudiante (solo docentes)."""

    permission_classes = [IsAuthenticated, IsTeacher]

    def get(self, request, student_id):
        try:
            student = User.objects.get(pk=student_id, role=User.ROLE_STUDENT)
        except User.DoesNotExist:
            return Response({"error": "Estudiante no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        return Response(aggregations.student_detail(student))


class ProgressView(views.APIView):
    """GET /api/progress — analítica del propio estudiante."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(aggregations.student_progress_analytics(request.user))


class LeaderboardView(views.APIView):
    """GET /api/leaderboard — ranking de estudiantes por puntos.

    Privacidad (minimización 6.2): el ``name`` de un estudiante es su
    ``student_code`` —que además es su identificador de login—, así que a los
    demás estudiantes se les muestra anonimizado. El docente, que ya administra
    los códigos, los ve completos. Nunca se expone el email (placeholder que
    también contiene el código).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # completedActivities anotado en la query (evita un COUNT por estudiante).
        # Privacidad: el código del estudiante solo es visible para el docente o el
        # propio estudiante; a los demás se les muestra "Participante anónimo".
        students = (
            User.objects.filter(role=User.ROLE_STUDENT)
            .annotate(
                completed_activities=Count(
                    "attempts__activity_id",
                    distinct=True,
                    filter=Q(attempts__correct=True),
                )
            )
            .order_by("-points", "name")
        )
        viewer_is_teacher = getattr(request.user, "is_teacher", False)
        ranking = []
        for rank, s in enumerate(students, start=1):
            visible = viewer_is_teacher or s.pk == request.user.pk
            ranking.append({
                "rank": rank,
                "id": s.id,
                "name": s.name if visible else "Participante anónimo",
                "points": s.points,
                "streak": s.streak,
                "avatar": (s.avatar or None) if visible else None,
                "completedActivities": s.completed_activities,
            })
        return Response({"leaderboard": ranking})
