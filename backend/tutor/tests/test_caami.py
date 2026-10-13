"""
Tests del motor pedagógico determinista CAAMI (tutor/caami.py).

Cubren TODAS las reglas de escalado de andamiaje A0-A5, la solicitud
explícita de ayuda y la verificación (respuesta correcta tras andamiaje).
El motor es puro: se prueba con un estado simple, sin base de datos.
"""
from types import SimpleNamespace

from tutor.caami import apply_decision, decide_scaffold, level_label


def _estado(**kwargs):
    """Estado fresco de andamiaje (equivalente a ScaffoldingState nuevo)."""
    base = dict(
        current_level=0,
        failed_attempts=0,
        help_requests=0,
        awaiting_verification=False,
        verified=False,
        verified_at=None,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _evento(state, *, is_correct, help_requested=False):
    """Decide y aplica un evento; devuelve la decisión."""
    decision = decide_scaffold(state, is_correct=is_correct, help_requested=help_requested)
    apply_decision(state, decision)
    return decision


class TestPrimerError:
    def test_error_en_intento_1_escala_a_a1(self):
        state = _estado()
        decision = _evento(state, is_correct=False)
        assert decision.level == 1
        assert level_label(decision.level) == "A1"
        assert state.current_level == 1
        assert state.failed_attempts == 1
        assert state.help_requests == 0


class TestEscaladoConErroresSucesivos:
    def test_escalado_completo_a1_a5(self):
        state = _estado()
        for esperado in (1, 2, 3, 4, 5):
            decision = _evento(state, is_correct=False)
            assert decision.level == esperado
            assert state.current_level == esperado
        assert state.failed_attempts == 5

    def test_errores_no_verifican(self):
        state = _estado()
        for _ in range(3):
            decision = _evento(state, is_correct=False)
            assert decision.verified is False
        assert state.verified is False
        assert state.verified_at is None


class TestSolicitudDeAyuda:
    def test_ayuda_sube_nivel_sin_error_y_sin_failed_attempts(self):
        """Solicitud explícita de ayuda sube un nivel sin exigir error."""
        state = _estado()
        decision = _evento(state, is_correct=True, help_requested=True)
        assert decision.level == 1
        assert state.current_level == 1
        assert state.failed_attempts == 0
        assert state.help_requests == 1

    def test_ayuda_tras_andamiaje_sube_un_nivel(self):
        state = _estado()
        _evento(state, is_correct=False)  # → A1
        decision = _evento(state, is_correct=False, help_requested=True)
        assert decision.level == 2
        assert state.failed_attempts == 2
        assert state.help_requests == 1


class TestRespuestaCorrecta:
    def test_correcta_sin_andamiaje_no_verifica(self):
        state = _estado()
        decision = _evento(state, is_correct=True)
        assert decision.level == 0
        assert decision.verified is False
        assert state.verified is False
        assert state.verified_at is None
        assert state.current_level == 0

    def test_correcta_tras_a3_marca_verified_y_resetea(self):
        state = _estado()
        for _ in range(3):
            _evento(state, is_correct=False)  # → A3
        decision = _evento(state, is_correct=True)
        assert decision.level == 0
        assert decision.verified is True
        assert state.current_level == 0
        assert state.failed_attempts == 0
        assert state.awaiting_verification is False
        assert state.verified is True
        assert state.verified_at is not None


class TestNivelA5:
    def test_a5_queda_awaiting_verification(self):
        """A5 nunca significa "actividad superada": exige verificación."""
        state = _estado()
        for _ in range(5):
            decision = _evento(state, is_correct=False)  # → A5
        assert decision.level == 5
        assert state.awaiting_verification is True
        assert state.verified is False

    def test_error_tras_a5_se_mantiene_en_a5(self):
        state = _estado()
        for _ in range(5):
            _evento(state, is_correct=False)  # → A5
        decision = _evento(state, is_correct=False)
        assert decision.level == 5
        assert state.current_level == 5
        assert state.awaiting_verification is True
        assert state.failed_attempts == 6

    def test_correcta_tras_a5_verifica_y_cierra_espera(self):
        state = _estado()
        for _ in range(5):
            _evento(state, is_correct=False)  # → A5
        decision = _evento(state, is_correct=True)
        assert decision.verified is True
        assert state.verified is True
        assert state.awaiting_verification is False
        assert state.current_level == 0
        assert state.failed_attempts == 0


class TestEtiquetas:
    def test_level_label(self):
        assert [level_label(n) for n in range(6)] == ["A0", "A1", "A2", "A3", "A4", "A5"]
        assert level_label(99) == "A0"
