"""
Purga de registros de telemetría y auditoría según política de retención.

Política de trazabilidad (2.9): 12 meses en almacenamiento en caliente.
El archivo en frío (24 meses) se cubre con los respaldos periódicos de la
base de datos (ver DEPLOY.md), no con tablas vivas.

Uso:
    python manage.py purge_telemetry            # aplica la retención
    python manage.py purge_telemetry --dry-run  # solo muestra qué borraría

Plazos configurables por entorno:
    TELEMETRY_RETENTION_DAYS   (default 365) — AccessLog, EventLog, StudySession
    AUDIT_LOG_RETENTION_DAYS   (default 365) — AuditLog

Programar su ejecución periódica (p. ej. cron semanal) en el servidor.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from learning.models import StudySession
from telemetry.models import AccessLog, AuditLog, EventLog


class Command(BaseCommand):
    help = "Elimina registros de telemetría/auditoría más antiguos que el plazo de retención."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra cuántos registros se eliminarían sin borrar nada.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        telemetry_days = getattr(settings, "TELEMETRY_RETENTION_DAYS", 365)
        audit_days = getattr(settings, "AUDIT_LOG_RETENTION_DAYS", 365)

        plan = [
            ("AccessLog", AccessLog, telemetry_days),
            ("EventLog", EventLog, telemetry_days),
            ("StudySession", StudySession, telemetry_days),
            ("AuditLog", AuditLog, audit_days),
        ]
        for name, model, days in plan:
            cutoff = timezone.now() - timedelta(days=days)
            qs = model.objects.filter(created_at__lt=cutoff) if hasattr(model, "created_at") else model.objects.filter(started_at__lt=cutoff)
            count = qs.count()
            if dry_run:
                self.stdout.write(f"{name}: {count} registros anteriores a {cutoff:%Y-%m-%d} (dry-run, sin borrar)")
            else:
                deleted, _ = qs.delete()
                self.stdout.write(f"{name}: {deleted} registros eliminados (>{days} días)")
