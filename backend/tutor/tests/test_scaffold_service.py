"""
Tests del orquestador de andamiaje CAAMI (tutor/services.py).

Usan un provider mock (monkeypatch de tutor.services.get_ai_provider) para
verificar: clasificación de error, generación por nivel (parsing a
ScaffoldOutcome), fallbacks pedagógicos y registro en AIInteraction.
"""
import pytest
from django.contrib.auth import get_user_model

from curriculum.models import Activity, Lesson, Unit
from tutor.ai.base import AIResult, AIServiceError
from tutor.ai.prompts import CAAMI_SCAFFOLD_VERSIONS, SCAFFOLD_FALLBACKS
from tutor.models import AIInteraction, ScaffoldingState
from tutor.services import generate_scaffold_support

User = get_user_model()


class MockProvider:
    """Provider configurable: define qué devuelven classify_error / generate_scaffold."""

    classify_payload = {
        "result": "incorrect",
        "error_type": "conceptual",
        "evidence": "Confunde impedancia con resistencia",
        "needs_clarification": False,
    }
    scaffold_payloads = {}
    classify_error_exc = None
    scaffold_exc = None

    def classify_error(self, **kwargs):
        if self.classify_error_exc:
            raise self.classify_error_exc
        return AIResult(
            payload=dict(self.classify_payload), model="mock-model",
            prompt_version="CAAMI_ERROR_v1", latency_ms=12,
            input_tokens=100, output_tokens=20, provider="mock",
        )

    def generate_scaffold(self, *, level, **kwargs):
        if self.scaffold_exc:
            raise self.scaffold_exc
        return AIResult(
            payload=dict(self.scaffold_payloads[level]), model="mock-model",
            prompt_version=CAAMI_SCAFFOLD_VERSIONS[level], latency_ms=15,
            input_tokens=200, output_tokens=50, provider="mock",
        )


VALID_PAYLOADS = {
    "A1": {
        "level": "A1", "support_type": "guiding_question",
        "message": "¿Qué magnitud eléctrica representa la señal que observas?",
        "requires_retry": True,
    },
    "A2": {
        "level": "A2", "support_type": "specific_hint", "error_focus": "conceptual",
        "message": "Revisa la diferencia entre impedancia y resistencia.",
        "requires_retry": True,
    },
    "A3": {
        "level": "A3", "support_type": "analogous_example",
        "message": "Piensa en un circuito RC doméstico equivalente...",
        "requires_retry": True,
    },
    "A4": {
        "level": "A4", "support_type": "guided_sequence",
        "steps": [
            {"step": 1, "prompt": "Identifica los datos del enunciado."},
            {"step": 2, "prompt": "Aplica la ley que corresponde."},
        ],
        "requires_student_input": True,
    },
    "A5": {
        "level": "A5", "support_type": "worked_solution",
        "explanation": "La resolución paso a paso es la siguiente...",
        "key_concepts": ["impedancia", "bioseñales"],
        "verification_required": True,
    },
}


@pytest.fixture
def student(db):
    return User.objects.create_user(
        username="s", email="s@uv.cl", password="X", role=User.ROLE_STUDENT
    )


@pytest.fixture
def activity(db):
    unit = Unit.objects.create(slug="u", title="Bioseñales", order=1)
    lesson = Lesson.objects.create(unit=unit, slug="l", title="ECG", order=1)
    return Activity.objects.create(
        lesson=lesson, type="short_answer", title="Señal ECG", prompt="P",
        data={"expected": "ok"},
    )


@pytest.fixture
def state(student, activity):
    return ScaffoldingState(user=student, activity=activity)


@pytest.fixture
def provider(monkeypatch):
    """MockProvider fresco por test, inyectado en tutor.services."""
    p = MockProvider()
    p.scaffold_payloads = dict(VALID_PAYLOADS)
    monkeypatch.setattr("tutor.services.get_ai_provider", lambda: p)
    return p


def _kwargs(student, activity, state, level):
    return dict(
        user=student, activity=activity, student_answer="respuesta",
        correct_answer="pauta", state=state, level=level,
    )


