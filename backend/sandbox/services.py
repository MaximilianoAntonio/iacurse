"""
Servicios del sandbox docente — publicación de cursos al currículo live.

Reproduce publishToCurriculum de src/app/api/courses/[id]/route.ts:
- Elimina unidades previamente publicadas con slug prefix sc-<courseId>
- Crea nuevas Unit/Lesson/Activity a partir del sandbox
- Marca el curso como published
"""
import logging

from curriculum.models import Activity, Lesson, Unit
from .models import Course

logger = logging.getLogger(__name__)


def publish_to_curriculum(course: Course) -> dict:
    """Publica un curso sandbox como unidades/lecciones/actividades live.

    Usa el prefijo de slug sc-<courseId> para identificar y reemplazar
    publicaciones previas del mismo curso (idempotente).
    """
    slug_prefix = f"sc-{course.id}"

    # 1. Eliminar unidades previamente publicadas de este curso
    deleted_count, _ = Unit.objects.filter(slug__startswith=slug_prefix).delete()

    # 2. Crear nuevas unidades live
    created = {"units": 0, "lessons": 0, "activities": 0}
    # order_offset para posicionar después de las unidades existentes
    existing_max_order = Unit.objects.order_by("-order").first()
    order_offset = (existing_max_order.order + 1) if existing_max_order else 0

    for i, cu in enumerate(course.units.order_by("order")):
        unit_slug = f"{slug_prefix}-{i+1}"
        unit = Unit.objects.create(
            slug=unit_slug,
            title=cu.title,
            summary=cu.summary,
            description=cu.description,
            icon=cu.icon,
            color=cu.color,
            order=order_offset + i,
        )
        created["units"] += 1

        for j, cl in enumerate(cu.lessons.order_by("order")):
            lesson = Lesson.objects.create(
                unit=unit,
                slug=f"{unit_slug}-l{j+1}",
                title=cl.title,
                description=cl.description,
                content=cl.content,
                duration_min=cl.duration_min,
                order=j,
            )
            created["lessons"] += 1

            for k, q in enumerate(cl.questions.order_by("id")):
                Activity.objects.create(
                    lesson=lesson,
                    type=q.type,
                    title=q.title,
                    prompt=q.prompt,
                    data=q.data,
                    points=q.points,
                    difficulty=q.difficulty,
                    order=k,
                )
                created["activities"] += 1

    # 3. Marcar como publicado
    course.status = Course.STATUS_PUBLISHED
    course.save(update_fields=["status", "updated_at"])

    logger.info("Curso %s publicado: %s", course.id, created)
    return {"published": True, "created": created, "replaced": deleted_count > 0}
