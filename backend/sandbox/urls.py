"""URLs del sandbox docente (Course Builder)."""
from django.urls import path

from . import views

app_name = "sandbox"

urlpatterns = [
    # Courses
    path("courses", views.CoursesView.as_view(), name="courses"),
    path("courses/<str:course_id>", views.CourseDetailView.as_view(), name="course-detail"),
    # Question banks
    path("question-banks", views.QuestionBanksView.as_view(), name="question-banks"),
    path("question-banks/questions", views.QuestionsView.as_view(), name="questions"),
    # Data resources
    path("data-resources", views.DataResourcesView.as_view(), name="data-resources"),
    # Admin (currículo live)
    path("admin/units", views.AdminUnitsView.as_view(), name="admin-units"),
    path("admin/lessons", views.AdminLessonsView.as_view(), name="admin-lessons"),
    path("admin/activities", views.AdminActivitiesView.as_view(), name="admin-activities"),
    path("admin/objectives", views.AdminObjectivesView.as_view(), name="admin-objectives"),
    path("admin/rubrics", views.AdminRubricsView.as_view(), name="admin-rubrics"),
]
