import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Detalle de una lección con contenido completo y actividades
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get("userId");

  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, title: true, color: true, icon: true, slug: true } },
      activities: { orderBy: { order: "asc" } },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lección no encontrada" }, { status: 404 });
  }

  // Intentos del usuario en las actividades de esta lección
  let attemptsByActivity: Record<string, { completed: boolean; bestScore: number | null; attempts: number; lastAnswer?: string }> = {};
  if (userId) {
    const attempts = await db.attempt.findMany({
      where: { userId, lessonId: undefined, activity: { lessonId: id } },
      select: { activityId: true, correct: true, score: true, answer: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    for (const a of attempts) {
      const existing = attemptsByActivity[a.activityId];
      if (!existing) {
        attemptsByActivity[a.activityId] = {
          completed: a.correct ?? false,
          bestScore: a.score,
          attempts: 1,
          lastAnswer: a.answer,
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
    lesson: {
      id: lesson.id,
      unitId: lesson.unitId,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      durationMin: lesson.durationMin,
      order: lesson.order,
      unit: lesson.unit,
      activities: lesson.activities,
    },
    attemptsByActivity,
  });
}
