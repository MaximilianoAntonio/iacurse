"""
Exportación de los datos de investigación (Ficha de registro, gestión y
trazabilidad de los datos de investigación, UV — versión 2026-08-V2, §3).

Responsable de estos archivos según la ficha (§7): el COINVESTIGADOR. El
profesor de la asignatura no tiene acceso a estas exportaciones ni al estado
individual del consentimiento. Los CSV se custodian en la cuenta
institucional de Microsoft 365 del coinvestigador y las tablas con primer
código se eliminan una vez subidas las notas al registro académico
(§8-§9: custodia y borrado son proceso manual, fuera de la plataforma).

Uso:
    python manage.py export_research_data --kind consent
    python manage.py export_research_data --kind mapping
    python manage.py export_research_data --kind scientific [--out DIR]

Tipos de salida:
    consent    → consent_registry.csv (§3.2): primer código, decisión,
                 fecha/hora, versión del documento y estado (vigente/retirado).
                 NUNCA incluye el segundo código.
    mapping    → code_mapping.csv (§3.3): correspondencia primer código ↔
                 segundo código (solo quienes autorizaron).
    scientific → base científica (§3.4): attempts/progress/sessions/final_exam/
                 diagnostic, solo de estudiantes con autorización VIGENTE y
                 solo bajo el segundo código (nunca el primer código ni datos
                 identificables).
"""
import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from learning.models import (
    Attempt,
    CourseDiagnosticResult,
    FinalExamAttempt,
    Progress,
    StudentConsent,
    StudySession,
)

KINDS = ("consent", "mapping", "scientific")


def _consent_queryset():
    return StudentConsent.objects.select_related("user").order_by("user__student_code")


def _write_csv(path: Path, header: list[str], rows) -> int:
    count = 0
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


