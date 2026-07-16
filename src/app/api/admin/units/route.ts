import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar todas las unidades del currículo existente (con conteo)
export async function GET(req: NextRequest) {
  try {
    const units = await db.unit.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    // Contar actividades por unidad en paralelo
    const unitsWithMeta = await Promise.all(
      units.map(async (u) => {
        const activityCount = await db.activity.count({
          where: { lesson: { unitId: u.id } },
        });
        return {
          id: u.id,
          slug: u.slug,
          title: u.title,
          summary: u.summary,
          description: u.description,
          icon: u.icon,
          color: u.color,
          order: u.order,
          lessonCount: u._count.lessons,
          activityCount,
          sourceCourseId: u.slug.startsWith("sc-") ? u.slug.split("-")[1] : null,
        };
      })
    );

    return NextResponse.json({ units: unitsWithMeta });
  } catch (error) {
    console.error("Admin units GET API error:", error);
    return NextResponse.json({ error: "Error al cargar unidades" }, { status: 500 });
  }
}

// POST: crear nueva unidad en el currículo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, summary, description, icon, color, slug } = body as {
      title: string;
      summary?: string;
      description?: string;
      icon?: string;
      color?: string;
      slug?: string;
    };

    if (!title) {
      return NextResponse.json({ error: "Falta title" }, { status: 400 });
    }

    const unitCount = await db.unit.count();
    const finalSlug = slug || `unidad-${unitCount + 1}-${Date.now().toString(36)}`;

    const unit = await db.unit.create({
      data: {
        title,
        summary: summary || "",
        description: description || "",
        icon: icon || "BookOpen",
        color: color || "sky",
        slug: finalSlug,
        order: unitCount,
      },
    });

    return NextResponse.json({ unit });
  } catch (error) {
    console.error("Admin units POST API error:", error);
    return NextResponse.json({ error: "Error al crear unidad" }, { status: 500 });
  }
}

// PATCH: actualizar unidad existente
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { unitId, title, summary, description, icon, color, order } = body as {
      unitId: string;
      title?: string;
      summary?: string;
      description?: string;
      icon?: string;
      color?: string;
      order?: number;
    };

    if (!unitId) {
      return NextResponse.json({ error: "Falta unitId" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (summary !== undefined) data.summary = summary;
    if (description !== undefined) data.description = description;
    if (icon !== undefined) data.icon = icon;
    if (color !== undefined) data.color = color;
    if (order !== undefined) data.order = order;

    const unit = await db.unit.update({ where: { id: unitId }, data });
    return NextResponse.json({ unit });
  } catch (error) {
    console.error("Admin units PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar unidad" }, { status: 500 });
  }
}

// DELETE: eliminar unidad (cascade borra lecciones y actividades)
export async function DELETE(req: NextRequest) {
  try {
    const unitId = req.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json({ error: "Falta unitId" }, { status: 400 });
    }

    await db.unit.delete({ where: { id: unitId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin units DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar unidad" }, { status: 500 });
  }
}
