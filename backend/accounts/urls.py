"""URLs de cuentas (Módulo de acceso del lineamiento)."""
from django.urls import path

from . import admin_views, views

app_name = "accounts"

urlpatterns = [
    # Auth
    path("auth/csrf", views.CsrfTokenView.as_view(), name="csrf"),
    path("auth/login", views.LoginView.as_view(), name="login"),
    path("auth/logout", views.LogoutView.as_view(), name="logout"),
    path(
        "auth/change-password",
        views.ChangePasswordView.as_view(),
        name="change-password",
    ),
    # Usuario actual
    path("me", views.MeView.as_view(), name="me"),
    # Exportación de datos personales (derecho de acceso/portabilidad)
    path("me/data", views.MeDataExportView.as_view(), name="me-data"),
    # Gestión de estudiantes (solo docentes)
    path("admin/students", admin_views.StudentsAdminView.as_view(), name="admin-students"),
    path(
        "admin/students/<int:user_id>/reset-password",
        admin_views.StudentResetPasswordView.as_view(),
        name="admin-student-reset-password",
    ),
]
