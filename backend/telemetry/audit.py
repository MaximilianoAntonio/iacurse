"""
Registro de eventos de seguridad (auditoría).

Helper único ``log_security_event`` usado por las vistas que ejecutan
acciones sensibles (login, cambios de contraseña, gestión de estudiantes,
moderación de reportes, configuración crítica del curso). Escribe en la
tabla ``AuditLog`` (evidencia auditable) y emite al logger ``security``
(recolectable por el stack de contenedores).

La auditoría NUNCA debe romper la request principal: cualquier error al
registrar se traga (igual criterio que AccessLogMiddleware).
"""
import logging

from .middleware import _get_client_ip
from .models import AuditLog

logger = logging.getLogger("security")


def log_security_event(event_type: str, *, actor=None, request=None, target: str = "", metadata: dict | None = None) -> None:
    """Registra un evento de seguridad en AuditLog y en el logger 'security'.

    - ``actor``: usuario que ejecuta la acción (None en login fallido).
    - ``target``: objetivo de la acción (p. ej. código de estudiante). Nunca
      incluir contraseñas ni credenciales aquí ni en ``metadata``.
    """
    ip = None
    if request is not None:
        try:
            ip = _get_client_ip(request) or None
        except Exception:
            ip = None
    try:
        AuditLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            event_type=event_type,
            target=target[:255],
            ip=ip,
            metadata=metadata or {},
        )
    except Exception:
        pass  # la auditoría nunca rompe la request
    logger.info(
        "audit event=%s actor=%s target=%s ip=%s",
        event_type,
        getattr(actor, "pk", None),
        target,
        ip or "-",
    )
