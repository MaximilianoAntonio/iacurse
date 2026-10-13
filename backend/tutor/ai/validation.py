"""
Validación de los payloads JSON que devuelve el LLM para CAAMI.

Las reglas pedagógicas por nivel de andamiaje viven aquí (compartidas por los
providers OpenAI y Gemini): si el payload no cumple el schema/reglas, el
provider hace UN retry y, si persiste, lanza AIServiceError (el caller usa el
fallback pedagógico de prompts.SCAFFOLD_FALLBACKS).
"""

# Límite de brevedad de la pregunta orientadora A1 (debe ser breve).
A1_MAX_MESSAGE_CHARS = 600

_VALID_ERROR_TYPES = {"none", "conceptual", "procedural", "mixed", "indeterminate"}


def validate_classify_payload(payload: dict) -> None:
    """Valida el JSON de clasificación de error. Lanza ValueError si no cumple."""
    if not isinstance(payload, dict):
        raise ValueError("El payload de clasificación no es un objeto JSON")
    if payload.get("insufficient_context") is True:
        return  # señal válida de contexto insuficiente (UNCERTAINTY)
    result = payload.get("result")
    if result not in ("correct", "incorrect", "indeterminate"):
        raise ValueError(f"result inválido: {result!r}")
    error_type = payload.get("error_type")
    if error_type not in _VALID_ERROR_TYPES:
        raise ValueError(f"error_type inválido: {error_type!r}")
    if not isinstance(payload.get("needs_clarification"), bool):
        raise ValueError("needs_clarification debe ser booleano")


def validate_scaffold_payload(level: str, payload: dict) -> None:
    """Validación pedagógica post-generación del andamiaje de ``level``.

    Lanza ValueError con la regla incumplida.
    """
    if not isinstance(payload, dict):
        raise ValueError("El payload de andamiaje no es un objeto JSON")
    if payload.get("insufficient_context") is True:
        raise ValueError("El modelo declaró contexto insuficiente")
    if payload.get("level") != level:
        raise ValueError(f"El payload declara level={payload.get('level')!r}, esperado {level!r}")

    if level == "A1":
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            raise ValueError("A1 requiere message no vacío")
        if len(message) > A1_MAX_MESSAGE_CHARS:
            raise ValueError("A1 debe ser breve (message demasiado largo)")
        if "?" not in message and "¿" not in message:
            raise ValueError("A1 debe ser una pregunta orientadora (sin signos de interrogación)")
    elif level == "A2":
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            raise ValueError("A2 requiere message no vacío")
        if payload.get("error_focus") not in ("conceptual", "procedural"):
            raise ValueError("A2 requiere error_focus 'conceptual' o 'procedural'")
    elif level == "A3":
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            raise ValueError("A3 requiere message no vacío")
    elif level == "A4":
        steps = payload.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ValueError("A4 requiere una lista steps no vacía")
        for step in steps:
            if not isinstance(step, dict) or not isinstance(step.get("prompt"), str) or not step["prompt"].strip():
                raise ValueError("Cada paso de A4 requiere un prompt no vacío")
    elif level == "A5":
        explanation = payload.get("explanation")
        if not isinstance(explanation, str) or not explanation.strip():
            raise ValueError("A5 requiere explanation no vacío")
        if payload.get("verification_required") is not True:
            raise ValueError("A5 requiere verification_required == true")
        key_concepts = payload.get("key_concepts")
        if key_concepts is not None and not isinstance(key_concepts, list):
            raise ValueError("A5 key_concepts debe ser una lista")
    else:
        raise ValueError(f"Nivel de andamiaje desconocido: {level!r}")
