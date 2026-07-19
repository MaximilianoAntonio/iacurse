"""
Tests de grading — reproducen los umbrales y comportamientos del TS original.

Valida los 5 tipos de actividad con sus casos límite:
- multiple_choice: igualdad exacta de índice, 20% si error
- guided_problem: ratio 0.8, matching bidireccional substring
- progressive_exercise: ratio 0.8, join '; '
- case_analysis: ratio 0.7, len(given) > 3, floor 0.3
- self_assessment: keyword default 0.6, rubric enrichment, >= 0.4 && len > 40
"""
import json

import pytest
from django.contrib.auth import get_user_model

from curriculum.models import Activity, Lesson, Rubric, Unit
from learning.grading import (
    grade,
    parse_activity_data,
)

User = get_user_model()


@pytest.fixture
def setup_curriculum(db):
    """Crea la estructura mínima: unidad + lección + actividad."""
    unit = Unit.objects.create(
        slug="test-unit", title="Test Unit", summary="", description="",
        order=1,
    )
    lesson = Lesson.objects.create(
        unit=unit, slug="test-lesson", title="Test Lesson", order=1,
    )
    return unit, lesson


def _make_activity(lesson, activity_type, data, points=10):
    return Activity.objects.create(
        lesson=lesson, type=activity_type, title="A", prompt="P",
        data=data, points=points,
    )


@pytest.mark.django_db
class TestParseActivityData:
    def test_valid_dict(self):
        assert parse_activity_data({"a": 1}) == {"a": 1}

    def test_valid_json_string(self):
        assert parse_activity_data('{"a": 1}') == {"a": 1}

    def test_invalid_json_returns_empty(self):
        """JSON inválido → dict vacío (NO error)."""
        assert parse_activity_data("not json") == {}

    def test_none_returns_empty(self):
        assert parse_activity_data(None) == {}


@pytest.mark.django_db
class TestMultipleChoice:
    def test_correct_index(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "multiple_choice", {
            "question": "q", "options": ["A", "B", "C"],
            "correctIndex": 1, "explanation": "", "hints": [],
        })
        result = grade(a, "1")
        assert result.is_correct is True
        assert result.score == 10
        assert result.correct_answer == "B"

    def test_incorrect_index_gets_20_percent(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "multiple_choice", {
            "options": ["A", "B", "C"], "correctIndex": 0,
        }, points=10)
        result = grade(a, "2")
        assert result.is_correct is False
        assert result.score == 2  # 20% de 10

    def test_non_numeric_answer(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "multiple_choice", {
            "options": ["A", "B"], "correctIndex": 0,
        })
        result = grade(a, "abc")
        assert result.is_correct is False


@pytest.mark.django_db
class TestGuidedProblem:
    def test_all_correct(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "guided_problem", {
            "steps": [
                {"prompt": "p1", "answer": "100", "hint": ""},
                {"prompt": "p2", "answer": "200", "hint": ""},
            ],
            "finalAnswer": "300",
        }, points=10)
        answer = json.dumps(["100", "200"])
        result = grade(a, answer)
        assert result.is_correct is True
        assert result.score == 10

    def test_80_percent_threshold(self, setup_curriculum):
        """4 de 5 pasos correctos (80%) → is_correct True."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "guided_problem", {
            "steps": [
                {"answer": "a"}, {"answer": "b"}, {"answer": "c"},
                {"answer": "d"}, {"answer": "e"},
            ],
            "finalAnswer": "X",
        }, points=10)
        answer = json.dumps(["a", "b", "c", "d", "WRONG"])
        result = grade(a, answer)
        assert result.is_correct is True  # 4/5 = 0.8 >= 0.8
        assert result.score == 10

    def test_below_threshold_partial_score(self, setup_curriculum):
        """3 de 5 (60%) → is_correct False, score = round(10 * 0.6) = 6."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "guided_problem", {
            "steps": [
                {"answer": "a"}, {"answer": "b"}, {"answer": "c"},
                {"answer": "d"}, {"answer": "e"},
            ],
            "finalAnswer": "X",
        }, points=10)
        answer = json.dumps(["a", "b", "c", "WRONG", "WRONG"])
        result = grade(a, answer)
        assert result.is_correct is False
        assert result.score == 6

    def test_substring_match_case_insensitive(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "guided_problem", {
            "steps": [{"answer": "Einthoven"}], "finalAnswer": "X",
        })
        # 'einthoven' como substring de 'el triangulo de einthoven'
        answer = json.dumps(["el triangulo de einthoven"])
        result = grade(a, answer)
        assert result.is_correct is True