@pytest.mark.django_db
class TestClasificacionDeError:
    def test_classify_ok_actualiza_last_error_type_y_registra(self, student, activity, state, provider):
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 2))
        assert state.last_error_type == "conceptual"
        assert outcome.error_type == "conceptual"
        inter = AIInteraction.objects.get(operation_type="classify_error")
        assert inter.status == "ok"
        assert inter.model == "mock-model"
        assert inter.prompt_version == "CAAMI_ERROR_v1"
        assert inter.latency_ms == 12
        assert inter.input_tokens == 100 and inter.output_tokens == 20

    def test_classify_falla_deja_indeterminate_y_registra_error(self, student, activity, state, provider):
        provider.classify_error_exc = AIServiceError("API caída")
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 2))
        assert state.last_error_type == "indeterminate"
        assert outcome.error_type == "indeterminate"
        inter = AIInteraction.objects.get(operation_type="classify_error")
        assert inter.status == "error"
        assert "API caída" in inter.error_detail


@pytest.mark.django_db
class TestScaffoldPorNivel:
    def test_a1_pregunta_orientadora(self, student, activity, state, provider):
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 1))
        assert outcome.level == "A1"
        assert outcome.support_type == "guiding_question"
        assert "¿" in outcome.message
        assert outcome.source == "ai"

    def test_a2_pista_especifica(self, student, activity, state, provider):
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 2))
        assert outcome.level == "A2"
        assert outcome.support_type == "specific_hint"
        assert "impedancia" in outcome.message

    def test_a3_ejemplo_analogo(self, student, activity, state, provider):
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 3))
        assert outcome.level == "A3"
        assert outcome.support_type == "analogous_example"

    def test_a4_secuencia_guiada_con_steps(self, student, activity, state, provider):
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 4))
        assert outcome.level == "A4"
        assert outcome.support_type == "guided_sequence"
        assert len(outcome.steps) == 2
        assert outcome.steps[0]["prompt"]

    def test_a5_resolucion_con_key_concepts(self, student, activity, state, provider):
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 5))
        assert outcome.level == "A5"
        assert outcome.support_type == "worked_solution"
        assert outcome.message == VALID_PAYLOADS["A5"]["explanation"]
        assert outcome.key_concepts == ["impedancia", "bioseñales"]

    def test_interaccion_ok_registra_nivel_y_prompt_version(self, student, activity, state, provider):
        generate_scaffold_support(**_kwargs(student, activity, state, 3))
        inter = AIInteraction.objects.get(operation_type="scaffold_a3")
        assert inter.status == "ok"
        assert inter.scaffolding_level == "A3"
        assert inter.prompt_version == "CAAMI_A3_v1"


@pytest.mark.django_db
class TestFallbackPedagogico:
    def test_scaffold_falla_devuelve_fallback_y_registra(self, student, activity, state, provider):
        provider.scaffold_exc = AIServiceError("sin respuesta válida")
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 1))
        esperado = SCAFFOLD_FALLBACKS["A1"]
        assert outcome.source == "fallback"
        assert outcome.level == "A1"
        assert outcome.message == esperado["message"]
        inter = AIInteraction.objects.get(operation_type="scaffold_a1")
        assert inter.status == "fallback"
        assert "sin respuesta válida" in inter.error_detail

    def test_fallback_de_cada_nivel_cumple_su_schema(self, student, activity, state, provider):
        """Los fallbacks de SCAFFOLD_FALLBACKS producen outcomes completos."""
        provider.scaffold_exc = AIServiceError("x")
        for level in (1, 2, 3, 5):
            outcome = generate_scaffold_support(**_kwargs(student, activity, state, level))
            assert outcome.source == "fallback"
            assert outcome.message
        # A4 fallback trae steps (sin message); A5 trae explicación + verificación
        a4 = generate_scaffold_support(**_kwargs(student, activity, state, 4))
        assert a4.source == "fallback" and a4.steps
        a5 = generate_scaffold_support(**_kwargs(student, activity, state, 5))
        assert "verificar" in a5.message or "verificación" in a5.message

    def test_provider_fallback_no_llama_ia(self, student, activity, state):
        """Con AI_PROVIDER=fallback (settings de test) va directo al fallback."""
        outcome = generate_scaffold_support(**_kwargs(student, activity, state, 2))
        assert outcome.source == "fallback"
        assert outcome.level == "A2"
        assert AIInteraction.objects.count() == 0


@pytest.mark.django_db
class TestRAGDesactivado:
    def test_sin_rag_no_hay_chunks_recuperados(self, student, activity, state, provider):
        """RAG_ENABLED=False (settings de test) → retrieved_chunk_ids null."""
        generate_scaffold_support(**_kwargs(student, activity, state, 2))
        inter = AIInteraction.objects.get(operation_type="classify_error")
        assert inter.retrieved_chunk_ids is None
        assert inter.kb_version == ""
