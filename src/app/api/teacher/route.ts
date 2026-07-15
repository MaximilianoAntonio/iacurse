import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Panel docente: métricas agregadas de todos los estudiantes
export async function GET(req: NextRequest) {
  const unitId = req.nextUrl.searchParams.get("unitId");

  const students = await db.user.findMany({
    where: { role: "student" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, avatar: true, points: true, streak: true },
  });

  const units = await db.unit.findMany({
    orderBy: { order: "asc" },
    select: { id: true, title: true, color: true, icon: true, slug: true },
  });

  // Para cada estudiante: progreso por unidad, intentos, tiempo, chat
  const studentsWithData = await Promise.all(
    students.map(async (s) => {
      const progress = await db.progress.findMany({
        where: { userId: s.id, ...(unitId ? { unitId } : {}) },
        include: { unit: { select: { id: true, title: true, color: true } } },
      });
      const attempts = await db.attempt.findMany({
        where: { userId: s.id },
        select: { id: true, correct: true, score: true, timeSpent: true, hintsUsed: true, createdAt: true, activityId: true },
      });
      const correctActivities = await db.attempt.findMany({
        where: { userId: s.id, correct: true },
        select: { activityId: true },
        distinct: ["activityId"],
      });
      const sessions = await db.studySession.findMany({
        where: { userId: s.id },
        select: { duration: true, startedAt: true },
      });
      const chatCount = await db.chatMessage.count({ where: { userId: s.id, role: "user" } });
      const totalTimeMin = Math.round(sessions.reduce((a, x) => a + x.duration, 0) / 60);
      const lastActive = sessions.length > 0
        ? sessions.map((x) => x.startedAt).sort((a, b) => b.getTime() - a.getTime())[0]
        : null;

      return {
        ...s,
        progressByUnit: progress.map((p) => ({
          unitId: p.unitId,
          unitTitle: p.unit.title,
          unitColor: p.unit.color,
          completed: p.completed,
          total: p.total,
          mastery: p.mastery,
        })),
        totalAttempts: attempts.length,
        correctAttempts: attempts.filter((a) => a.correct).length,
        completedActivities: correctActivities.length,
        totalTimeMin,
        chatCount,
        lastActive: lastActive?.toISOString() ?? null,
        avgScore:
          attempts.length > 0
            ? Math.round(attempts.reduce((a, x) => a + (x.score ?? 0), 0) / attempts.length)
            : 0,
        totalHintsUsed: attempts.reduce((a, x) => a + (x.hintsUsed ?? 0), 0),
      };
    })
  );

  // Métricas agregadas
  const aggregate = {
    totalStudents: students.length,
    totalAttempts: studentsWithData.reduce((a, s) => a + s.totalAttempts, 0),
    avgMasteryByUnit: units.map((u) => {
      const records = studentsWithData
        .flatMap((s) => s.progressByUnit)
        .filter((p) => p.unitId === u.id);
      const avg = records.length > 0 ? Math.round(records.reduce((a, p) => a + p.mastery, 0) / records.length) : 0;
      return { unitId: u.id, unitTitle: u.title, unitColor: u.color, avgMastery: avg };
    }),
    totalChatQueries: studentsWithData.reduce((a, s) => a + s.chatCount, 0),
    totalStudyHours: Math.round(studentsWithData.reduce((a, s) => a + s.totalTimeMin, 0) / 60),
  };

  return NextResponse.json({
    students: studentsWithData,
    units,
    aggregate,
  });
}
