"""
Lógica de evaluación (grading) — reproducida fielmente desde
src/app/api/activities/[id]/attempt/route.ts y src/lib/course-utils.ts.

Cada tipo de actividad tiene su propia heurística de scoring. Los umbrales
y comportamientos (ratio 0.8, 0.7, default keyword 0.6, floor 0.3/0.6) son
IDÉNTICOS a la versión Next.js original. Cualquier cambio alteraría el
comportamiento pedagógico ya calibrado.

parse_activity_data: dict vacío si JSON inválido (parity con parseActivityData).
"""
import json
import re
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class GradeResult:
    """Resultado de evaluar una respuesta."""

    is_correct: bool
    score: int
    correct_answer: str


def parse_activity_data(data: Any) -> dict:
    """Equivalente a parseActivityData<T> del TS.

    Devuelve dict vacío si el JSON es inválido o None (NO lanza error).
    """
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def _parse_answer_array(answer: str) -> list:
    """Intenta parsear answer como JSON array; fallback a [answer]."""
    try:
        parsed = json.loads(answer)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
    except (json.JSONDecodeError, TypeError):
        pass
    return [answer]


def _normalize(s: str) -> str:
    return (s or "").lower().strip()


def grade_multiple_choice(activity, answer: str, data: dict) -> GradeResult:
    """Selección múltiple: answer es el índice de la opción elegida (como string).

    is_correct solo si el índice coincide exactamente con correctIndex.
    Si incorrecto: 20% de los puntos.
    """
    correct_index = data.get("correctIndex", -1)
    options = data.get("options", []) or []
    try:
        selected_idx = int(answer)
    except (ValueError, TypeError):
        selected_idx = -1
    is_correct = selected_idx == correct_index
    correct_answer = options[correct_index] if 0 <= correct_index < len(options) else ""
    score = activity.points if is_correct else round(activity.points * 0.2)
    return GradeResult(is_correct=is_correct, score=score, correct_answer=correct_answer)


def _grade_step_based(steps: list, answers: list, correct_threshold: float = 0.8):
    """Lógica compartida guided_problem / progressive_exercise.

    Matching bidireccional por substring (case-insensitive, trimmed).
    Umbral por defecto 0.8.
    """
    correct_steps = 0
    for i, step in enumerate(steps):
        expected = _normalize(step.get("answer", ""))
        given = _normalize(answers[i] if i < len(answers) else "")
        if expected and (given == expected or given in expected or expected in given):
            correct_steps += 1
    ratio = correct_steps / len(steps) if steps else 0
    is_correct = ratio >= correct_threshold
    return is_correct, ratio


def grade_guided_problem(activity, answer: str, data: dict) -> GradeResult:
    """Problema guiado: answer es JSON array de respuestas por paso. Umbral 0.8."""
    step_answers = _parse_answer_array(answer)
    steps = data.get("steps", []) or []
    is_correct, ratio = _grade_step_based(steps, step_answers)
    correct_answer = data.get("finalAnswer", "")
    score = round(activity.points * (1 if is_correct else ratio))
    return GradeResult(is_correct=is_correct, score=score, correct_answer=correct_answer)


def grade_progressive_exercise(activity, answer: str, data: dict) -> GradeResult:
    """Ejercicio progresivo: como guided_problem pero sobre 'levels'. Umbral 0.8."""
    level_answers = _parse_answer_array(answer)
    levels = data.get("levels", []) or []
    is_correct, ratio = _grade_step_based(levels, level_answers)
    correct_answer = "; ".join(lvl.get("answer", "") for lvl in levels)
    score = round(activity.points * (1 if is_correct else ratio))
    return GradeResult(is_correct=is_correct, score=score, correct_answer=correct_answer)


