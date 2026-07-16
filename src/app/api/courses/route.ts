import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar cursos del docente
export async function GET(req: NextRequest) {
  try {
    const authorId = req.nextUrl.searchParams.get("authorId");
    if (!authorId) {
      return NextResponse.json({ error: "Falta authorId" }, { status: 400 });
    }

    const courses = await db.course.findMany({
      where: { authorId },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { units: true } },
      },
    });

    return NextResponse.json({
      courses: courses.map((c) => ({
        ...c,
        unitCount: c._count.units,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Courses GET API error:", error);
    return NextResponse.json({ error: "Error al cargar cursos" }, { status: 500 });
  }
}

// POST: crear curso
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorId, title, description, color, icon } = body as {
      authorId: string;
      title: string;
      description: string;
      color?: string;
      icon?: string;
    };

    if (!authorId || !title) {
      return NextResponse.json({ error: "Faltan authorId o title" }, { status: 400 });
    }

    const course = await db.course.create({
      data: {
        authorId,
        title,
        description: description || "",
        color: color || "sky",
        icon: icon || "BookOpen",
      },
    });

    return NextResponse.json({ course });
  } catch (error) {
    console.error("Courses POST API error:", error);
    return NextResponse.json({ error: "Error al crear curso" }, { status: 500 });
  }
}

// PATCH: actualizar curso
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, title, description, color, icon, status, order } = body as {
      courseId: string;
      title?: string;
      description?: string;
      color?: string;
      icon?: string;
      status?: string;
      order?: number;
    };

    if (!courseId) {
      return NextResponse.json({ error: "Falta courseId" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (color !== undefined) data.color = color;
    if (icon !== undefined) data.icon = icon;
    if (status !== undefined) data.status = status;
    if (order !== undefined) data.order = order;

    const course = await db.course.update({
      where: { id: courseId },
      data,
    });

    return NextResponse.json({ course });
  } catch (error) {
    console.error("Courses PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar curso" }, { status: 500 });
  }
}

// DELETE: eliminar curso
export async function DELETE(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "Falta courseId" }, { status: 400 });
    }

    await db.course.delete({ where: { id: courseId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Courses DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar curso" }, { status: 500 });
  }
}
