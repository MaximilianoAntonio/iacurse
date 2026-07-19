"""URLs del Panel Docente y analytics."""
from django.urls import path

from . import views

app_name = "analytics"

urlpatterns = [
    path("teacher", views.TeacherView.as_view(), name="teacher"),
    path("teacher/student/<str:student_id>", views.TeacherStudentDetailView.as_view(), name="teacher-student-detail"),
    path("progress", views.ProgressView.as_view(), name="progress"),
    path("leaderboard", views.LeaderboardView.as_view(), name="leaderboard"),
]
