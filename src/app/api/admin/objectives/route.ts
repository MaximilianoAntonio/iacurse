import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar objetivos de aprendizaje
// ?unitId=xxx → objetivos de esa unidad (incluye los de lección)
// ?lessonId=xxx → objetivos de esa lección específica
export async function GET(req: NextRequest) {
  try {
    const unitId = req.nextUrl.searchParams.get("unitId");
    const lessonId = req.nextUrl.searchParams.get("lessonId");

    if (!unitId && !lessonId) {
      return NextResponse.json({ error: "Falta unitId o lessonId" }, { status: 400 });
    }

    const where: { unitId?: string; lessonId?: string | null } = {};
    if (lessonId) {
      where.lessonId = lessonId;
    } else if (unitId) {
      where.unitId = unitId;
    }

    const objectives = await db.learningObjective.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { activities: true } },
      },
    });

    return NextResponse.json({
      objectives: objectives.map((o) => ({
        id: o.id,
        unitId: o.unitId,
        lessonId: o.lessonId,
        code: o.code,
        description: o.description,
        bloomLevel: o.bloomLevel,
        activityCount: o._count.activities,
      })),
    });
  } catch (error) {
    console.error("Objectives GET API error:", error);
    return NextResponse.json({ error: "Error al cargar objetivos" }, { status: 500 });
  }
}

// POST: crear objetivo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { unitId, lessonId, code, description, bloomLevel } = body as {
      unitId: string;
      lessonId?: string | null;
      code: string;
      description: string;
      bloomLevel?: string;
    };

    if (!unitId || !description.trim()) {
      return NextResponse.json({ error: "Faltan unitId o description" }, { status: 400 });
    }

    const objective = await db.learningObjective.create({
      data: {
        unitId,
        lessonId: lessonId || null,
        code: code || `O${Date.now().toString(36).slice(-4).toUpperCase()}`,
        description: description.trim(),
        bloomLevel: bloomLevel || "apply",
      },
    });

    return NextResponse.json({ objective });
  } catch (error) {
    console.error("Objectives POST API error:", error);
    return NextResponse.json({ error: "Error al crear objetivo" }, { status: 500 });
  }
}

// PATCH: actualizar objetivo
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { objectiveId, code, description, bloomLevel, lessonId } = body as {
      objectiveId: string;
      code?: string;
      description?: string;
      bloomLevel?: string;
      lessonId?: string | null;
    };

    if (!objectiveId) {
      return NextResponse.json({ error: "Falta objectiveId" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code;
    if (description !== undefined) data.description = description;
    if (bloomLevel !== undefined) data.bloomLevel = bloomLevel;
    if (lessonId !== undefined) data.lessonId = lessonId || null;

    const objective = await db.learningObjective.update({
      where: { id: objectiveId },
      data,
    });

    return NextResponse.json({ objective });
  } catch (error) {
    console.error("Objectives PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar objetivo" }, { status: 500 });
  }
}

// DELETE: eliminar objetivo
export async function DELETE(req: NextRequest) {
  try {
    const objectiveId = req.nextUrl.searchParams.get("objectiveId");
    if (!objectiveId) {
      return NextResponse.json({ error: "Falta objectiveId" }, { status: 400 });
    }

    await db.learningObjective.delete({ where: { id: objectiveId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Objectives DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar objetivo" }, { status: 500 });
  }
}
