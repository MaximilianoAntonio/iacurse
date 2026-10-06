"""Registro de modelos de aprendizaje en el admin de Django.

Solo se expone ``StudentConsent``: es la vía del COINVESTIGADOR para conocer
la correspondencia primer código ↔ código de investigación de quienes
consintieron. El acceso staff al admin debe quedar restringido al
coinvestigador — el docente de la asignatura NO debe tener cuenta staff,
porque este listado revela la decisión de cada estudiante.
"""
from django.contrib import admin

from .models import StudentConsent


@admin.register(StudentConsent)
class StudentConsentAdmin(admin.ModelAdmin):
    """Listado de consentimientos: evidencia del registro electrónico.

    Todo es de solo lectura: el consentimiento es evidencia auditable y no
    se edita a mano (el retiro se registra desde la propia plataforma).
    """

    list_display = (
        "student_code",
        "decision",
        "research_code",
        "version",
        "decided_at",
        "revoked_at",
    )
    list_filter = ("decision", "version")
    search_fields = ("user__student_code", "research_code")
    ordering = ("-decided_at",)

    @admin.display(description="Código de estudiante", ordering="user__student_code")
    def student_code(self, obj) -> str:
        return obj.user.student_code or str(obj.user_id)

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
