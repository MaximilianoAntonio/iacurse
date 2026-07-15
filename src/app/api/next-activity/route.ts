import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Encuentra la próxima actividad recomendada para el estudiante:
// 1. La última unidad visitada con actividades incompletas, o
// 2. La primera unidad con actividades incompletas, o
// 3. null si todo está completo
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  // Progreso del usuario, ordenado por última visita descendente
  const progress = await db.progress.findMany({
    where: { userId },
    include: {
      unit: {
        select: {
          id: true,
          title: true,
          color: true,
          icon: true,
          slug: true,
          order: true,
        },
      },
    },
    orderBy: { lastVisited: "desc" },
  });

  // Todas las unidades con sus lecciones y actividades
  const units = await db.unit.findMany({
    orderBy: { order: "asc" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        include: {
          activities: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              difficulty: true,
              points: true,
              lessonId: true,
            },
          },
        },
      },
    },
  });

  // Actividades correctas del usuario (para saber cuáles faltan)
  const correctAttempts = await db.attempt.findMany({
    where: { userId, correct: true },
    select: { activityId: true },
    distinct: ["activityId"],
  });
  const completedActivityIds = new Set(correctAttempts.map((a) => a.activityId));

  // Función para encontrar la próxima actividad incompleta en una unidad
  const findNextInUnit = (unit: typeof units[number]) => {
    for (const lesson of unit.lessons) {
      for (const activity of lesson.activities) {
        if (!completedActivityIds.has(activity.id)) {
          return { activity, lesson, unit };
        }
      }
    }
    return null;
  };

  // 1. Intentar la última unidad visitada con actividades incompletas
  for (const p of progress) {
    const unit = units.find((u) => u.id === p.unitId);
    if (unit) {
      const next = findNextInUnit(unit);
      if (next) {
        return NextResponse.json({
          recommendation: {
            ...next,
            reason: "continue",
            unitProgress: {
              completed: p.completed,
              total: p.total,
              mastery: p.mastery,
            },
          },
        });
      }
    }
  }

  // 2. Primera unidad con actividades incompletas
  for (const unit of units) {
    const next = findNextInUnit(unit);
    if (next) {
      const unitProgress = progress.find((p) => p.unitId === unit.id);
      return NextResponse.json({
        recommendation: {
          ...next,
          reason: "new",
          unitProgress: unitProgress
            ? { completed: unitProgress.completed, total: unitProgress.total, mastery: unitProgress.mastery }
            : { completed: 0, total: unit.lessons.reduce((a, l) => a + l.activities.length, 0), mastery: 0 },
        },
      });
    }
  }

  // 3. Todo completo
  return NextResponse.json({ recommendation: null });
}
