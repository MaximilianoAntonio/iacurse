"""
Vistas de reportes de error (lineamiento: 'Reportar error').

Reproduce src/app/api/report/route.ts (POST crear, GET listar, PATCH estado).
Todas requieren sesión real (sin modo demo). Crear reportes lo puede hacer
cualquier usuario autenticado; listarlos y moderarlos es solo de docentes.
"""
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsTeacher
from learning.models import ErrorReport

VALID_SOURCES = {"activity", "content", "platform"}
VALID_REASONS = {"incorrect", "biased", "offtopic", "harmful", "bug", "other"}
VALID_STATUSES = {"open", "reviewed", "resolved"}


class ReportView(views.APIView):
    """POST /api/report — crea un reporte de error (cualquier usuario).
    GET /api/report — lista reportes (solo docentes).
    PATCH /api/report — cambia el estado de un reporte (solo docentes).
    """

    def get_permissions(self):
        # La moderación de reportes es exclusiva del docente; crearlos no.
        if self.request.method in ("GET", "PATCH"):
            return [IsAuthenticated(), IsTeacher()]
        return [IsAuthenticated()]

    def post(self, request):
        source = request.data.get("source")
        reason = request.data.get("reason")
        if source not in VALID_SOURCES:
            return Response({"error": "source inválido"}, status=status.HTTP_400_BAD_REQUEST)
        if reason not in VALID_REASONS:
            return Response({"error": "reason inválido"}, status=status.HTTP_400_BAD_REQUEST)
        comment = (request.data.get("comment") or "")[:1000]
        source_id = request.data.get("sourceId") or ""
        report = ErrorReport.objects.create(
            user=request.user, source=source, source_id=source_id,
            reason=reason, comment=comment,
        )
        return Response({"ok": True, "reportId": report.id}, status=status.HTTP_201_CREATED)

    def get(self, request):
        """Lista reportes para el panel docente (filtros: status, source).

        Los reportantes estudiantes se identifican solo por su código
        anonimizado; los docentes mantienen su nombre.
        """
        status_param = request.query_params.get("status", "open")
        source_param = request.query_params.get("source")
        qs = ErrorReport.objects.select_related("user").order_by("-created_at")
        if status_param != "all":
            qs = qs.filter(status=status_param)
        if source_param in VALID_SOURCES:
            qs = qs.filter(source=source_param)
        return Response({
            "reports": [
                {
                    "id": r.id, "source": r.source, "sourceId": r.source_id,
                    "reason": r.reason, "comment": r.comment, "status": r.status,
                    "reporterCode": (
                        r.user.student_code if r.user.is_student else None
                    ),
                    "reporterName": r.user.name if r.user.is_teacher else None,
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
