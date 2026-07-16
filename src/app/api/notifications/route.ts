import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Notificaciones del usuario: badges recientes + (para docentes) reportes pendientes
export async function GET(req: NextRequest) {
  try {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const notifications: {
    id: string;
    type: "badge" | "report" | "info";
    title: string;
    description: string;
    icon: string;
    createdAt: string;
    actionView?: string;
  }[] = [];

  if (user.role === "student") {
    // Badges recientes (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentBadges = await db.userBadge.findMany({
      where: { userId, awardedAt: { gte: sevenDaysAgo } },
      include: { badge: { select: { id: true, name: true, icon: true, tier: true } } },
      orderBy: { awardedAt: "desc" },
      take: 5,
    });

    for (const ub of recentBadges) {
      notifications.push({
        id: `badge-${ub.badge.id}`,
        type: "badge",
        title: "¡Nuevo badge desbloqueado!",
        description: ub.badge.name,
        icon: ub.badge.icon,
        createdAt: ub.awardedAt.toISOString(),
        actionView: "achievements",
      });
    }
  } else if (user.role === "teacher") {
    // Reportes de errores pendientes
    const pendingReports = await db.errorReport.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
      },
    });

    for (const r of pendingReports) {
      notifications.push({
        id: `report-${r.id}`,
        type: "report",
        title: "Reporte de error pendiente",
        description: `${r.user.name}: ${r.reason}`,
        icon: "Flag",
        createdAt: r.createdAt.toISOString(),
        actionView: "teacher",
      });
    }
  }

  // Contar no leídas (simplificado: todas son "no leídas" si son de las últimas 24h)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const unreadCount = notifications.filter((n) => new Date(n.createdAt) > oneDayAgo).length;

  return NextResponse.json({
    notifications: notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    unreadCount,
  });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