class Command(BaseCommand):
    help = "Exporta los CSV de investigación (registro de consentimiento, tabla de correspondencia y base científica)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--kind",
            required=True,
            choices=KINDS,
            help="Tipo de exportación: consent | mapping | scientific.",
        )
        parser.add_argument(
            "--out",
            default="",
            help="Directorio de salida (default: research_export/<timestamp>/).",
        )

    def handle(self, *args, **options):
        kind = options["kind"]
        out_dir = Path(options["out"]) if options["out"] else (
            Path("research_export") / timezone.now().strftime("%Y%m%d_%H%M%S")
        )
        out_dir.mkdir(parents=True, exist_ok=True)

        if kind == "consent":
            self._export_consent(out_dir)
        elif kind == "mapping":
            self._export_mapping(out_dir)
        elif kind == "scientific":
            self._export_scientific(out_dir)
        else:  # pragma: no cover - argparse choices lo impide
            raise CommandError(f"Tipo desconocido: {kind}")

    def _export_consent(self, out_dir: Path) -> None:
        """Registro electrónico del consentimiento (§3.2): primer código,
        decisión, fecha, hora, versión y estado. Sin segundo código."""
        def rows():
            for c in _consent_queryset():
                if c.decision == StudentConsent.DECISION_AUTHORIZED:
                    estado = "retirado" if c.revoked_at else "vigente"
                else:
                    estado = "-"
                yield [
                    c.user.student_code or "",
                    c.get_decision_display(),
                    timezone.localtime(c.decided_at).strftime("%Y-%m-%d %H:%M:%S"),
                    c.version,
                    estado,
                    timezone.localtime(c.revoked_at).strftime("%Y-%m-%d %H:%M:%S") if c.revoked_at else "",
                ]

        path = out_dir / "consent_registry.csv"
        count = _write_csv(
            path,
            ["primer_codigo", "decision", "fecha_hora", "version_consentimiento", "estado", "fecha_hora_retiro"],
            rows(),
        )
        self.stdout.write(f"{path}: {count} registros de consentimiento")

    def _export_mapping(self, out_dir: Path) -> None:
        """Tabla de correspondencia primer código ↔ segundo código (§3.3)."""
        def rows():
            for c in _consent_queryset().filter(
                decision=StudentConsent.DECISION_AUTHORIZED
            ):
                yield [c.user.student_code or "", c.research_code or ""]

        path = out_dir / "code_mapping.csv"
        count = _write_csv(path, ["primer_codigo", "segundo_codigo"], rows())
        self.stdout.write(f"{path}: {count} correspondencias (solo autorizados)")

    def _export_scientific(self, out_dir: Path) -> None:
        """Base científica (§3.4): solo autorización vigente (sin retiros),
        clave ``research_code`` únicamente (nunca el primer código)."""
        active = {
            c.user_id: c.research_code
            for c in StudentConsent.objects.filter(
                decision=StudentConsent.DECISION_AUTHORIZED, revoked_at__isnull=True
            )
        }
        if not active:
            self.stdout.write("No hay autorizaciones vigentes: nada que exportar.")
            return
        user_ids = list(active.keys())

        # attempts.csv — número de intento por actividad, score, tiempo, pistas
        attempt_counters: dict[tuple, int] = {}

        def attempt_rows():
            for a in (
                Attempt.objects.filter(user_id__in=user_ids)
                .order_by("user_id", "activity_id", "created_at")
                .iterator()
            ):
                key = (a.user_id, a.activity_id)
                attempt_counters[key] = attempt_counters.get(key, 0) + 1
                yield [
                    active[a.user_id],
                    a.activity_id,
                    attempt_counters[key],
                    a.score if a.score is not None else "",
                    int(a.correct) if a.correct is not None else "",
                    a.time_spent,
                    a.hints_used,
                    a.created_at.isoformat(),
                ]

        count = _write_csv(
            out_dir / "attempts.csv",
            ["segundo_codigo", "activity_id", "n_intento", "score", "correct", "time_spent_sec", "hints_used", "created_at"],
            attempt_rows(),
        )
        self.stdout.write(f"{out_dir / 'attempts.csv'}: {count} intentos")

        # progress.csv — avance por unidad
        count = _write_csv(
            out_dir / "progress.csv",
            ["segundo_codigo", "unit_id", "completed", "total", "mastery", "last_visited"],
            (
                [
                    active[p.user_id],
                    p.unit_id,
                    p.completed,
                    p.total,
                    p.mastery,
                    p.last_visited.isoformat() if p.last_visited else "",
                ]
                for p in Progress.objects.filter(user_id__in=user_ids).order_by("user_id", "unit_id")
            ),
        )
        self.stdout.write(f"{out_dir / 'progress.csv'}: {count} registros de avance")

        # sessions.csv — tiempo de interacción (heartbeat)
        count = _write_csv(
            out_dir / "sessions.csv",
            ["segundo_codigo", "unit_id", "started_at", "duration_sec"],
            (
                [active[s.user_id], s.unit_id or "", s.started_at.isoformat(), s.duration]
                for s in StudySession.objects.filter(user_id__in=user_ids).order_by("user_id", "started_at")
            ),
        )
        self.stdout.write(f"{out_dir / 'sessions.csv'}: {count} sesiones de estudio")

        # final_exam.csv — prueba de cierre
        count = _write_csv(
            out_dir / "final_exam.csv",
            ["segundo_codigo", "score", "passed", "created_at"],
            (
                [active[f.user_id], f.score, int(f.passed), f.created_at.isoformat()]
                for f in FinalExamAttempt.objects.filter(user_id__in=user_ids).order_by("user_id", "created_at")
            ),
        )
        self.stdout.write(f"{out_dir / 'final_exam.csv'}: {count} intentos de prueba de cierre")

        # diagnostic.csv — diagnóstico general completado
        count = _write_csv(
            out_dir / "diagnostic.csv",
            ["segundo_codigo", "completed", "created_at"],
            (
                [active[d.user_id], 1, d.created_at.isoformat()]
                for d in CourseDiagnosticResult.objects.filter(user_id__in=user_ids)
            ),
        )
        self.stdout.write(f"{out_dir / 'diagnostic.csv'}: {count} diagnósticos")
