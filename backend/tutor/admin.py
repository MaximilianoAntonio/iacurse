"""Admin de tutor — andamiaje CAAMI, trazabilidad de IA y corpus RAG."""
from django.contrib import admin

from .models import AIInteraction, KnowledgeChunk, ScaffoldingState


@admin.register(ScaffoldingState)
class ScaffoldingStateAdmin(admin.ModelAdmin):
    list_display = ("user", "activity", "current_level", "failed_attempts", "awaiting_verification", "verified")
    list_filter = ("current_level", "verified", "awaiting_verification")
    search_fields = ("user__username", "activity__title")
    readonly_fields = ("created_at", "updated_at")


@admin.register(AIInteraction)
class AIInteractionAdmin(admin.ModelAdmin):
    """Solo lectura: es un registro de trazabilidad, no se edita a mano."""

    list_display = ("operation_type", "provider", "model", "status", "latency_ms", "created_at")
    list_filter = ("operation_type", "provider", "status")
    search_fields = ("user__username", "operation_type")
    readonly_fields = [field.name for field in AIInteraction._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(KnowledgeChunk)
class KnowledgeChunkAdmin(admin.ModelAdmin):
    list_display = ("chunk_id", "kb_version", "unit", "topic", "document_id")
    list_filter = ("kb_version", "unit")
    search_fields = ("chunk_id", "content", "topic")
