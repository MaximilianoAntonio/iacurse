import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Detalle de un estudiante: desglose por actividad con intentos, puntajes y tiempos
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id: studentId } = await params;

  const student = await db.user.findUnique({
    where: { id: studentId, role: "student" },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      points: true,
      streak: true,
      lastActive: true,
      createdAt: true,
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Estudiante no encontrado" }, { status: 404 });
  }

  // Progreso por unidad
  const progress = await db.progress.findMany({
    where: { userId: studentId },
    include: {
      unit: { select: { id: true, title: true, color: true, icon: true, slug: true, order: true } },
    },
    orderBy: { unit: { order: "asc" } },
  });

  // Todos los intentos del estudiante
  const attempts = await db.attempt.findMany({
    where: { userId: studentId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      correct: true,
      score: true,
      timeSpent: true,
      hintsUsed: true,
      createdAt: true,
      activityId: true,
      activity: {
        select: {
          id: true,
          title: true,
          type: true,
          difficulty: true,
          points: true,
          lesson: {
            select: {
              id: true,
              title: true,
              unit: { select: { id: true, title: true, color: true, icon: true } },
            },
          },
        },
      },
    },
  });

  // Agrupar intentos por actividad
  const byActivity: Record<string, {
    activity: typeof attempts[number]["activity"];
    attempts: typeof attempts;
    bestScore: number;
    correct: boolean;
    totalAttempts: number;
    totalTime: number;
    totalHints: number;
    lastAttempt: string;
  }> = {};

  for (const a of attempts) {
    const key = a.activityId;
    if (!byActivity[key]) {
      byActivity[key] = {
        activity: a.activity,
        attempts: [],
        bestScore: 0,
        correct: false,
        totalAttempts: 0,
        totalTime: 0,
        totalHints: 0,
        lastAttempt: a.createdAt.toISOString(),
      };
    }
    byActivity[key].attempts.push(a);
    byActivity[key].totalAttempts++;
    byActivity[key].totalTime += a.timeSpent ?? 0;
    byActivity[key].totalHints += a.hintsUsed ?? 0;
    if (a.correct) byActivity[key].correct = true;
    if (a.score > byActivity[key].bestScore) byActivity[key].bestScore = a.score;
  }

  // Sesiones de estudio
  const sessions = await db.studySession.findMany({
    where: { userId: studentId },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: { id: true, duration: true, startedAt: true, unitId: true },
  });

  // Consultas al tutor
  const chatCount = await db.chatMessage.count({
    where: { userId: studentId, role: "user" },
  });

  // Autoevaluaciones
  const selfAssessments = await db.selfAssessment.findMany({
    where: { userId: studentId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, confidence: true, reflection: true, unitId: true, createdAt: true },
  });

  // Badges
  const userBadges = await db.userBadge.findMany({
    where: { userId: studentId },
    include: { badge: { select: { id: true, name: true, icon: true, tier: true, slug: true } } },
    orderBy: { awardedAt: "desc" },
  });

  return NextResponse.json({
    student: {
      ...student,
      lastActive: student.lastActive?.toISOString() ?? null,
      createdAt: student.createdAt.toISOString(),
    },
    progress: progress.map((p) => ({
      unitId: p.unitId,
      unit: p.unit,
      completed: Math.min(p.completed, p.total),
      total: p.total,
      mastery: Math.min(100, p.mastery),
      lastVisited: p.lastVisited?.toISOString() ?? null,
    })),
    activities: Object.values(byActivity).sort((a, b) => {
      // Ordenar por unidad y luego por lección
      const ua = a.activity.lesson.unit.title;
      const ub = b.activity.lesson.unit.title;
      return ua.localeCompare(ub);
    }),
    sessions: sessions.map((s) => ({
      ...s,
      startedAt: s.startedAt.toISOString(),
    })),
    chatCount,
    selfAssessments: selfAssessments.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    })),
    badges: userBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      icon: ub.badge.icon,
      tier: ub.badge.tier,
      slug: ub.badge.slug,
      awardedAt: ub.awardedAt.toISOString(),
    })),
    stats: {
      totalAttempts: attempts.length,
      correctAttempts: attempts.filter((a) => a.correct).length,
      totalActivitiesAttempted: Object.keys(byActivity).length,
      totalActivitiesCorrect: Object.values(byActivity).filter((a) => a.correct).length,
      totalTimeMin: Math.round(sessions.reduce((a, s) => a + s.duration, 0) / 60),
      avgScore: attempts.length > 0 ? Math.round(attempts.reduce((a, x) => a + x.score, 0) / attempts.length) : 0,
      totalHintsUsed: attempts.reduce((a, x) => a + (x.hintsUsed ?? 0), 0),
    },
  });
  } catch (error) {
    console.error("Student detail API error:", error);
    return NextResponse.json({ error: "Error al cargar el estudiante" }, { status: 500 });
  }
}
