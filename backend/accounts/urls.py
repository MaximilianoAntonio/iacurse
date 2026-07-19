"""URLs de cuentas (Módulo de acceso del lineamiento)."""
from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    # Auth
    path("auth/csrf", views.CsrfTokenView.as_view(), name="csrf"),
    path("auth/register", views.RegisterView.as_view(), name="register"),
    path("auth/login", views.LoginView.as_view(), name="login"),
    path("auth/logout", views.LogoutView.as_view(), name="logout"),
    # Usuario actual y lista
    path("me", views.MeView.as_view(), name="me"),
    path("users", views.UsersView.as_view(), name="users"),
    path("user/weekly-goal", views.WeeklyGoalView.as_view(), name="weekly-goal"),
]
