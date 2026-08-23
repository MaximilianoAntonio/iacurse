"""URLs de aprendizaje."""
from django.urls import path

from . import views

app_name = "learning"

urlpatterns = [
    # Endpoint crítico de evaluación (orden de side-effects exacto)
    path(
        "activities/<str:activity_id>/attempt",
        views.AttemptView.as_view(),
        name="activity-attempt",
    ),
    # Badges
    path("badges", views.BadgesListView.as_view(), name="badges-list"),
    path("badge-progress", views.BadgeProgressView.as_view(), name="badge-progress"),
    # Bookmarks
    path("bookmarks", views.BookmarksView.as_view(), name="bookmarks"),
    # Notifications
    path("notifications", views.NotificationsView.as_view(), name="notifications"),
    # Diagnóstico general del curso + prueba de cierre
    path("course/status", views.CourseStatusView.as_view(), name="course-status"),
    path("course/diagnostic", views.CourseDiagnosticView.as_view(), name="course-diagnostic"),
    path("course/final-exam", views.FinalExamView.as_view(), name="course-final-exam"),
]
