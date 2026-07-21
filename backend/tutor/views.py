"""
Vistas del tutor IA — chat socrático.

Reproduce src/app/api/tutor/route.ts (POST chat, GET historial, PATCH rating).
Todas requieren sesión real (sin modo demo).
"""
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ChatMessage
from .services import tutor_chat


class TutorView(views.APIView):
    """POST /api/tutor — chat con el tutor IA.
    GET /api/tutor — historial de chat.
    PATCH /api/tutor — calificar un mensaje.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        message = request.data.get("message")
        context = request.data.get("context")
        if not message:
            return Response({"error": "Falta message"}, status=status.HTTP_400_BAD_REQUEST)

        assistant_msg = tutor_chat(user, message, context=context)

        # Evaluar badges (ej. tutor-activo tras 10 consultas)
        from learning.badges import check_and_award_badges
        new_badges = check_and_award_badges(user)
        response = {"message": assistant_msg}
        if new_badges:
            response["newBadges"] = [b.to_dict() for b in new_badges]
        return Response(response)

    def get(self, request):
        user = request.user
        messages = ChatMessage.objects.filter(user=user).order_by("created_at")[:100]
        return Response({
            "messages": [
                {
                    "id": m.id, "role": m.role, "content": m.content,
                    "context": m.context, "rating": m.rating,
                    "createdAt": m.created_at.isoformat(),
                }
                for m in messages
            ]
        })

    def patch(self, request):
        message_id = request.data.get("messageId")
        rating = request.data.get("rating")
        if not message_id or rating is None:
            return Response({"error": "Faltan datos"}, status=status.HTTP_400_BAD_REQUEST)
        ChatMessage.objects.filter(pk=message_id).update(rating=rating)
        return Response({"ok": True})
