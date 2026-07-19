"""
Vistas de reportes de error de IA (lineamiento: 'Reportar error').

Reproduce src/app/api/report/route.ts (POST crear, GET listar, PATCH estado).
"""
from rest_framework import status, views
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from learning.models import ErrorReport

VALID_SOURCES = {"chat", "activity", "content"}
VALID_REASONS = {"incorrect", "biased", "offtopic", "harmful", "other"}
VALID_STATUSES = {"open", "reviewed", "resolved"}


def _resolve_user(request) -> User:
    user = request.user if request.user.is_authenticated else None
    explicit = request.query_params.get("userId") or (request.data or {}).get("userId")
    if explicit:
        try:
            user = User.objects.get(pk=explicit)
        except User.DoesNotExist:
            user = None
    return user


class ReportView(views.APIView):
    """POST /api/report — crea un reporte de error de IA."""

    permission_classes = [AllowAny]

    def post(self, request):
        user = _resolve_user(request)
        if user is None:
            return Response({"error": "Usuario no encontrado"}, status=status.HTTP_400_BAD_REQUEST)
        source = request.data.get("source")
        reason = request.data.get("reason")
        if source not in VALID_SOURCES:
            return Response({"error": "source inválido"}, status=status.HTTP_400_BAD_REQUEST)
        if reason not in VALID_REASONS:
            return Response({"error": "reason inválido"}, status=status.HTTP_400_BAD_REQUEST)
        comment = (request.data.get("comment") or "")[:1000]
        source_id = request.data.get("sourceId") or ""
        report = ErrorReport.objects.create(
            user=user, source=source, source_id=source_id,
            reason=reason, comment=comment,
        )
        return Response({"ok": True, "reportId": report.id}, status=status.HTTP_201_CREATED)

    def get(self, request):
        """Lista reportes para el panel docente."""
        status_param = request.query_params.get("status", "open")
        qs = ErrorReport.objects.select_related("user").order_by("-created_at")
        if status_param != "all":
            qs = qs.filter(status=status_param)
        return Response({
            "reports": [
                {
                    "id": r.id, "source": r.source, "sourceId": r.source_id,
                    "reason": r.reason, "comment": r.comment, "status": r.status,
                    "reporterName": r.user.name, "reporterEmail": r.user.email,
                    "createdAt": r.created_at.isoformat(),
                }
                for r in qs
            ]
        })

    def patch(self, request):
        report_id = request.data.get("reportId")
        new_status = request.data.get("status")
        if not report_id:
            return Response({"error": "Falta reportId"}, status=status.HTTP_400_BAD_REQUEST)
        if new_status not in VALID_STATUSES:
            return Response({"error": "status inválido"}, status=status.HTTP_400_BAD_REQUEST)
        ErrorReport.objects.filter(pk=report_id).update(status=new_status)
        return Response({"ok": True})
