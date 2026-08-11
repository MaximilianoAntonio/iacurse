"""URLs del Course Builder docente (CRUD admin del currículo + uploads)."""
from django.urls import path

from . import views

app_name = "sandbox"

urlpatterns = [
    path("admin/units", views.AdminUnitsView.as_view(), name="admin-units"),
    path("admin/units/<str:unit_id>", views.AdminUnitDetailView.as_view(), name="admin-unit-detail"),
    path("admin/lessons", views.AdminLessonsView.as_view(), name="admin-lessons"),
    path("admin/activities", views.AdminActivitiesView.as_view(), name="admin-activities"),
    path("admin/objectives", views.AdminObjectivesView.as_view(), name="admin-objectives"),
    path("admin/rubrics", views.AdminRubricsView.as_view(), name="admin-rubrics"),
    # Evaluaciones del curso (diagnóstico general + prueba de cierre)
    path("admin/course/diagnostic", views.AdminCourseDiagnosticView.as_view(), name="admin-course-diagnostic"),
    path("admin/course/final-exam", views.AdminFinalExamView.as_view(), name="admin-course-final-exam"),
    # Subida de imágenes para el editor de contenido
    path("uploads", views.UploadImageView.as_view(), name="uploads"),
]
