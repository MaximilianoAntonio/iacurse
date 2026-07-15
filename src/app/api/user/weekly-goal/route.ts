import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST: actualizar la meta semanal de estudio del usuario
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, weeklyGoalMin } = body as {
    userId: string;
    weeklyGoalMin: number;
  };

  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  // Validar rango razonable: 30 min a 20 horas
  const goal = Math.max(30, Math.min(1200, Math.round(weeklyGoalMin)));

  const user = await db.user.update({
    where: { id: userId },
    data: { weeklyGoalMin: goal },
    select: { id: true, weeklyGoalMin: true },
  });

  return NextResponse.json({ ok: true, weeklyGoalMin: user.weeklyGoalMin });
}
