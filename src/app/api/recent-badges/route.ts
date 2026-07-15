import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Badges recientes del usuario (últimos 7 días) para mostrar como notificación
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ badges: [] });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentBadges = await db.userBadge.findMany({
    where: {
      userId,
      awardedAt: { gte: sevenDaysAgo },
    },
    include: {
      badge: { select: { id: true, name: true, icon: true, tier: true, description: true } },
    },
    orderBy: { awardedAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    badges: recentBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      icon: ub.badge.icon,
      tier: ub.badge.tier,
      description: ub.badge.description,
      awardedAt: ub.awardedAt.toISOString(),
    })),
  });
}
