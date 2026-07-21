"""
Vistas del Panel Docente — analytics con telemetría REAL.

Endpoints:
- GET /api/teacher           — métricas agregadas de todos los estudiantes
- GET /api/teacher/student/<id> — detalle de un estudiante
- GET /api/progress          — analítica del estudiante autenticado
- GET /api/leaderboard       — ranking por puntos

Ahora incluye número de accesos (AccessLog) y tiempo real (StudySession).
"""
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from . import aggregations


class TeacherView(views.APIView):
    """GET /api/teacher — Panel docente con métricas agregadas."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Accesible a cualquier usuario autenticado; las vistas del frontend
        # filtran por rol (los estudiantes no navegan a la vista docente).
        unit_filter = request.query_params.get("unitId")
        data = aggregations.teacher_dashboard(unit_filter=unit_filter)
        return Response(data)


class TeacherStudentDetailView(views.APIView):
    """GET /api/teacher/student/<id> — detalle de un estudiante."""

    permission_classes = [IsAuthenticated]

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
    """GET /api/leaderboard — ranking de estudiantes por puntos."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        students = User.objects.filter(role=User.ROLE_STUDENT).order_by("-points", "name")
        ranking = []
        for rank, s in enumerate(students, start=1):
            completed = (
                s.attempts.filter(correct=True).values("activity_id").distinct().count()
            )
            ranking.append({
                "rank": rank,
                "id": s.id, "name": s.name, "email": s.email,
                "points": s.points, "streak": s.streak,
                "avatar": s.avatar or None,
                "completedActivities": completed,
            })
        return Response({"leaderboard": ranking})
