import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Detalle de una unidad por slug, con lecciones y actividades
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
  const { slug } = await params;
  const userId = req.nextUrl.searchParams.get("userId");

  // Aceptar tanto slug como id
  let unit = await db.unit.findUnique({
    where: { slug },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        include: {
          activities: {
            orderBy: { order: "asc" },
            select: { id: true, type: true, title: true, points: true, difficulty: true, order: true },
          },
        },
      },
    },
  });
  if (!unit) {
    unit = await db.unit.findUnique({
      where: { id: slug },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          include: {
            activities: {
              orderBy: { order: "asc" },
              select: { id: true, type: true, title: true, points: true, difficulty: true, order: true },
            },
          },
        },
      },
    });
  }

  if (!unit) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  // Progreso del usuario en esta unidad
  let progress = null;
  let attemptsByActivity: Record<string, { completed: boolean; bestScore: number | null; attempts: number }> = {};

  if (userId) {
    progress = await db.progress.findUnique({
      where: { userId_unitId: { userId, unitId: unit.id } },
    });
    // Intentos del usuario en actividades de esta unidad
    const attempts = await db.attempt.findMany({
      where: { userId, activity: { lesson: { unitId: unit.id } } },
      select: { activityId: true, correct: true, score: true },
    });
    for (const a of attempts) {
      const existing = attemptsByActivity[a.activityId];
      if (!existing) {
        attemptsByActivity[a.activityId] = {
          completed: a.correct ?? false,
          bestScore: a.score,
          attempts: 1,
        };
      } else {
        existing.attempts += 1;
        if (a.correct) existing.completed = true;
        if (a.score != null && (existing.bestScore == null || a.score > existing.bestScore)) {
          existing.bestScore = a.score;
        }
      }
    }
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
      lessons: unit.lessons.map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        description: l.description,
        durationMin: l.durationMin,
        order: l.order,
        activities: l.activities,
      })),
    },
    progress: progress
      ? {
          completed: progress.completed,
          total: progress.total,
          mastery: progress.mastery,
          lastVisited: progress.lastVisited?.toISOString() ?? null,
        }
      : null,
    attemptsByActivity,
  });
  } catch (error) {
    console.error("Units slug API error:", error);
    return NextResponse.json({ error: "Error al cargar la unidad" }, { status: 500 });
  }
}
