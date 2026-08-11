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
