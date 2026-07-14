import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Progreso y analítica del usuario
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, points: true, streak: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Progreso por unidad
  const progress = await db.progress.findMany({
    where: { userId },
    include: { unit: { select: { id: true, title: true, color: true, icon: true, slug: true } } },
    orderBy: { unit: { order: "asc" } },
  });

  // Intentos (últimos 60)
  const attempts = await db.attempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      correct: true,
      score: true,
      timeSpent: true,
      createdAt: true,
      activity: {
        select: {
          id: true,
          title: true,
          type: true,
          difficulty: true,
          lesson: { select: { unit: { select: { title: true, color: true } } } },
        },
      },
    },
  });

  // Sesiones de estudio (últimos 30)
  const sessions = await db.studySession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: { id: true, duration: true, startedAt: true, unitId: true },
  });

  // Mensajes de chat
  const chatCount = await db.chatMessage.count({
    where: { userId, role: "user" },
  });

  // Autoevaluaciones
  const selfAssess = await db.selfAssessment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, confidence: true, reflection: true, unitId: true, createdAt: true },
  });

  // Calcular actividad por día (últimos 14 días)
  const days: { date: string; attempts: number; correct: number; timeMin: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const dayAttempts = attempts.filter((a) => {
      const c = new Date(a.createdAt);
      return c >= d && c < next;
    });
    const daySessions = sessions.filter((s) => {
      const c = new Date(s.startedAt);
      return c >= d && c < next;
    });
    days.push({
      date: d.toISOString().slice(0, 10),
      attempts: dayAttempts.length,
      correct: dayAttempts.filter((a) => a.correct).length,
      timeMin: Math.round(daySessions.reduce((acc, s) => acc + s.duration, 0) / 60),
    });
  }

  // Desglose por tipo de actividad
  const byType: Record<string, { total: number; correct: number }> = {};
  for (const a of attempts) {
    const t = a.activity.type;
    if (!byType[t]) byType[t] = { total: 0, correct: 0 };
    byType[t].total++;
    if (a.correct) byType[t].correct++;
  }

  // Desglose por dificultad
  const byDifficulty: Record<string, { total: number; correct: number }> = {};
  for (const a of attempts) {
    const d = a.activity.difficulty;
    if (!byDifficulty[d]) byDifficulty[d] = { total: 0, correct: 0 };
    byDifficulty[d].total++;
    if (a.correct) byDifficulty[d].correct++;
  }

  return NextResponse.json({
    user,
    progress: progress.map((p) => ({
      unitId: p.unitId,
      unit: p.unit,
      completed: p.completed,
      total: p.total,
      mastery: p.mastery,
      lastVisited: p.lastVisited?.toISOString() ?? null,
    })),
    attempts: attempts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    sessions: sessions.map((s) => ({ ...s, startedAt: s.startedAt.toISOString() })),
    chatCount,
    selfAssess: selfAssess.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    activityByDay: days,
    byType,
    byDifficulty,
    stats: {
      totalAttempts: attempts.length,
      correctRate: attempts.length > 0 ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : 0,
      totalTimeMin: Math.round(sessions.reduce((acc, s) => acc + s.duration, 0) / 60),
      avgScore: attempts.length > 0 ? Math.round(attempts.reduce((acc, a) => acc + (a.score ?? 0), 0) / attempts.length) : 0,
    },
  });
}
