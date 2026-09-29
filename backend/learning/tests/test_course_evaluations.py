"""
Tests del diagnóstico GENERAL del curso y de la prueba de cierre.

Cubre:
- GET /api/course/status: estudiante nuevo (pendiente, con preguntas), tras
  responder (sin preguntas), docente (gate no aplica), flags de finalExam.
- POST /api/course/diagnostic: ok (update_or_create), validaciones de forma,
  400 sin preguntas configuradas, 403 docente.
- all_units_completed: false con unidades incompletas, true con todas
  completas (Progress directo), unidades sin actividades no bloquean.
- GET /api/course/final-exam: 403 sin completar unidades / ya aprobado / sin
  intentos; ok completado y sin correctIndex en la respuesta.
- POST /api/course/final-exam: score exacto, aprobación en el umbral exacto,
  límite de intentos (403), 403 si ya aprobó, +100 puntos al aprobar.
- Admin evaluaciones: permiso estudiante 403, PATCH diagnóstico borra
  CourseDiagnosticResult, validaciones del PUT de la prueba de cierre.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from curriculum.models import Activity, CourseConfig, Lesson, Unit
from learning.models import (
    CourseDiagnosticResult,
    FinalExamAttempt,
    Progress,
)
from learning.services import all_units_completed

User = get_user_model()

DIAGNOSTIC_QUESTIONS = ["¿Experiencia previa?", "¿Conceptos de electrónica?"]
VALID_ANSWERS = [
    {"question": DIAGNOSTIC_QUESTIONS[0], "answer": "Prácticas de laboratorio."},
    {"question": DIAGNOSTIC_QUESTIONS[1], "answer": "Ley de Ohm y circuitos básicos."},
]

EXAM_QUESTIONS = [
    {"question": "¿Qué es un ECG?", "options": ["A", "B", "C"], "correctIndex": 1},
    {"question": "¿Qué es un transductor?", "options": ["A", "B"], "correctIndex": 0},
    {"question": "¿Para qué sirve un desfibrilador?", "options": ["A", "B"], "correctIndex": 0},
    {"question": "¿Qué es la corriente de fuga?", "options": ["A", "B"], "correctIndex": 1},
]
# pass_score 75 con 4 preguntas: 3 correctas = 75 (aprueba), 2 correctas = 50.


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT,
        student_code="EM-9001",
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
def config(db):
    """CourseConfig con diagnóstico general y prueba de cierre configurados."""
    config = CourseConfig.load()
    config.diagnostic_questions = DIAGNOSTIC_QUESTIONS
    config.final_exam_questions = EXAM_QUESTIONS
    config.final_exam_pass_score = 75
    config.final_exam_max_attempts = 2
    config.save()
    return config


@pytest.fixture
def units(db):
    """Dos unidades con actividades en lecciones publicadas (2 y 1)."""
    u1 = Unit.objects.create(slug="u1", title="Unidad 1", order=1)
    l1 = Lesson.objects.create(unit=u1, slug="l1", title="L1", order=1)
    Activity.objects.create(lesson=l1, type="multiple_choice", title="A1", prompt="P", data={}, points=10)
    Activity.objects.create(lesson=l1, type="multiple_choice", title="A2", prompt="P", data={}, points=10)
    u2 = Unit.objects.create(slug="u2", title="Unidad 2", order=2)
    l2 = Lesson.objects.create(unit=u2, slug="l2", title="L2", order=1)
    Activity.objects.create(lesson=l2, type="multiple_choice", title="A3", prompt="P", data={}, points=10)
    return u1, u2


def _complete_all_units(user, units):
    """Marca todas las unidades como completadas vía Progress."""
    Progress.objects.update_or_create(user=user, unit=units[0], defaults={"completed": 2, "total": 2})
    Progress.objects.update_or_create(user=user, unit=units[1], defaults={"completed": 1, "total": 1})


@pytest.mark.django_db
class TestCourseStatus:
    def test_new_student_pending_with_questions(self, student_client, config):
        body = student_client.get("/api/course/status").json()
        assert body["diagnosticCompleted"] is False
        assert body["diagnosticQuestions"] == DIAGNOSTIC_QUESTIONS
        assert body["allUnitsCompleted"] is False
        assert body["finalExam"] == {
            "configured": True, "passed": False, "bestScore": None,
            "attemptsUsed": 0, "maxAttempts": 2, "passScore": 75,
        }

    def test_after_answering_no_questions_exposed(self, student_client, student, config):
        student_client.post("/api/course/diagnostic", {"answers": VALID_ANSWERS}, format="json")
        body = student_client.get("/api/course/status").json()
        assert body["diagnosticCompleted"] is True
        assert "diagnosticQuestions" not in body

    def test_teacher_skips_gate(self, teacher_client, config):
        body = teacher_client.get("/api/course/status").json()
        assert body["diagnosticCompleted"] is True
        assert "diagnosticQuestions" not in body

    def test_no_questions_configured_disables_gate(self, student_client, config):
        """Sin preguntas de diagnóstico no hay gate: el POST rechazaría el envío
        (400) y el estudiante quedaría atrapado si el status lo marcara pendiente."""
        config.diagnostic_questions = []
        config.save(update_fields=["diagnostic_questions"])
        body = student_client.get("/api/course/status").json()
        assert body["diagnosticCompleted"] is True
        assert "diagnosticQuestions" not in body

    def test_status_reflects_final_exam_attempts(self, student_client, student, config, units):
        _complete_all_units(student, units)
        student_client.post("/api/course/final-exam", {"answers": [1, 0, 0, 1]}, format="json")
        body = student_client.get("/api/course/status").json()
        assert body["allUnitsCompleted"] is True
        assert body["finalExam"]["passed"] is True
        assert body["finalExam"]["bestScore"] == 100
        assert body["finalExam"]["attemptsUsed"] == 1


@pytest.mark.django_db
class TestCourseDiagnosticPost:
    def test_submit_ok(self, student_client, student, config):
        resp = student_client.post("/api/course/diagnostic", {"answers": VALID_ANSWERS}, format="json")
        assert resp.status_code == 200
        assert resp.json()["diagnosticCompleted"] is True
        result = CourseDiagnosticResult.objects.get(user=student)
        assert result.answers == VALID_ANSWERS

    def test_resubmit_overwrites(self, student_client, student, config):
        student_client.post("/api/course/diagnostic", {"answers": VALID_ANSWERS}, format="json")
        new_answers = [{"question": q, "answer": "Otra"} for q in DIAGNOSTIC_QUESTIONS]
        resp = student_client.post("/api/course/diagnostic", {"answers": new_answers}, format="json")
        assert resp.status_code == 200
        assert CourseDiagnosticResult.objects.filter(user=student).count() == 1
        assert CourseDiagnosticResult.objects.get(user=student).answers == new_answers

    @pytest.mark.parametrize("payload", [
        {},
        {"answers": []},
        {"answers": ["no-es-un-dict"]},
        {"answers": [{"question": "Q", "answer": ""}]},
        {"answers": [{"question": "", "answer": "A"}]},
    ])
    def test_invalid_payloads_return_400(self, student_client, config, payload):
        resp = student_client.post("/api/course/diagnostic", payload, format="json")
        assert resp.status_code == 400
        assert CourseDiagnosticResult.objects.count() == 0

    def test_400_without_configured_questions(self, student_client):
        resp = student_client.post("/api/course/diagnostic", {"answers": VALID_ANSWERS}, format="json")
        assert resp.status_code == 400
        assert CourseDiagnosticResult.objects.count() == 0

    def test_teacher_forbidden(self, teacher_client, config):
        resp = teacher_client.post("/api/course/diagnostic", {"answers": VALID_ANSWERS}, format="json")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestAllUnitsCompleted:
    def test_false_with_incomplete_units(self, student, units):
        assert all_units_completed(student) is False
        # Completar solo una de dos unidades sigue sin ser suficiente.
        Progress.objects.create(user=student, unit=units[0], completed=2, total=2)
        assert all_units_completed(student) is False

    def test_true_when_all_complete(self, student, units):
        _complete_all_units(student, units)
        assert all_units_completed(student) is True

    def test_no_units_is_false(self, student):
        assert all_units_completed(student) is False

    def test_units_without_activities_do_not_block(self, student, units):
        Unit.objects.create(slug="vacia", title="Vacía", order=3)
        _complete_all_units(student, units)
        assert all_units_completed(student) is True


@pytest.mark.django_db
class TestFinalExamGet:
    def test_403_without_completed_units(self, student_client, config, units):
        resp = student_client.get("/api/course/final-exam")
        assert resp.status_code == 403

    def test_ok_without_correct_index(self, student_client, student, config, units):
        _complete_all_units(student, units)
        resp = student_client.get("/api/course/final-exam")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["questions"]) == len(EXAM_QUESTIONS)
        assert all("correctIndex" not in q for q in body["questions"])
        assert body["questions"][0] == {"question": EXAM_QUESTIONS[0]["question"], "options": EXAM_QUESTIONS[0]["options"]}
        assert body["passScore"] == 75
        assert body["maxAttempts"] == 2
        assert body["attemptsUsed"] == 0

    def test_404_without_configured_exam(self, student_client, student, units):
        _complete_all_units(student, units)
        resp = student_client.get("/api/course/final-exam")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestFinalExamPost:
    ALL_CORRECT = [q["correctIndex"] for q in EXAM_QUESTIONS]  # [1, 0, 0, 1]

    def _setup(self, student, units):
        _complete_all_units(student, units)

    def test_score_exact_and_passed(self, student_client, student, config, units):
        self._setup(student, units)
        # 3 de 4 correctas = 75 == pass_score → aprueba en el umbral exacto.
        answers = [1, 0, 0, 0]  # última incorrecta (correcta es 1)
        resp = student_client.post("/api/course/final-exam", {"answers": answers}, format="json")
        assert resp.status_code == 200
        body = resp.json()
        assert body["score"] == 75
        assert body["passed"] is True
        assert body["correctCount"] == 3
        assert body["totalQuestions"] == 4
        assert body["attemptsUsed"] == 1
        assert body["maxAttempts"] == 2
        # Bonificación fija por aprobar (+100 puntos).
        student.refresh_from_db()
        assert student.points == 100

    def test_below_threshold_fails(self, student_client, student, config, units):
        self._setup(student, units)
        resp = student_client.post("/api/course/final-exam", {"answers": [1, 0, 1, 0]}, format="json")
        body = resp.json()
        assert body["score"] == 50
        assert body["passed"] is False
        student.refresh_from_db()
        assert student.points == 0

    def test_wrong_length_returns_400(self, student_client, student, config, units):
        self._setup(student, units)
        resp = student_client.post("/api/course/final-exam", {"answers": [0, 1]}, format="json")
        assert resp.status_code == 400
        assert FinalExamAttempt.objects.count() == 0

    def test_index_out_of_range_returns_400(self, student_client, student, config, units):
        self._setup(student, units)
        resp = student_client.post("/api/course/final-exam", {"answers": [1, 0, 0, 5]}, format="json")
        assert resp.status_code == 400
        assert FinalExamAttempt.objects.count() == 0

    def test_403_after_max_attempts(self, student_client, student, config, units):
        self._setup(student, units)
        for _ in range(config.final_exam_max_attempts):
            student_client.post("/api/course/final-exam", {"answers": [1, 0, 1, 0]}, format="json")
        assert student_client.get("/api/course/final-exam").status_code == 403
        resp = student_client.post("/api/course/final-exam", {"answers": self.ALL_CORRECT}, format="json")
        assert resp.status_code == 403
        assert FinalExamAttempt.objects.filter(user=student).count() == config.final_exam_max_attempts

    def test_403_if_already_passed(self, student_client, student, config, units):
        self._setup(student, units)
        student_client.post("/api/course/final-exam", {"answers": self.ALL_CORRECT}, format="json")
        assert student_client.get("/api/course/final-exam").status_code == 403
        resp = student_client.post("/api/course/final-exam", {"answers": self.ALL_CORRECT}, format="json")
        assert resp.status_code == 403
        assert FinalExamAttempt.objects.filter(user=student).count() == 1

    def test_403_without_completed_units(self, student_client, config, units):
        resp = student_client.post("/api/course/final-exam", {"answers": self.ALL_CORRECT}, format="json")
        assert resp.status_code == 403
        assert FinalExamAttempt.objects.count() == 0


@pytest.mark.django_db
class TestAdminCourseEvaluations:
    def test_student_forbidden(self, student_client, config):
        assert student_client.get("/api/admin/course/diagnostic").status_code == 403
        assert student_client.get("/api/admin/course/final-exam").status_code == 403
        resp = student_client.patch(
            "/api/admin/course/diagnostic", {"questions": ["¿X?"]}, format="json"
        )
        assert resp.status_code == 403
        resp = student_client.put(
            "/api/admin/course/final-exam",
            {"questions": [], "passScore": 70, "maxAttempts": 3}, format="json",
        )
        assert resp.status_code == 403

    def test_teacher_gets_diagnostic_questions(self, teacher_client, config):
        body = teacher_client.get("/api/admin/course/diagnostic").json()
        assert body["questions"] == DIAGNOSTIC_QUESTIONS

    def test_patch_diagnostic_replaces_and_deletes_results(self, teacher_client, student_client, student, config):
        # El estudiante responde el diagnóstico actual.
        student_client.post("/api/course/diagnostic", {"answers": VALID_ANSWERS}, format="json")
        assert CourseDiagnosticResult.objects.count() == 1

        resp = teacher_client.patch(
            "/api/admin/course/diagnostic",
            {"questions": ["¿Pregunta nueva?"]}, format="json",
        )
        assert resp.status_code == 200
        config.refresh_from_db()
        assert config.diagnostic_questions == ["¿Pregunta nueva?"]
        # Las respuestas previas quedaron obsoletas: se borran (se repite).
        assert CourseDiagnosticResult.objects.count() == 0
        # El estudiante vuelve a estar pendiente.
        assert student_client.get("/api/course/status").json()["diagnosticCompleted"] is False

    @pytest.mark.parametrize("questions", [
        "no-es-lista",
        ["", "¿ok?"],
        ["¿ok?", 42],
    ])
    def test_patch_diagnostic_validations(self, teacher_client, config, questions):
        resp = teacher_client.patch(
            "/api/admin/course/diagnostic", {"questions": questions}, format="json"
        )
        assert resp.status_code == 400
        config.refresh_from_db()
        assert config.diagnostic_questions == DIAGNOSTIC_QUESTIONS

    def test_teacher_gets_final_exam_config(self, teacher_client, config):
        body = teacher_client.get("/api/admin/course/final-exam").json()
        assert body["questions"] == EXAM_QUESTIONS
        assert body["passScore"] == 75
        assert body["maxAttempts"] == 2

    def test_put_final_exam_ok(self, teacher_client, config):
        new_exam = [
            {"question": "¿P1?", "options": ["A", "B", "C", "D"], "correctIndex": 3},
        ]
        resp = teacher_client.put(
            "/api/admin/course/final-exam",
            {"questions": new_exam, "passScore": 60, "maxAttempts": 5}, format="json",
        )
        assert resp.status_code == 200
        config.refresh_from_db()
        assert config.final_exam_questions == new_exam
        assert config.final_exam_pass_score == 60
        assert config.final_exam_max_attempts == 5

    @pytest.mark.parametrize("payload", [
        # menos de 2 opciones
        {"questions": [{"question": "Q", "options": ["A"], "correctIndex": 0}], "passScore": 70, "maxAttempts": 3},
        # opción vacía
        {"questions": [{"question": "Q", "options": ["A", ""], "correctIndex": 0}], "passScore": 70, "maxAttempts": 3},
        # correctIndex fuera de rango
        {"questions": [{"question": "Q", "options": ["A", "B"], "correctIndex": 2}], "passScore": 70, "maxAttempts": 3},
        # enunciado vacío
        {"questions": [{"question": "", "options": ["A", "B"], "correctIndex": 0}], "passScore": 70, "maxAttempts": 3},
        # passScore fuera de rango
        {"questions": [], "passScore": 0, "maxAttempts": 3},
        {"questions": [], "passScore": 101, "maxAttempts": 3},
        # maxAttempts fuera de rango
        {"questions": [], "passScore": 70, "maxAttempts": 0},
        {"questions": [], "passScore": 70, "maxAttempts": 11},
    ])
    def test_put_final_exam_validations(self, teacher_client, config, payload):
        resp = teacher_client.put("/api/admin/course/final-exam", payload, format="json")
        assert resp.status_code == 400
        config.refresh_from_db()
        assert config.final_exam_questions == EXAM_QUESTIONS
        assert config.final_exam_pass_score == 75
        assert config.final_exam_max_attempts == 2
