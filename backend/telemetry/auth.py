"""
Authentication classes custom para telemetría.

SessionAuthenticationWithoutCSRF: valida la sesión Django pero NO requiere
CSRF token. Se usa solo en endpoints invocados vía navigator.sendBeacon()
(que no puede enviar headers custom como X-CSRFToken).

Seguridad: el usuario se identifica por la cookie de sesión Django (que es
 HttpOnly y no accesible por JS), igual que SessionAuthentication estándar.
 La única diferencia es la omisión del CSRF check, que es segura para
 operaciones idempotentes de solo-lectura/escritura-acotada como cerrar una
 sesión de estudio (el sessionId solo lo conoce el usuario legítimo).
"""
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

User = get_user_model()


class SessionAuthenticationWithoutCSRF(authentication.BaseAuthentication):
    """Autentica por cookie de sesión Django, sin verificar CSRF.

    Para endpoints invocados vía sendBeacon (que no puede enviar headers).
    """

    def authenticate(self, request):
        # DRF ya extrae request.user via SessionMiddleware si hay sesión válida.
        # Aquí solo validamos que exista un usuario autenticado en la sesión.
        user = getattr(request._request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        return (user, None)
