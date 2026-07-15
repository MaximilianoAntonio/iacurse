import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Progreso del usuario hacia cada badge (para mostrar indicadores de progreso)
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }

  const allBadges = await db.badge.findMany();

  // Estadísticas del usuario
  const correctAttempts = await db.attempt.findMany({
    where: { userId, correct: true },
    select: { activityId: true },
    distinct: ["activityId"],
  });
  const totalCorrectActivities = correctAttempts.length;

  const progress = await db.progress.findMany({
    where: { userId },
    include: { unit: { select: { id: true, title: true, slug: true } } },
  });
  const visitedUnits = progress.filter((p) => p.lastVisited !== null).length;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streak: true },
  });

  const chatCount = await db.chatMessage.count({
    where: { userId, role: "user" },
  });

  // Badges ya obtenidos
  const userBadges = await db.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

  // Calcular progreso para cada badge
  const badgeProgress = allBadges.map((badge) => {
    let current = 0;
    let target = 1;
    let unitContext: string | null = null;

    switch (badge.slug) {
      case "primer-paso":
        current = Math.min(totalCorrectActivities, 1);
        target = 1;
        break;
      case "explorador":
        current = Math.min(visitedUnits, 5);
        target = 5;
        break;
      case "racha-7":
        current = Math.min(user?.streak ?? 0, 7);
        target = 7;
        break;
      case "maestro-ecg": {
        const ecg = progress.find((p) => p.unit.slug === "electrocardiografia");
        current = Math.min(ecg?.mastery ?? 0, 100);
        target = 80;
        unitContext = "Electrocardiografía (ECG)";
        break;
      }
      case "centinela": {
        const safety = progress.find((p) => p.unit.slug === "seguridad-electrica");
        current = safety?.completed ?? 0;
        // target = total actividades de seguridad
        // (approximamos con el total del progress record)
        target = safety?.total ?? 7;
        unitContext = "Seguridad Eléctrica Clínica";
        break;
      }
      case "tutor-activo":
        current = Math.min(chatCount, 10);
        target = 10;
        break;
    }

    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const earned = earnedBadgeIds.has(badge.id);

    return {
      badgeId: badge.id,
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      tier: badge.tier,
      earned,
      current,
      target,
      pct,
      unitContext,
    };
  });

  return NextResponse.json({ badges: badgeProgress });
}