@pytest.mark.django_db
class TestProgressiveExercise:
    def test_correct_levels_joined(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "progressive_exercise", {
            "levels": [
                {"answer": "5mA"}, {"answer": "10mA"},
            ],
        })
        answer = json.dumps(["5mA", "10mA"])
        result = grade(a, answer)
        assert result.is_correct is True
        assert result.correct_answer == "5mA; 10mA"


@pytest.mark.django_db
class TestCaseAnalysis:
    def test_70_percent_threshold(self, setup_curriculum):
        """3 de 4 (75%) → is_correct True (umbral 0.7)."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "case_analysis", {
            "questions": [
                {"answer": "fibrilacion ventricular"},
                {"answer": "taquicardia ventricular"},
                {"answer": "asistolia completa"},
                {"answer": "ritmo sinusal"},
            ],
        }, points=10)
        answer = json.dumps([
            "fibrilacion ventricular",
            "taquicardia ventricular",
            "asistolia completa",
            "WRONG ANSWER HERE",
        ])
        result = grade(a, answer)
        assert result.is_correct is True

    def test_short_answer_rejected(self, setup_curriculum):
        """given.length > 3 requerido → respuesta corta no cuenta."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "case_analysis", {
            "questions": [{"answer": "defibrilacion"}],
        })
        answer = json.dumps(["abc"])  # len 3, muy corto
        result = grade(a, answer)
        assert result.is_correct is False

    def test_word_match_from_expected(self, setup_curriculum):
        """Match por palabra de expected (len > 3) en given."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "case_analysis", {
            "questions": [{"answer": "monitor electrocardiografico"}],
        })
        # 'electrocardiografico' (>3 chars) está en given
        answer = json.dumps(["el aparato electrocardiografico funciona"])
        result = grade(a, answer)
        assert result.is_correct is True


@pytest.mark.django_db
class TestSelfAssessment:
    def test_keyword_match_correct(self, setup_curriculum):
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "self_assessment", {
            "prompt": "Explica",
            "rubric": [],
            "autoGradeKeywords": ["impedancia", "electrodo", "piel"],
        }, points=10)
        answer = "La impedancia del electrodo depende del contacto con la piel " * 5
        # len > 40 y contiene 3/3 keywords → ratio 1.0 >= 0.4
        result = grade(a, answer)
        assert result.is_correct is True

    def test_no_keywords_default_ratio_06(self, setup_curriculum):
        """Sin keywords → ratio default 0.6 (no 0)."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "self_assessment", {
            "prompt": "Explica", "rubric": [], "autoGradeKeywords": [],
        }, points=10)
        # answer largo → is_correct (0.6 >= 0.4 && len > 40)
        answer = "x" * 50
        result = grade(a, answer)
        assert result.is_correct is True

    def test_short_answer_not_correct(self, setup_curriculum):
        """len(answer) <= 40 → is_correct False."""
        _, lesson = setup_curriculum
        a = _make_activity(lesson, "self_assessment", {
            "prompt": "P", "rubric": [], "autoGradeKeywords": ["a", "b"],
        })
        result = grade(a, "ab")  # muy corto
        assert result.is_correct is False

    def test_rubric_enrichment_averages(self, setup_curriculum):
        """Con rúbrica, ratio = promedio(keyword + rubric)."""
        _, lesson = setup_curriculum
        rubric = Rubric.objects.create(
            author=User.objects.create_user(username="t", email="t@t.cl", password="X"),
            name="R", criteria=[
                {"name": "C1", "weight": 1, "levels": [
                    {"score": 1, "label": "Alto", "description": "explica profundamente"}
                ]},
            ],
        )
        a = _make_activity(lesson, "self_assessment", {
            "prompt": "P", "rubric": [],
            "autoGradeKeywords": ["impedancia"],
        }, points=10)
        a.rubric = rubric
        a.save()
        # 'explica profundamente' tiene 'explica' (>4 chars) → match_ratio 1
        # 'impedancia' está en answer → keyword ratio 1.0
        # ratio = (1.0 + 1.0) / 2 = 1.0
        answer = "explica profundamente la impedancia del electrodo " * 3
        result = grade(a, answer)
        assert result.is_correct is True
