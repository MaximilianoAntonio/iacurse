import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Badges del usuario + todas las insignias disponibles
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  const allBadges = await db.badge.findMany({
    orderBy: { tier: "asc" },
  });

  let earned: Record<string, string> = {}; // badgeId -> awardedAt
  if (userId) {
    const userBadges = await db.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, awardedAt: true },
    });
    earned = Object.fromEntries(userBadges.map((b) => [b.badgeId, b.awardedAt.toISOString()]));
  }

  return NextResponse.json({
    badges: allBadges.map((b) => ({
      ...b,
      earned: Boolean(earned[b.id]),
      awardedAt: earned[b.id] ?? null,
    })),
  });
}
