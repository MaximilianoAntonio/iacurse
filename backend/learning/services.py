"""Servicios de aprendizaje reutilizables (reglas de negocio compartidas)."""
from django.db.models import Count

from curriculum.models import Activity
from .models import Progress


def all_units_completed(user) -> bool:
    """True si el estudiante completó TODAS las unidades del curso.

    "Completada" = actividades correctas >= total de actividades de la unidad.
    El total real se calcula desde Activity (lecciones publicadas) para evitar
    falsos positivos con filas Progress desactualizadas; una unidad sin fila
    Progress cuenta como incompleta (completed = 0 < total).
    Las unidades sin actividades no bloquean (total 0: nada que completar).
    """
    unit_totals = {
        row["lesson__unit"]: row["n"]
        for row in Activity.objects.filter(lesson__is_published=True)
        .values("lesson__unit")
        .annotate(n=Count("id"))
    }
    if not unit_totals:
        return False
    completed_by_unit = {
        p.unit_id: p.completed for p in Progress.objects.filter(user=user)
    }
    return all(
        completed_by_unit.get(unit_id, 0) >= total
        for unit_id, total in unit_totals.items()
    )


def _unit_totals() -> dict:
    """Total de actividades (lecciones publicadas) por unidad, desde Activity."""
    return {
        row["lesson__unit"]: row["n"]
        for row in Activity.objects.filter(lesson__is_published=True)
        .values("lesson__unit")
        .annotate(n=Count("id"))
    }


def completed_unit_ids(user) -> set:
    """IDs de las unidades completadas por el estudiante.

    Misma regla que ``all_units_completed``: ``Progress.completed >= total``
    recalculado desde Activity. Las unidades sin actividades publicadas
    cuentan como completadas (no tienen nada que completar).
    """
    from curriculum.models import Unit

    totals = _unit_totals()
    completed_by_unit = {
        p.unit_id: p.completed for p in Progress.objects.filter(user=user)
    }
    return {
        unit_id
        for unit_id in Unit.objects.values_list("id", flat=True)
        if completed_by_unit.get(unit_id, 0) >= totals.get(unit_id, 0)
    }


def locked_unit_ids(user) -> set:
    """IDs de las unidades bloqueadas para el usuario por desbloqueo secuencial.

    Regla: recorriendo las unidades en orden (``order``, ``id``), quedan
    bloqueadas todas las posteriores a la primera unidad incompleta (la
    primera incompleta es la unidad "actual" y queda disponible). Si el flag
    ``CourseConfig.sequential_unlock`` está apagado, o el usuario es docente
    (previsualiza todo el contenido), no hay bloqueos.
    """
    from curriculum.models import CourseConfig, Unit

    if getattr(user, "role", None) == "teacher":
        return set()
    if not CourseConfig.load().sequential_unlock:
        return set()
    completed = completed_unit_ids(user)
    locked: set = set()
    blocking = False
    for unit_id in Unit.objects.order_by("order", "id").values_list("id", flat=True):
        if blocking:
            locked.add(unit_id)
        elif unit_id not in completed:
            blocking = True
    return locked


def is_unit_unlocked(user, unit) -> bool:
    """True si el usuario puede acceder a la unidad (no está bloqueada)."""
    return unit.id not in locked_unit_ids(user)
