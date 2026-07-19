"""URLs del tutor IA."""
from django.urls import path

from . import views

app_name = "tutor"

urlpatterns = [
    path("tutor", views.TutorView.as_view(), name="tutor"),
]