def grade_case_analysis(activity, answer: str, data: dict) -> GradeResult:
    """Análisis de caso: requiere len(given) > 3. Umbral 0.7. Floor 0.3 en parcial."""
    case_answers = _parse_answer_array(answer)
    questions = data.get("questions", []) or []
    matched = 0
    for i, q in enumerate(questions):
        expected = _normalize(q.get("answer", ""))
        given = _normalize(case_answers[i] if i < len(case_answers) else "")
        # Palabras de expected > 3 caracteres (split por espacio/coma)
        words = [w for w in re.split(r"[ ,]+", expected) if len(w) > 3]
        ok = expected and len(given) > 3 and (
            given in expected or expected in given or any(w in given for w in words)
        )
        if ok:
            matched += 1
    ratio = matched / len(questions) if questions else 0
    is_correct = ratio >= 0.7
    correct_answer = "; ".join(q.get("answer", "") for q in questions)
    # Floor de 0.3 en el score parcial
    score_ratio = max(ratio, 0.3) if ratio > 0 or questions else 0
    score = round(activity.points * (1 if is_correct else score_ratio)) if (ratio > 0 or questions) else 0
    # Parity exacta: si no hay match pero sí questions, floor 0.3 del puntaje
    if not is_correct and questions:
        score = round(activity.points * max(ratio, 0.3))
    return GradeResult(is_correct=is_correct, score=score, correct_answer=correct_answer)


def grade_self_assessment(activity, answer: str, data: dict) -> GradeResult:
    """Autoevaluación: keyword ratio (default 0.6) + rubric enrichment.

    Lógica más compleja: combina matching de palabras clave con evaluación
    de rúbrica ponderada. is_correct requiere ratio >= 0.4 Y len(answer) > 40.
    """
    lower = (answer or "").lower()
    keywords = data.get("autoGradeKeywords", []) or []
    matched_kw = [k for k in keywords if k.lower() in lower]
    ratio = len(matched_kw) / len(keywords) if keywords else 0.6  # default si no hay keywords

    rubric_score = 0.0
    if activity.rubric_id and activity.rubric:
        try:
            criteria = activity.rubric.criteria
            if isinstance(criteria, str):
                criteria = json.loads(criteria)
            total_weight = 0
            weighted_score = 0
            for c in criteria:
                levels = c.get("levels", []) or []
                # match_ratio = 1 si cualquier nivel tiene palabra > 4 chars en answer
                matched = False
                for lvl in levels:
                    desc_words = [w for w in (lvl.get("description", "")).lower().split() if len(w) > 4]
                    if any(w in lower for w in desc_words):
                        matched = True
                        break
                match_ratio = 1 if matched else (0.5 if len(answer) > 80 else 0.2)
                weighted_score += match_ratio * c.get("weight", 1)
                total_weight += c.get("weight", 1)
            rubric_score = weighted_score / total_weight if total_weight > 0 else 0
            ratio = (ratio + rubric_score) / 2  # promedio keyword + rubric
        except (json.JSONDecodeError, TypeError, KeyError):
            pass  # mantener solo ratio de keywords

    is_correct = ratio >= 0.4 and len(answer) > 40
    correct_answer = f"Palabras clave esperadas: {', '.join(keywords)}"
    score = round(activity.points * (max(ratio, 0.6) if is_correct else 0.3))
    return GradeResult(is_correct=is_correct, score=score, correct_answer=correct_answer)


def grade_default(activity, answer: str) -> GradeResult:
    """Tipo desconocido: correcto si hay respuesta no vacía."""
    is_correct = bool(answer and answer.strip())
    score = activity.points if is_correct else 0
    return GradeResult(is_correct=is_correct, score=score, correct_answer="")


# Despachador principal
GRADERS = {
    "multiple_choice": grade_multiple_choice,
    "guided_problem": grade_guided_problem,
    "progressive_exercise": grade_progressive_exercise,
    "case_analysis": grade_case_analysis,
    "self_assessment": grade_self_assessment,
}


def grade(activity, answer: str) -> GradeResult:
    """Evalúa una respuesta según el tipo de actividad.

    Reproduce el switch de attempt/route.ts con parseActivityData previo.
    """
    data = parse_activity_data(activity.data)
    grader = GRADERS.get(activity.type)
    if grader is None:
        return grade_default(activity, answer)
    return grader(activity, answer, data)
