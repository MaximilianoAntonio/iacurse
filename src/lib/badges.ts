import { db } from "@/lib/db";

export interface BadgeAwardResult {
  badgeSlug: string;
  badgeName: string;
  badgeIcon: string;
  badgeTier: string;
  newlyAwarded: boolean;
}

/**
 * Evalúa y otorga badges al usuario después de una actividad.
 * Retorna la lista de badges recién otorgados (para mostrar celebración).
 */
export async function checkAndAwardBadges(userId: string): Promise<BadgeAwardResult[]> {
  const newlyAwarded: BadgeAwardResult[] = [];

  // Obtener todos los badges disponibles
  const allBadges = await db.badge.findMany();
  const badgeBySlug = Object.fromEntries(allBadges.map((b) => [b.slug, b]));

  // Obtener badges ya otorgados al usuario
  const existingUserBadges = await db.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const existingBadgeIds = new Set(existingUserBadges.map((ub) => ub.badgeId));

  // Estadísticas del usuario para evaluar criterios
  const correctAttempts = await db.attempt.findMany({
    where: { userId, correct: true },
    select: { activityId: true, createdAt: true },
    distinct: ["activityId"],
  });

  const totalCorrectActivities = correctAttempts.length;

  // Progreso por unidad
  const progress = await db.progress.findMany({
    where: { userId },
    include: { unit: { select: { id: true, title: true, slug: true, color: true, icon: true } } },
  });

  // Visitas a unidades (con lastVisited no nulo)
  const visitedUnits = progress.filter((p) => p.lastVisited !== null).length;

  // Racha del usuario
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streak: true, points: true },
  });

  // Consultas al tutor
  const chatCount = await db.chatMessage.count({
    where: { userId, role: "user" },
  });

  // Helper para otorgar un badge si no lo tiene
  const awardIfMissing = async (slug: string, condition: boolean) => {
    if (!condition) return;
    const badge = badgeBySlug[slug];
    if (!badge || existingBadgeIds.has(badge.id)) return;
    await db.userBadge.create({
      data: { userId, badgeId: badge.id },
    });
    newlyAwarded.push({
      badgeSlug: slug,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      badgeTier: badge.tier,
      newlyAwarded: true,
    });
  };

  // 1. primer-paso: completa tu primera actividad
  await awardIfMissing("primer-paso", totalCorrectActivities >= 1);

  // 2. explorador: visita las 5 unidades
  await awardIfMissing("explorador", visitedUnits >= 5);

  // 3. racha-7: racha de 7 días
  await awardIfMissing("racha-7", (user?.streak ?? 0) >= 7);

  // 4. maestro-ecg: domina la unidad de ECG con ≥80%
  const ecgProgress = progress.find((p) => p.unit.slug === "electrocardiografia");
  await awardIfMissing("maestro-ecg", (ecgProgress?.mastery ?? 0) >= 80);

  // 5. centinela: completa el módulo de Seguridad Eléctrica
  const safetyProgress = progress.find((p) => p.unit.slug === "seguridad-electrica");
  const safetyTotal = await db.activity.count({ where: { lesson: { unit: { slug: "seguridad-electrica" } } } });
  await awardIfMissing("centinela", safetyProgress !== undefined && safetyProgress.completed >= safetyTotal && safetyTotal > 0);

  // 6. tutor-activo: 10 consultas al tutor
  await awardIfMissing("tutor-activo", chatCount >= 10);

  return newlyAwarded;
}
