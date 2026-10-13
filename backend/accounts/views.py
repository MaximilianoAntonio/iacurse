"""
Vistas de cuentas — Módulo de acceso del lineamiento.

Endpoints:
- GET    /api/auth/csrf            — token CSRF para el frontend React
- POST   /api/auth/login           — login (cookie de sesión; docentes pasan a MFA)
- POST   /api/auth/login/mfa       — segundo factor del login docente (OTP por email)
- POST   /api/auth/logout          — logout
- POST   /api/auth/change-password — cambio de contraseña (obligatorio con flag)
- GET    /api/me                   — usuario actual

El registro público fue eliminado: el docente crea las cuentas de
estudiantes (ver ``accounts/admin_views.py``).
"""
import logging

from django.conf import settings
from django.contrib.auth import (
    get_user_model,
    login,
    logout,
    update_session_auth_hash,
)
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status, views
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from telemetry.audit import log_security_event

from .mfa import create_challenge, refresh_challenge, verify_challenge
from .models import MFAChallenge
from .serializers import ChangePasswordSerializer, LoginSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


def _serialize_user(user):
    """Serializa un usuario a dict plano (incluye last_active como ISO)."""
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "avatar": user.avatar or "",
        "points": user.points,
        "streak": user.streak,
        "weeklyGoalMin": user.weekly_goal_min,
        "lastActive": user.last_active.isoformat() if user.last_active else None,
        "studentCode": user.student_code or None,
        "mustChangePassword": user.must_change_password,
    }


