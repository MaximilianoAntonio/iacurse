"""
Segundo factor de autenticación (MFA) para docentes — hallazgo 2.9.

Flujo: tras validar la contraseña de un docente, ``create_challenge`` genera
un código de 6 dígitos, lo envía a su email institucional y devuelve el
desafío. El código NUNCA se persiste en claro (solo SHA-256), expira en
``MFA_CODE_TTL_MINUTES`` y tolera ``MFA_MAX_ATTEMPTS`` intentos fallidos.
"""
import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import MFAChallenge

logger = logging.getLogger(__name__)


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_code(user, code: str) -> None:
    send_mail(
        subject="Código de verificación — Plataforma Electromedicina II",
        message=(
            f"Hola {user.name or 'docente'}:\n\n"
            f"Tu código de verificación para ingresar a la plataforma es:\n\n"
            f"    {code}\n\n"
            f"Vence en {settings.MFA_CODE_TTL_MINUTES} minutos y es de un solo uso.\n"
            "Si no solicitaste este código, avisa de inmediato al Departamento "
            "de Ciberseguridad de la Universidad de Valparaíso.\n"
        ),
        from_email=None,  # DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
        fail_silently=False,
    )


def create_challenge(user) -> MFAChallenge:
    """Crea un desafío MFA nuevo, invalida los anteriores y envía el código."""
    user.mfa_challenges.filter(used=False).update(used=True)
    challenge = MFAChallenge(user=user)
    return refresh_challenge(challenge)


def refresh_challenge(challenge: MFAChallenge) -> MFAChallenge:
    """(Re)genera el código de un desafío vigente y lo reenvía por email."""
    code = _new_code()
    challenge.code_hash = _hash(code)
    challenge.expires_at = timezone.now() + timedelta(
        minutes=settings.MFA_CODE_TTL_MINUTES
    )
    challenge.attempts = 0
    challenge.used = False
    challenge.save()
    _send_code(challenge.user, code)
    return challenge


def verify_challenge(challenge: MFAChallenge, code: str) -> bool:
    """Verifica un código contra el desafío.

    Consume el desafío al agotar los intentos o al expirar. Devuelve True
    solo con código correcto dentro de vigencia e intentos disponibles.
    """
    if challenge.used or timezone.now() >= challenge.expires_at:
        challenge.used = True
        challenge.save(update_fields=["used"])
        return False
    if challenge.attempts >= settings.MFA_MAX_ATTEMPTS:
        challenge.used = True
        challenge.save(update_fields=["used"])
        return False
    if secrets.compare_digest(challenge.code_hash, _hash(code.strip())):
        challenge.used = True
        challenge.save(update_fields=["used"])
        return True
    challenge.attempts += 1
    update = ["attempts"]
    if challenge.attempts >= settings.MFA_MAX_ATTEMPTS:
        challenge.used = True
        update.append("used")
    challenge.save(update_fields=update)
    return False
