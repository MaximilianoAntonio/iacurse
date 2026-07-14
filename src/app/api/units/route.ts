import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Lista todas las unidades con conteo de lecciones y progreso del usuario
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  const units = await db.unit.findMany({
    orderBy: { order: "asc" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, description: true, durationMin: true, order: true, slug: true },
      },
      _count: { select: { lessons: true } },
    },
  });

  let progressMap: Record<string, { completed: number; total: number; mastery: number; lastVisited: string | null }> = {};

  if (userId) {
    const progress = await db.progress.findMany({
      where: { userId },
      select: { unitId: true, completed: true, total: true, mastery: true, lastVisited: true },
    });
    progressMap = Object.fromEntries(
      progress.map((p) => [p.unitId, {
        completed: p.completed,
        total: p.total,
        mastery: Math.min(100, p.mastery),
        lastVisited: p.lastVisited?.toISOString() ?? null,
      }])
    );
  }

  const unitsWithMeta = await Promise.all(
    units.map(async (u) => {
      const activityCount = await db.activity.count({
        where: { lesson: { unitId: u.id } },
      });
      const rawProgress = progressMap[u.id];
      // Clampear completed al total real de actividades
      const total = activityCount;
      const completed = rawProgress ? Math.min(rawProgress.completed, total) : 0;
      const mastery = rawProgress ? Math.min(100, Math.round((completed / Math.max(1, total)) * 100)) : 0;
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
        lessons: u.lessons,
        progress: rawProgress
          ? { completed, total, mastery, lastVisited: rawProgress.lastVisited }
          : null,
      };
    })
  );

  return NextResponse.json({ units: unitsWithMeta });
}
