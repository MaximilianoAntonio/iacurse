import logging
from tutor.ai.base import AIServiceError, ChatMessage
from tutor.ai.factory import get_ai_provider

logger = logging.getLogger(__name__)

def adapt_unit_for_student(unit_title: str, base_content: str, course_diagnostic_answers: list) -> str:
    """
    Llama a la IA para adaptar el contenido base de una unidad al perfil del
    estudiante, descrito por sus respuestas al diagnóstico GENERAL del curso
    (conocimientos previos y expectativas, no preguntas de la unidad).
    """
    provider = get_ai_provider()

    # Formatear las respuestas del diagnóstico general
    formatted_responses = ""
    for idx, qa in enumerate(course_diagnostic_answers):
        q = qa.get("question", f"Pregunta {idx+1}")
        a = qa.get("answer", "")
        formatted_responses += f"Pregunta: {q}\nRespuesta del estudiante: {a}\n\n"

    system_prompt = (
        "Eres un asistente pedagógico de IA experto. Tu tarea es adaptar el material didáctico "
        "de un curso al nivel actual del estudiante basándose en su perfil, descrito por sus "
        "respuestas a un diagnóstico general del curso (conocimientos previos y expectativas).\n"
        "Debes responder con el contenido adaptado en formato Markdown, manteniendo la estructura y formato.\n"
        "AL FINAL del contenido adaptado, debes agregar obligatoriamente una sección con la siguiente estructura exacta:\n"
        "## 🔍 Preguntas de Control\n"
        "1. ¿[Pregunta 1 basada en el contenido adaptado anterior]?\n"
        "2. ¿[Pregunta 2 basada en el contenido adaptado anterior]?\n"
        "No respondas las preguntas, solo redacta las 2 preguntas numeradas."
    )

    user_content = (
        f"Contenido Base de la Unidad ({unit_title}):\n"
        f"```markdown\n{base_content}\n```\n\n"
        f"Perfil del estudiante (respuestas al diagnóstico general del curso):\n"
        f"{formatted_responses}\n"
        f"Por favor, adapta y reescribe el contenido base en formato Markdown para adecuarlo "
        f"al nivel de conocimientos y expectativas que describe ese perfil. "
        f"Si sus respuestas demuestran un nivel bajo/inicial, simplifica conceptos, usa analogías y explica "
        f"en detalle. Si demuestran un nivel avanzado, profundiza más e introduce más rigor técnico."
    )

    try:
        # Usamos una lista de un único mensaje de usuario
        messages = [ChatMessage(role="user", content=user_content)]
        adapted = provider.chat(messages, system_prompt=system_prompt)
        if not adapted:
            raise AIServiceError("El proveedor de IA retornó una respuesta vacía.")
        return adapted
    except Exception as e:
        logger.error("Error al adaptar contenido con IA: %s. Se usará el contenido base.", e)
        return base_content
