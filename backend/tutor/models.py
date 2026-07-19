"""
Modelos del tutor IA — historial de conversación.

Mapeo 1:1 desde prisma/schema.prisma ChatMessage.
"""
import uuid

from django.conf import settings
from django.db import models


def _cuid_default() -> str:
    return f"c{uuid.uuid4().hex[:24]}"


class ChatMessage(models.Model):
    """Mensaje del historial de chat con el tutor IA."""

    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_CHOICES = [
        (ROLE_USER, "Usuario"),
        (ROLE_ASSISTANT, "Asistente IA"),
    ]

    id = models.CharField(primary_key=True, max_length=40, default=_cuid_default, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages")
    role = models.CharField("rol", max_length=16, choices=ROLE_CHOICES)
    content = models.TextField("contenido")
    context = models.CharField("contexto", max_length=255, blank=True, default="")
    rating = models.IntegerField("calificación (1-5)", null=True, blank=True)
    created_at = models.DateTimeField("fecha/hora", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "mensaje de chat"
        verbose_name_plural = "mensajes de chat"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["user", "role"]),
        ]

    def __str__(self) -> str:
        return f"[{self.role}] {self.content[:60]}"
