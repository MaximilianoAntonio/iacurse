"""
Prompts del sistema — traducidos fielmente desde src/lib/ai.ts.

Se usan para la retroalimentación formativa de actividades. (El prompt del
chat socrático se eliminó junto con esa funcionalidad.)
"""

FEEDBACK_SYSTEM_PROMPT = (
    "Eres un asistente pedagógico que genera retroalimentación formativa breve "
    "para un estudiante de Electromedicina II. Responde SIEMPRE en español chileno, "
    "en 2-4 oraciones. No uses markdown complejo. Sé específico y motivador."
)

# Fallbacks cuando la IA falla (parity con ai.ts:110-113)
FEEDBACK_FALLBACK_CORRECT = (
    "¡Bien hecho! Has aplicado correctamente el concepto. "
    "Sigue practicando para afianzarlo."
)
FEEDBACK_FALLBACK_INCORRECT = (
    "Revisa el concepto clave del enunciado. Identifica qué supuesto no se cumple "
    "e inténtalo nuevamente."
)


def build_feedback_prompt(opts: dict) -> str:
    """Construye el prompt de usuario para retroalimentación de actividad.

    Reproduce el userPrompt de generateActivityFeedback (ai.ts:79-99).
    """
    activity_type = opts["activity_type"]
    activity_title = opts["activity_title"]
    prompt = opts["prompt"]
    correct_answer = opts.get("correct_answer")
    student_answer = opts["student_answer"]
    is_correct = opts["is_correct"]
    context = opts.get("context")
    assessment_type = opts.get("assessment_type")
    bloom_level = opts.get("bloom_level")
    objectives = opts.get("objectives") or []
    rubric_criteria = opts.get("rubric_criteria")

    parts = [f"Actividad: {activity_title} (tipo: {activity_type})"]

    if context:
        parts.append(f"Contexto: {context}")

    if assessment_type:
        type_map = {
            "diagnostic": "Diagnóstica (detectar conocimientos previos)",
            "formative": "Formativa (práctica con retroalimentación)",
            "summative": "Sumativa (evaluación calificada)",
            "self_reflection": "Auto-reflexión",
        }
        parts.append(f"Tipo de evaluación: {type_map.get(assessment_type, assessment_type)}")

    if bloom_level:
        parts.append(f"Nivel cognitivo esperado (Bloom): {bloom_level}")

    if objectives:
        objs = "\n".join(f"- {o}" for o in objectives)
        parts.append(f"Objetivos de aprendizaje que evalúa esta actividad:\n{objs}")

    if rubric_criteria:
        import json

        try:
            if isinstance(rubric_criteria, str):
                criteria = json.loads(rubric_criteria)
            else:
                criteria = rubric_criteria
            lines = []
            for c in criteria:
                levels = ", ".join(f"{l['label']} ({l['score']}pt)" for l in c.get("levels", []))
                lines.append(f"- {c.get('name', '')}: {levels}")
            parts.append("Criterios de la rúbrica de evaluación:\n" + "\n".join(lines))
        except (json.JSONDecodeError, TypeError, KeyError):
            pass

    parts.append(f"Enunciado/pregunta:\n{prompt}")
    parts.append(f"Respuesta correcta esperada:\n{correct_answer or '(respuesta abierta)'}")
    parts.append(f"Respuesta del estudiante:\n{student_answer}")
    parts.append(f"¿Es correcta?: {'SÍ' if is_correct else 'PARCIALMENTE / NO'}")
    parts.append(
        "Genera una retroalimentación formativa que:\n"
        "- Si es correcta: valida, refuerza el concepto clave y sugiere una conexión con un equipo médico real.\n"
        "- Si es incorrecta o parcial: identifica el error conceptual específico (sin dar la respuesta completa), ofrece una pista concreta y motiva a reintentar.\n"
        "- Si es diagnóstica: enfócate en detectar conocimiento previo, sin juzgar.\n"
        "- Si es sumativa: sé más riguroso y específico sobre qué faltó.\n"
        "- Si es autoevaluación: valora la reflexión y sugiere cómo profundizar.\n"
        "Máximo 80 palabras."
    )
    return "\n\n".join(parts)