class CsrfTokenView(views.APIView):
    """GET /api/auth/csrf — devuelve el token CSRF para el frontend React.

    El frontend debe llamar este endpoint antes de cualquier POST/PATCH/DELETE
    y enviar el token en el header X-CSRFToken.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(views.APIView):
    """Login por identificador (email docente o código estudiante) + password.

    Exige captcha (``LOGIN_CAPTCHA_ENABLED``), aplica rate limit por IP
    (scope ``login``) contra fuerza bruta y registra en auditoría los intentos
    exitosos y fallidos.
    """

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError:
            log_security_event(
                "login_failed",
                request=request,
                target=str(request.data.get("identifier", ""))[:255],
            )
            raise
        user = serializer.validated_data["user"]
        # MFA docente (hallazgo 2.9): la contraseña no basta; se exige un
        # código de un solo uso enviado al email institucional. Los
        # estudiantes (anonimizados, sin email real) quedan exentos.
        if user.is_teacher and getattr(settings, "TEACHER_MFA_ENABLED", False):
            try:
                challenge = create_challenge(user)
            except Exception:
                logger.exception("No se pudo enviar el código MFA a %s", user.email)
                log_security_event("mfa_send_failed", actor=user, request=request)
                return Response(
                    {"error": "No se pudo enviar el código de verificación. "
                              "Inténtalo más tarde o contacta al administrador."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            log_security_event("mfa_challenge_sent", actor=user, request=request)
            return Response({"mfaRequired": True, "challengeId": str(challenge.token)})
        login(request, user)
        log_security_event("login_success", actor=user, request=request)
        # last_active se actualiza vía middleware, pero forzamos en login
        User.objects.filter(pk=user.pk).update(last_active=timezone.now())
        return Response({"user": _serialize_user(user)})


class MFALoginView(views.APIView):
    """POST /api/auth/login/mfa — segundo factor del login docente.

    Recibe ``{challengeId, code}`` (o ``{challengeId, resend: true}`` para
    reenviar el código) y completa la sesión. El ``challengeId`` es un UUID
    no enumerable entregado por el primer paso del login. Mismo rate limit
    por IP que el login (scope ``login``).
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def _get_challenge(self, request):
        token = str(request.data.get("challengeId", "")).strip()
        if not token:
            return None
        return MFAChallenge.objects.filter(token=token).select_related("user").first()

    def post(self, request):
        challenge = self._get_challenge(request)
        if challenge is None or challenge.used:
            log_security_event("mfa_failed", request=request, target="desafio_invalido")
            return Response(
                {"error": "El desafío de verificación no es válido o ya fue utilizado. "
                          "Inicia sesión nuevamente."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.data.get("resend"):
            try:
                refresh_challenge(challenge)
            except Exception:
                logger.exception("No se pudo reenviar el código MFA")
                return Response(
                    {"error": "No se pudo reenviar el código. Inténtalo más tarde."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            log_security_event("mfa_challenge_resent", actor=challenge.user, request=request)
            return Response({"ok": True, "resent": True})

        code = str(request.data.get("code", ""))
        if verify_challenge(challenge, code):
            user = challenge.user
            login(request, user)
            log_security_event("mfa_verified", actor=user, request=request)
            log_security_event("login_success", actor=user, request=request)
            User.objects.filter(pk=user.pk).update(last_active=timezone.now())
            return Response({"user": _serialize_user(user)})
        log_security_event("mfa_failed", actor=challenge.user, request=request)
        return Response(
            {"error": "Código incorrecto o expirado."},
            status=status.HTTP_400_BAD_REQUEST,
        )


class LogoutView(views.APIView):
    """Cierra la sesión."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"ok": True})


class ChangePasswordView(views.APIView):
    """Cambio de contraseña del usuario autenticado.

    Limpia el flag ``must_change_password``: es la vía para salir del cambio
    obligatorio tras el primer login o un reset del docente.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["newPassword"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password", "updated_at"])
        # Django guarda el hash de la contraseña en la sesión: sin esto la
        # sesión queda invalidada en el siguiente request y el usuario sale
        # deslogueado justo después de cambiar su contraseña.
        update_session_auth_hash(request, user)
        log_security_event("password_change", actor=user, request=request)
        return Response({"ok": True})


class MeView(views.APIView):
    """Usuario actual (sesión requerida).

    Devuelve el usuario autenticado por la cookie de sesión de Django.
    No hay modo demo: el acceso a la plataforma requiere login real.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": _serialize_user(request.user)})


class MeDataExportView(views.APIView):
    """GET /api/me/data — exportación de todos los datos del usuario autenticado.

    Implementa el derecho de acceso y portabilidad del titular (Ley N°21.719):
    entrega en un solo JSON el perfil, la actividad académica y la telemetría
    asociada a la cuenta, en formato estructurado y legible por máquina.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Imports locales para no acoplar accounts al resto de apps en import-time
        from learning.models import (
            Bookmark,
            CourseDiagnosticResult,
            ErrorReport,
            FinalExamAttempt,
            PersonalizedUnit,
            Progress,
            StudentConsent,
            StudySession,
            UserBadge,
        )
        from telemetry.models import AccessLog, EventLog

        user = request.user
        attempts = [
            {
                "activityId": a.activity_id,
                "answer": a.answer,
                "score": a.score,
                "correct": a.correct,
                "feedback": a.feedback,
                "timeSpent": a.time_spent,
                "hintsUsed": a.hints_used,
                "createdAt": a.created_at.isoformat(),
            }
            for a in user.attempts.order_by("-created_at")
        ]
        data = {
            "exportedAt": timezone.now().isoformat(),
            "profile": _serialize_user(user),
            "attempts": attempts,
            "progress": [
                {
                    "unitId": p.unit_id,
                    "completed": p.completed,
                    "total": p.total,
                    "mastery": p.mastery,
                    "lastVisited": p.last_visited.isoformat() if p.last_visited else None,
                }
                for p in Progress.objects.filter(user=user)
            ],
            "badges": [
                {"badge": ub.badge.slug, "awardedAt": ub.awarded_at.isoformat()}
                for ub in UserBadge.objects.filter(user=user).select_related("badge")
            ],
            "bookmarks": [
                {"activityId": b.activity_id, "createdAt": b.created_at.isoformat()}
                for b in Bookmark.objects.filter(user=user)
            ],
            "studySessions": [
                {
                    "unitId": s.unit_id,
                    "startedAt": s.started_at.isoformat(),
                    "endedAt": s.ended_at.isoformat() if s.ended_at else None,
                    "durationSec": s.duration,
                }
                for s in StudySession.objects.filter(user=user).order_by("-started_at")
            ],
            "courseDiagnostic": (
                lambda d: {"answers": d.answers, "createdAt": d.created_at.isoformat()} if d else None
            )(CourseDiagnosticResult.objects.filter(user=user).first()),
            # Consentimiento informado: decisión, versión y fechas. NO incluye
            # research_code: ese código pertenece a la base científica (solo
            # coinvestigador), no es un dato del titular.
            "consent": (
                lambda c: {
                    "decision": c.decision,
                    "version": c.version,
                    "decidedAt": c.decided_at.isoformat(),
                    "revokedAt": c.revoked_at.isoformat() if c.revoked_at else None,
                } if c else None
            )(StudentConsent.objects.filter(user=user).first()),
            "personalizedUnits": [
                {
                    "unitId": p.unit_id,
                    "diagnosticAnswers": p.diagnostic_answers,
                    "adaptedContent": p.adapted_content,
                    "skipped": p.skipped,
                }
                for p in PersonalizedUnit.objects.filter(user=user)
            ],
            "finalExamAttempts": [
                {
                    "answers": f.answers,
                    "score": f.score,
                    "passed": f.passed,
                    "createdAt": f.created_at.isoformat(),
                }
                for f in FinalExamAttempt.objects.filter(user=user).order_by("-created_at")
            ],
            "errorReports": [
                {
                    "source": r.source,
                    "sourceId": r.source_id,
                    "reason": r.reason,
                    "comment": r.comment,
                    "status": r.status,
                    "createdAt": r.created_at.isoformat(),
                }
                for r in ErrorReport.objects.filter(user=user).order_by("-created_at")
            ],
            "telemetry": {
                "accessLog": [
                    {
                        "ip": l.ip,
                        "userAgent": l.user_agent,
                        "path": l.path,
                        "method": l.method,
                        "statusCode": l.status_code,
                        "createdAt": l.created_at.isoformat(),
                    }
                    for l in AccessLog.objects.filter(user=user).order_by("-created_at")[:5000]
                ],
                "events": [
                    {
                        "eventType": e.event_type,
                        "metadata": e.metadata,
                        "createdAt": e.created_at.isoformat(),
                    }
                    for e in EventLog.objects.filter(user=user).order_by("-created_at")[:5000]
                ],
            },
        }
        return Response(data)
