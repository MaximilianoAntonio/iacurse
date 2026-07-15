import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Búsqueda global de contenido: unidades, lecciones y actividades
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const userId = req.nextUrl.searchParams.get("userId");

  if (q.length < 2) {
    return NextResponse.json({ results: { units: [], lessons: [], activities: [] } });
  }

  const query = q.toLowerCase();

  // Buscar unidades
  const units = await db.unit.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { summary: { contains: q } },
        { description: { contains: q } },
      ],
    },
    select: {
      id: true,
      title: true,
      summary: true,
      icon: true,
      color: true,
      slug: true,
      order: true,
    },
    orderBy: { order: "asc" },
  });

  // Buscar lecciones
  const lessons = await db.lesson.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
      ],
    },
    include: {
      unit: { select: { id: true, title: true, color: true, icon: true, slug: true } },
    },
    orderBy: { order: "asc" },
    take: 20,
  });

  // Buscar actividades
  const activities = await db.activity.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { prompt: { contains: q } },
      ],
    },
    select: {
      id: true,
      title: true,
      type: true,
      difficulty: true,
      points: true,
      lessonId: true,
      lesson: {
        select: {
          id: true,
          title: true,
          unit: { select: { id: true, title: true, color: true, icon: true, slug: true } },
        },
      },
    },
    take: 20,
  });

  // Si hay userId, incluir info de intentos
  let attemptedMap: Record<string, boolean> = {};
  if (userId) {
    const attempts = await db.attempt.findMany({
      where: { userId, correct: true },
      select: { activityId: true },
      distinct: ["activityId"],
    });
    attemptedMap = Object.fromEntries(attempts.map((a) => [a.activityId, true]));
  }

  return NextResponse.json({
    results: {
      units: units.map((u) => ({ ...u })),
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        durationMin: l.durationMin,
        unit: l.unit,
      })),
      activities: activities.map((a) => ({
        ...a,
        completed: Boolean(attemptedMap[a.id]),
      })),
    },
  });
}
