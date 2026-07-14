import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Ranking de estudiantes
export async function GET() {
  const students = await db.user.findMany({
    where: { role: "student" },
    orderBy: { points: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      points: true,
      streak: true,
      avatar: true,
    },
  });

  // Para cada estudiante, calcular actividades completadas
  const ranked = await Promise.all(
    students.map(async (s, idx) => {
      const correctActivities = await db.attempt.findMany({
        where: { userId: s.id, correct: true },
        select: { activityId: true },
        distinct: ["activityId"],
      });
      return {
        rank: idx + 1,
        ...s,
        completedActivities: correctActivities.length,
      };
    })
  );

  return NextResponse.json({ leaderboard: ranked });
}
