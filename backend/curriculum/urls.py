"""URLs de currículo."""
from django.urls import path

from . import views

app_name = "curriculum"

urlpatterns = [
    path("units", views.UnitsListView.as_view(), name="units-list"),
    path("units/<slug:slug>", views.UnitDetailView.as_view(), name="unit-detail"),
    path("lessons/<str:lesson_id>", views.LessonDetailView.as_view(), name="lesson-detail"),
]
