import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST: crear nueva lección en una unidad del currículo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { unitId, title, description, content, durationMin, slug } = body as {
      unitId: string;
      title: string;
      description?: string;
      content?: string;
      durationMin?: number;
      slug?: string;
    };

    if (!unitId || !title) {
      return NextResponse.json({ error: "Faltan unitId o title" }, { status: 400 });
    }

    const lessonCount = await db.lesson.count({ where: { unitId } });
    const finalSlug = slug || `leccion-${lessonCount + 1}-${Date.now().toString(36)}`;

    const lesson = await db.lesson.create({
      data: {
        unitId,
        title,
        description: description || "",
        content: content || "",
        durationMin: durationMin ?? 15,
        slug: finalSlug,
        order: lessonCount,
      },
    });

    // Actualizar el total del progreso de los estudiantes en esta unidad
    const activityCount = await db.activity.count({ where: { lesson: { unitId } } });
    await db.progress.updateMany({
      where: { unitId },
      data: { total: activityCount },
    });

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("Admin lessons POST API error:", error);
    return NextResponse.json({ error: "Error al crear lección" }, { status: 500 });
  }
}

// PATCH: actualizar lección existente
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { lessonId, title, description, content, durationMin, order } = body as {
      lessonId: string;
      title?: string;
      description?: string;
      content?: string;
      durationMin?: number;
      order?: number;
    };

    if (!lessonId) {
      return NextResponse.json({ error: "Falta lessonId" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (content !== undefined) data.content = content;
    if (durationMin !== undefined) data.durationMin = durationMin;
    if (order !== undefined) data.order = order;

    const lesson = await db.lesson.update({ where: { id: lessonId }, data });
    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("Admin lessons PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar lección" }, { status: 500 });
  }
}

// DELETE: eliminar lección (cascade borra actividades)
export async function DELETE(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ error: "Falta lessonId" }, { status: 400 });
    }

    // Obtener unitId antes de eliminar para actualizar progreso
    const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { unitId: true } });
    await db.lesson.delete({ where: { id: lessonId } });

    if (lesson) {
      const activityCount = await db.activity.count({ where: { lesson: { unitId: lesson.unitId } } });
      await db.progress.updateMany({
        where: { unitId: lesson.unitId },
        data: { total: activityCount },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin lessons DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar lección" }, { status: 500 });
  }
}
