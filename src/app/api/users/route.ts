import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatar: true,
      points: true,
      streak: true,
    },
  });
  return NextResponse.json({ users });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
