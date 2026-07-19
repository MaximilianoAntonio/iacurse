"""URLs de reportes de error IA."""
from django.urls import path

from . import views

app_name = "reports"

urlpatterns = [
    path("report", views.ReportView.as_view(), name="report"),
]
