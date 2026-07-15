import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Obtiene el usuario actual según el userId pasado por query.
// Si no existe, retorna el primer estudiante como default.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  const selectFields = {
    id: true,
    email: true,
    name: true,
    role: true,
    avatar: true,
    points: true,
    streak: true,
    weeklyGoalMin: true,
    lastActive: true,
  };

  let user = null;
  if (userId) {
    user = await db.user.findUnique({
      where: { id: userId },
      select: selectFields,
    });
  }

  if (!user) {
    user = await db.user.findFirst({
      where: { role: "student" },
      orderBy: { createdAt: "asc" },
      select: selectFields,
    });
  }

  if (!user) {
    return NextResponse.json({ error: "No hay usuarios" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
