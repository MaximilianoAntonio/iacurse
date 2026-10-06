"""
Tests del comando ``export_research_data`` (ficha de datos §3).

Cubre:
- --kind consent: registro con primer código, decisión, fecha/hora, versión y
  estado; NUNCA contiene el segundo código.
- --kind mapping: correspondencia primer ↔ segundo código solo de quienes
  autorizaron.
- --kind scientific: base científica solo con autorización VIGENTE (excluye
  rechazos y retiros), solo bajo el segundo código (ningún CSV contiene el
  primer código).
"""
import csv
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from curriculum.models import Activity, Lesson, Unit
from learning.models import (
    Attempt,
    CourseDiagnosticResult,
    FinalExamAttempt,
    Progress,
    StudentConsent,
    StudySession,
)

User = get_user_model()


def _make_student(code: str) -> "User":
    return User.objects.create_user(
        username=code, email=f"{code.lower()}@students.local", password="X",
        role=User.ROLE_STUDENT, student_code=code,
    )


@pytest.fixture
def research_subjects(db):
    """Tres estudiantes: autorización vigente, autorización retirada y rechazo."""
    vigente = _make_student("EM-9101")
    retirado = _make_student("EM-9102")
    rechazado = _make_student("EM-9103")

    StudentConsent.objects.create(
        user=vigente, decision=StudentConsent.DECISION_AUTHORIZED,
        version="2026-08-V2", research_code="RX-VIGENTE01",
    )
    StudentConsent.objects.create(
        user=retirado, decision=StudentConsent.DECISION_AUTHORIZED,
        version="2026-08-V2", research_code="RX-RETIRADO1",
        revoked_at=timezone.now(),
    )
    StudentConsent.objects.create(
        user=rechazado, decision=StudentConsent.DECISION_REJECTED,
        version="2026-08-V2",
    )

    # Datos de actividad para los tres (la base científica debe quedarse solo
    # con los del vigente).
    unit = Unit.objects.create(slug="u-exp", title="Unidad exp", order=1)
    lesson = Lesson.objects.create(unit=unit, slug="l-exp", title="L exp", order=1)
    activity = Activity.objects.create(
        lesson=lesson, type="multiple_choice", title="A exp", prompt="P",
        data={}, points=10,
    )
    for s in (vigente, retirado, rechazado):
        Attempt.objects.create(user=s, activity=activity, answer="a", score=80, correct=True, time_spent=30)
        Progress.objects.create(user=s, unit=unit, completed=1, total=2, mastery=50)
        StudySession.objects.create(user=s, unit=unit, duration=120)
        FinalExamAttempt.objects.create(user=s, answers=[0], score=75, passed=True)
        CourseDiagnosticResult.objects.create(user=s, answers=[{"question": "q", "answer": "a"}])

    return {"vigente": vigente, "retirado": retirado, "rechazado": rechazado}


def _read(path: Path) -> list[list[str]]:
    with path.open(encoding="utf-8") as fh:
        return list(csv.reader(fh))


@pytest.mark.django_db
class TestExportConsent:
    def test_registry_has_first_code_and_version_but_no_research_code(self, research_subjects, tmp_path):
        call_command("export_research_data", kind="consent", out=str(tmp_path))
        rows = _read(tmp_path / "consent_registry.csv")
        header, data = rows[0], rows[1:]
        assert header == ["primer_codigo", "decision", "fecha_hora", "version_consentimiento", "estado", "fecha_hora_retiro"]
        assert len(data) == 3
        by_code = {r[0]: r for r in data}
        assert set(by_code) == {"EM-9101", "EM-9102", "EM-9103"}
        assert by_code["EM-9101"][4] == "vigente"
        assert by_code["EM-9102"][4] == "retirado"
        assert by_code["EM-9103"][4] == "-"
        assert all(r[3] == "2026-08-V2" for r in data)
        # El registro del consentimiento NO contiene el segundo código (§3.2).
        raw = (tmp_path / "consent_registry.csv").read_text(encoding="utf-8")
        assert "RX-" not in raw


@pytest.mark.django_db
class TestExportMapping:
    def test_mapping_only_authorized(self, research_subjects, tmp_path):
        call_command("export_research_data", kind="mapping", out=str(tmp_path))
        rows = _read(tmp_path / "code_mapping.csv")
        header, data = rows[0], rows[1:]
        assert header == ["primer_codigo", "segundo_codigo"]
        # Autorizados (vigente y retirado): la correspondencia existe para
        # ambos; el rechazado nunca tuvo segundo código.
        assert set(map(tuple, data)) == {
            ("EM-9101", "RX-VIGENTE01"),
            ("EM-9102", "RX-RETIRADO1"),
        }


@pytest.mark.django_db
class TestExportScientific:
    def test_only_active_consent_and_only_research_code(self, research_subjects, tmp_path):
        call_command("export_research_data", kind="scientific", out=str(tmp_path))
        for name in ("attempts", "progress", "sessions", "final_exam", "diagnostic"):
            path = tmp_path / f"{name}.csv"
            rows = _read(path)
            header, data = rows[0], rows[1:]
            assert header[0] == "segundo_codigo"
            # Solo el vigente: una fila por archivo, con su segundo código.
            assert len(data) == 1
            assert data[0][0] == "RX-VIGENTE01"
            # Ningún CSV contiene el primer código (§3.4).
            raw = path.read_text(encoding="utf-8")
            assert "EM-91" not in raw

    def test_attempt_numbering(self, research_subjects, tmp_path):
        vigente = research_subjects["vigente"]
        activity = Activity.objects.get(lesson__slug="l-exp")
        Attempt.objects.create(user=vigente, activity=activity, answer="b", score=100, correct=True, time_spent=20)
        call_command("export_research_data", kind="scientific", out=str(tmp_path))
        rows = _read(tmp_path / "attempts.csv")[1:]
        assert [int(r[2]) for r in rows] == [1, 2]

    def test_no_active_consent_writes_nothing(self, db, tmp_path):
        call_command("export_research_data", kind="scientific", out=str(tmp_path))
        assert list(Path(tmp_path).glob("*.csv")) == []
