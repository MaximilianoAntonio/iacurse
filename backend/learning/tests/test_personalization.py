"""
Tests del flujo diagnóstico → personalización y de reportes de error.

Cubre:
- POST /api/units/<slug> con respuestas → crea PersonalizedUnit (con el
  provider fallback de test, el contenido adaptado es el contenido base).
- Validación de forma del body (400 ante respuestas vacías o mal formadas).
- Opción "Saltar diagnóstico" (skipped=True, contenido base).
- GET /api/units y /api/units/<slug> exponen flags de adaptación y progreso real.
- Permisos de /api/report: cualquier autenticado crea; solo docentes listan/moderan.
- Permisos del CRUD admin del currículo: solo docentes.
- Al editar las preguntas de diagnóstico se invalidan las adaptaciones previas.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, Lesson, Unit
from learning.models import ErrorReport, PersonalizedUnit

User = get_user_model()

UNIT_CONTENT = "## Sección 1\n\nContenido base de la unidad."
DIAGNOSTIC_QUESTIONS = ["¿Qué sabes de bioseñales?", "¿Has usado electrodos?"]


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT
    )


@pytest.fixture
def teacher(db):
    return User.objects.create_user(
        username="t", email="t@uv.cl", password="X", role=User.ROLE_TEACHER
    )


@pytest.fixture
def student_client(student):
    c = APIClient()
    c.force_authenticate(user=student)
    return c


@pytest.fixture
def teacher_client(teacher):
    c = APIClient()
    c.force_authenticate(user=teacher)
    return c


@pytest.fixture
def unit(db):
    """Unidad con contenido base, diagnóstico y una actividad publicada."""
    unit = Unit.objects.create(
        slug="u1", title="Bioseñales", order=1,
        content=UNIT_CONTENT, diagnostic_questions=DIAGNOSTIC_QUESTIONS,
    )
    lesson = Lesson.objects.create(unit=unit, slug="l1", title="Lección 1", order=1)
    Activity.objects.create(
        lesson=lesson, type="multiple_choice", title="A1", prompt="P",
        data={"options": ["A", "B"], "correctIndex": 0}, points=10,
    )
    return unit


VALID_ANSWERS = [
    {"question": DIAGNOSTIC_QUESTIONS[0], "answer": "Son señales del cuerpo."},
    {"question": DIAGNOSTIC_QUESTIONS[1], "answer": "Sí, en el lab de fisiología."},
]


@pytest.mark.django_db
class TestDiagnosticPost:
    def test_submit_answers_creates_personalized_unit(self, student_client, student, unit):
        resp = student_client.post(
            f"/api/units/{unit.slug}", {"answers": VALID_ANSWERS}, format="json"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["hasAdaptedContent"] is True
        assert body["diagnosticSkipped"] is False
        assert body["diagnosticAnswers"] == VALID_ANSWERS
        # Con AI_PROVIDER=fallback (settings de test) se usa el contenido base.
        assert body["adaptedContent"] == UNIT_CONTENT

        pu = PersonalizedUnit.objects.get(user=student, unit=unit)
        assert pu.skipped is False
        assert pu.diagnostic_answers == VALID_ANSWERS
        assert pu.adapted_content == UNIT_CONTENT

    def test_resubmit_overwrites_previous(self, student_client, student, unit):
        student_client.post(f"/api/units/{unit.slug}", {"answers": VALID_ANSWERS}, format="json")
        new_answers = [{"question": q, "answer": "Otra respuesta"} for q in DIAGNOSTIC_QUESTIONS]
        resp = student_client.post(
            f"/api/units/{unit.slug}", {"answers": new_answers}, format="json"
        )
        assert resp.status_code == 200
        assert PersonalizedUnit.objects.filter(user=student, unit=unit).count() == 1
        assert PersonalizedUnit.objects.get(user=student, unit=unit).diagnostic_answers == new_answers

    @pytest.mark.parametrize("payload", [
        {},                                        # sin answers
        {"answers": []},                           # lista vacía
        {"answers": ["no-es-un-dict"]},            # forma inválida
        {"answers": [{"question": "Q", "answer": ""}]},   # respuesta vacía
        {"answers": [{"question": "", "answer": "A"}]},   # pregunta vacía
    ])
    def test_invalid_payloads_return_400(self, student_client, unit, payload):
        resp = student_client.post(f"/api/units/{unit.slug}", payload, format="json")
        assert resp.status_code == 400
        assert PersonalizedUnit.objects.count() == 0

    def test_skip_marks_skipped_and_uses_base_content(self, student_client, student, unit):
        resp = student_client.post(f"/api/units/{unit.slug}", {"skip": True}, format="json")
        assert resp.status_code == 200
        body = resp.json()
        assert body["diagnosticSkipped"] is True
        assert body["adaptedContent"] == UNIT_CONTENT
        assert PersonalizedUnit.objects.get(user=student, unit=unit).skipped is True

    def test_requires_auth(self, unit):
        resp = APIClient().post(
            f"/api/units/{unit.slug}", {"answers": VALID_ANSWERS}, format="json"
        )
        assert resp.status_code in (401, 403)


@pytest.mark.django_db
class TestUnitEndpointsExposeAdaptation:
    def test_unit_detail_reflects_personalization(self, student_client, student, unit):
        student_client.post(f"/api/units/{unit.slug}", {"answers": VALID_ANSWERS}, format="json")
        resp = student_client.get(f"/api/units/{unit.slug}")
        assert resp.status_code == 200
        u = resp.json()["unit"]
        assert u["hasAdaptedContent"] is True
        assert u["adaptedContent"] == UNIT_CONTENT
        assert u["diagnosticSkipped"] is False
        assert u["diagnosticAnswers"] == VALID_ANSWERS
        assert u["diagnosticQuestions"] == DIAGNOSTIC_QUESTIONS
        # Progreso real: 0 actividades completadas de 1
        progress = resp.json()["progress"]
        assert progress["completed"] == 0
        assert progress["total"] == 1

    def test_unit_detail_without_personalization(self, student_client, unit):
        resp = student_client.get(f"/api/units/{unit.slug}")
        u = resp.json()["unit"]
        assert u["hasAdaptedContent"] is False
        assert u["adaptedContent"] == ""
        assert u["diagnosticSkipped"] is False

    def test_units_list_flags_and_counts(self, student_client, unit):
        resp = student_client.get("/api/units")
        assert resp.status_code == 200
        (u,) = resp.json()["units"]
        assert u["hasAdaptedContent"] is False
        assert u["lessonCount"] == 1
        assert u["activityCount"] == 1
        assert u["progress"]["total"] == 1

        student_client.post(f"/api/units/{unit.slug}", {"skip": True}, format="json")
        (u,) = student_client.get("/api/units").json()["units"]
        assert u["hasAdaptedContent"] is True
        assert u["diagnosticSkipped"] is True


@pytest.mark.django_db
class TestReportPermissions:
    def _create_report(self, student_client):
        return student_client.post(
            "/api/report",
            {"source": "content", "sourceId": "lesson:abc", "reason": "incorrect",
             "comment": "La fórmula está mal"},
            format="json",
        )

    def test_student_can_create_report(self, student_client, student):
        resp = self._create_report(student_client)
        assert resp.status_code == 201
        assert ErrorReport.objects.filter(user=student, source="content").count() == 1

    def test_student_cannot_list_or_moderate(self, student_client):
        self._create_report(student_client)
        assert student_client.get("/api/report").status_code == 403
        report_id = ErrorReport.objects.get().id
        resp = student_client.patch(
            "/api/report", {"reportId": report_id, "status": "resolved"}, format="json"
        )
        assert resp.status_code == 403
        assert ErrorReport.objects.get().status == "open"

    def test_teacher_lists_and_moderates(self, student_client, teacher_client):
        self._create_report(student_client)
        resp = teacher_client.get("/api/report?status=open")
        assert resp.status_code == 200
        reports = resp.json()["reports"]
        assert len(reports) == 1
        assert reports[0]["source"] == "content"
        assert reports[0]["reporterEmail"] == "s@uv.cl"

        resp = teacher_client.patch(
            "/api/report", {"reportId": reports[0]["id"], "status": "reviewed"}, format="json"
        )
        assert resp.status_code == 200
        assert ErrorReport.objects.get().status == "reviewed"

        # Filtro por fuente
        assert teacher_client.get("/api/report?status=all&source=chat").json()["reports"] == []
        assert len(teacher_client.get("/api/report?status=all&source=content").json()["reports"]) == 1


@pytest.mark.django_db
class TestUploadSecurity:
    """Seguridad de /api/uploads: firma mágica, no content_type declarado."""

    PNG_BYTES = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    def test_teacher_uploads_valid_png(self, teacher_client):
        from io import BytesIO
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile("pixel.png", self.PNG_BYTES, content_type="image/png")
        resp = teacher_client.post("/api/uploads", {"file": f}, format="multipart")
        assert resp.status_code == 201
        assert resp.json()["url"].startswith("/media/uploads/")
        assert resp.json()["url"].endswith(".png")

    def test_spoofed_content_type_rejected(self, teacher_client):
        # Un .txt declarado como image/png: el content_type miente → 400
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile("evil.png", b"no soy una imagen", content_type="image/png")
        resp = teacher_client.post("/api/uploads", {"file": f}, format="multipart")
        assert resp.status_code == 400

    def test_svg_rejected(self, teacher_client):
        # SVG puede llevar <script> (XSS almacenado bajo /media/)
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile("icon.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>', content_type="image/svg+xml")
        resp = teacher_client.post("/api/uploads", {"file": f}, format="multipart")
        assert resp.status_code == 400

    def test_student_cannot_upload(self, student_client):
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile("pixel.png", self.PNG_BYTES, content_type="image/png")
        resp = student_client.post("/api/uploads", {"file": f}, format="multipart")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestAdminCurriculumPermissions:
    def test_student_forbidden_on_admin_endpoints(self, student_client, unit):
        assert student_client.get("/api/admin/units").status_code == 403
        resp = student_client.patch(
            "/api/admin/units", {"unitId": unit.id, "title": "Hackeado"}, format="json"
        )
        assert resp.status_code == 403
        unit.refresh_from_db()
        assert unit.title == "Bioseñales"

    def test_teacher_edits_unit(self, teacher_client, unit):
        resp = teacher_client.patch(
            "/api/admin/units",
            {"unitId": unit.id, "content": "## Nuevo", "diagnosticQuestions": ["¿Nueva?"]},
            format="json",
        )
        assert resp.status_code == 200
        unit.refresh_from_db()
        assert unit.content == "## Nuevo"
        assert unit.diagnostic_questions == ["¿Nueva?"]

    def test_editing_questions_invalidates_adaptations(
        self, student_client, teacher_client, student, unit
    ):
        student_client.post(f"/api/units/{unit.slug}", {"answers": VALID_ANSWERS}, format="json")
        assert PersonalizedUnit.objects.filter(unit=unit).count() == 1

        # Cambiar solo el contenido mantiene las adaptaciones
        teacher_client.patch(
            "/api/admin/units", {"unitId": unit.id, "content": "## Editado"}, format="json"
        )
        assert PersonalizedUnit.objects.filter(unit=unit).count() == 1

        # Cambiar las preguntas las invalida (el diagnóstico anterior quedó obsoleto)
        teacher_client.patch(
            "/api/admin/units",
            {"unitId": unit.id, "diagnosticQuestions": ["¿Pregunta distinta?"]},
            format="json",
        )
        assert PersonalizedUnit.objects.filter(unit=unit).count() == 0
