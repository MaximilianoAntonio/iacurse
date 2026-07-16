import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST: registrar un reporte de error de la IA
export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { userId, source, sourceId, reason, comment } = body as {
    userId: string;
    source: string;
    sourceId?: string;
    reason: string;
    comment?: string;
  };

  if (!userId || !source || !reason) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const validSources = ["chat", "activity", "content"];
  const validReasons = ["incorrect", "biased", "offtopic", "harmful", "other"];
  if (!validSources.includes(source)) {
    return NextResponse.json({ error: "source inválido" }, { status: 400 });
  }
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: "reason inválido" }, { status: 400 });
  }

  const report = await db.errorReport.create({
    data: {
      userId,
      source,
      sourceId: sourceId ?? null,
      reason,
      comment: comment?.slice(0, 1000) ?? null,
    },
  });

  return NextResponse.json({ id: report.id, ok: true });
  } catch (error) {
    console.error("Report POST API error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// GET: listar reportes (para el panel docente)
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const reports = await db.errorReport.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  });
  return NextResponse.json({
    reports: reports.map((r) => ({
      id: r.id,
      source: r.source,
      sourceId: r.sourceId,
      reason: r.reason,
      comment: r.comment,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  });
}

// PATCH: actualizar estado del reporte
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
  const { reportId, status } = body as { reportId: string; status: string };
  if (!reportId || !["open", "reviewed", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  await db.errorReport.update({
    where: { id: reportId },
    data: { status },
  });
  return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
