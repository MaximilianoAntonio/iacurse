import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar rúbricas del docente
export async function GET(req: NextRequest) {
  try {
    const authorId = req.nextUrl.searchParams.get("authorId");
    if (!authorId) {
      return NextResponse.json({ error: "Falta authorId" }, { status: 400 });
    }

    const rubrics = await db.rubric.findMany({
      where: { authorId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { activities: true } },
      },
    });

    return NextResponse.json({
      rubrics: rubrics.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        criteria: r.criteria,
        activityCount: r._count.activities,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Rubrics GET API error:", error);
    return NextResponse.json({ error: "Error al cargar rúbricas" }, { status: 500 });
  }
}

// POST: crear rúbrica
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorId, name, description, criteria } = body as {
      authorId: string;
      name: string;
      description?: string;
      criteria: string; // JSON string
    };

    if (!authorId || !name.trim()) {
      return NextResponse.json({ error: "Faltan authorId o name" }, { status: 400 });
    }

    // Validar que criteria sea JSON válido
    try {
      JSON.parse(criteria);
    } catch {
      return NextResponse.json({ error: "Criteria debe ser JSON válido" }, { status: 400 });
    }

    const rubric = await db.rubric.create({
      data: {
        authorId,
        name: name.trim(),
        description: description || null,
        criteria,
      },
    });

    return NextResponse.json({ rubric });
  } catch (error) {
    console.error("Rubrics POST API error:", error);
    return NextResponse.json({ error: "Error al crear rúbrica" }, { status: 500 });
  }
}

// PATCH: actualizar rúbrica
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { rubricId, name, description, criteria } = body as {
      rubricId: string;
      name?: string;
      description?: string;
      criteria?: string;
    };

    if (!rubricId) {
      return NextResponse.json({ error: "Falta rubricId" }, { status: 400 });
    }

    if (criteria) {
      try {
        JSON.parse(criteria);
      } catch {
        return NextResponse.json({ error: "Criteria debe ser JSON válido" }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (criteria !== undefined) data.criteria = criteria;

    const rubric = await db.rubric.update({ where: { id: rubricId }, data });
    return NextResponse.json({ rubric });
  } catch (error) {
    console.error("Rubrics PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar rúbrica" }, { status: 500 });
  }
}

// DELETE: eliminar rúbrica
export async function DELETE(req: NextRequest) {
  try {
    const rubricId = req.nextUrl.searchParams.get("rubricId");
    if (!rubricId) {
      return NextResponse.json({ error: "Falta rubricId" }, { status: 400 });
    }

    await db.rubric.delete({ where: { id: rubricId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Rubrics DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar rúbrica" }, { status: 500 });
  }
}
