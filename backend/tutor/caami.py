"""
Motor pedagógico determinista CAAMI (Ciclo de Aprendizaje Adaptativo
Mediado por IA).

El BACKEND decide el nivel de andamiaje (A0-A5); el LLM solo redacta el texto
de la intervención (tutor/services.py). Este módulo es puro: no llama a IA
ni toca la base de datos.

Reglas:
- Error en intento 1           → A1 (pregunta orientadora)
- Error después de A1          → A2 (pista específica)
- Error después de A2          → A3 (explicación / ejemplo análogo)
- Error después de A3          → A4 (secuencia guiada)
- Error después de A4          → A5 (resolución explicada)
- Solicitud explícita de ayuda → sube un nivel SIN exigir error
- Respuesta correcta           → verificación: si había andamiaje previo se
  marca verified (cambio de desempeño) y el nivel vuelve a A0
- Tras entregar A5             → awaiting_verification=True (A5 nunca
  significa "actividad superada"; si falla de nuevo tras A5, se mantiene A5)

Prohibido inferir perfiles psicológicos/cognitivos: el estado solo registra
desempeño observable (intentos fallidos, solicitudes de ayuda, verificación).
"""
from dataclasses import dataclass

from django.utils import timezone

# Etiquetas de nivel para prompts, registros y UI (0 = A0 sin andamiaje).
LEVEL_NAMES = {0: "A0", 1: "A1", 2: "A2", 3: "A3", 4: "A4", 5: "A5"}
MAX_LEVEL = 5


def level_label(level: int) -> str:
    """Etiqueta "A0".."A5" para un nivel numérico."""
    return LEVEL_NAMES.get(level, "A0")


@dataclass
class ScaffoldDecision:
    """Decisión del motor para un evento (intento o solicitud de ayuda).

    ``is_correct``/``help_requested`` repiten el evento de entrada para que
    apply_decision pueda actualizar los contadores sin reconsultar al caller.
    """

    level: int  # 0 = sin andamiaje (correcta/verificación), 1-5 = A1-A5
    verified: bool  # correcta tras andamiaje previo (cambio de desempeño)
    awaiting_verification: bool
    is_correct: bool = False
    help_requested: bool = False


def decide_scaffold(state, *, is_correct: bool, help_requested: bool) -> ScaffoldDecision:
    """Decide el nivel de andamiaje para el evento. Función pura (no muta).

    Args:
        state: ScaffoldingState actual (modelo tutor o cualquier objeto con
            los campos current_level / awaiting_verification).
        is_correct: la respuesta del intento fue correcta.
        help_requested: el estudiante solicitó ayuda explícitamente.
    """
    if is_correct and not help_requested:
        # Verificación: correcta tras andamiaje previo marca cambio de
        # desempeño; el nivel vuelve a A0 (sin andamiaje).
        verified = state.current_level > 0 or state.awaiting_verification
        return ScaffoldDecision(
            level=0,
            verified=verified,
            awaiting_verification=False,
            is_correct=True,
            help_requested=False,
        )
    # Incorrecta o ayuda explícita: sube un nivel (máx. A5). Tras A5 un nuevo
    # error se mantiene en A5 (min con MAX_LEVEL).
    level = min(state.current_level + 1, MAX_LEVEL)
    return ScaffoldDecision(
        level=level,
        verified=False,
        awaiting_verification=(level == MAX_LEVEL),
        is_correct=is_correct,
        help_requested=help_requested,
    )


def apply_decision(state, decision: ScaffoldDecision) -> None:
    """Aplica la decisión al estado (muta, SIN save: persiste el caller)."""
    if decision.level == 0:
        # Correcta: reset del andamiaje. Si había andamiaje previo (o se
        # esperaba verificación tras A5) queda marcado como verificado.
        state.current_level = 0
        state.failed_attempts = 0
        state.awaiting_verification = False
        if decision.verified:
            state.verified = True
            state.verified_at = timezone.now()
        return
    state.current_level = decision.level
    if not decision.is_correct:
        state.failed_attempts += 1
    if decision.help_requested:
        state.help_requests += 1
    if decision.level == MAX_LEVEL:
        state.awaiting_verification = True
