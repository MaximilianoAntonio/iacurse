import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: detalle completo de una unidad con lecciones, actividades (con metadatos de evaluación) y objetivos
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const unit = await db.unit.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          include: {
            activities: {
              orderBy: { order: "asc" },
            },
            objectives: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
        objectives: {
          where: { lessonId: null }, // solo objetivos de unidad
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      unit: {
        id: unit.id,
        slug: unit.slug,
        title: unit.title,
        summary: unit.summary,
        description: unit.description,
        icon: unit.icon,
        color: unit.color,
        order: unit.order,
        objectives: unit.objectives,
        lessons: unit.lessons.map((l) => ({
          id: l.id,
          unitId: l.unitId,
          slug: l.slug,
          title: l.title,
          description: l.description,
          content: l.content,
          durationMin: l.durationMin,
          order: l.order,
          objectives: l.objectives,
          activities: l.activities.map((a) => ({
            id: a.id,
            lessonId: a.lessonId,
            type: a.type,
            title: a.title,
            prompt: a.prompt,
            data: a.data,
            points: a.points,
            difficulty: a.difficulty,
            order: a.order,
            assessmentType: a.assessmentType,
            bloomLevel: a.bloomLevel,
            maxAttempts: a.maxAttempts,
            masteryThreshold: a.masteryThreshold,
            weight: a.weight,
            timeLimitMin: a.timeLimitMin,
            rubricId: a.rubricId,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Admin unit detail GET API error:", error);
    return NextResponse.json({ error: "Error al cargar unidad" }, { status: 500 });
  }
}
