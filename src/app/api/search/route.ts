import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Búsqueda global de contenido: unidades, lecciones y actividades
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const userId = req.nextUrl.searchParams.get("userId");

  if (q.length < 2) {
    return NextResponse.json({ results: { units: [], lessons: [], activities: [] } });
  }

  const query = q.toLowerCase();

  // Buscar unidades
  const units = await db.unit.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { summary: { contains: q } },
        { description: { contains: q } },
      ],
    },
    select: {
      id: true,
      title: true,
      summary: true,
      icon: true,
      color: true,
      slug: true,
      order: true,
    },
    orderBy: { order: "asc" },
  });

  // Buscar lecciones (incluyendo contenido markdown)
  const lessons = await db.lesson.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { content: { contains: q } },
      ],
    },
    include: {
      unit: { select: { id: true, title: true, color: true, icon: true, slug: true } },
    },
    orderBy: { order: "asc" },
    take: 20,
  });

  // Buscar actividades
  const activities = await db.activity.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { prompt: { contains: q } },
      ],
    },
    select: {
      id: true,
      title: true,
      type: true,
      difficulty: true,
      points: true,
      lessonId: true,
      lesson: {
        select: {
          id: true,
          title: true,
          unit: { select: { id: true, title: true, color: true, icon: true, slug: true } },
        },
      },
    },
    take: 20,
  });

  // Si hay userId, incluir info de intentos
  let attemptedMap: Record<string, boolean> = {};
  if (userId) {
    const attempts = await db.attempt.findMany({
      where: { userId, correct: true },
      select: { activityId: true },
      distinct: ["activityId"],
    });
    attemptedMap = Object.fromEntries(attempts.map((a) => [a.activityId, true]));
  }

  // Helper para extraer un snippet del contexto coincidente
  const extractSnippet = (text: string, query: string, contextChars = 60): string => {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return "";
    const start = Math.max(0, idx - contextChars);
    const end = Math.min(text.length, idx + query.length + contextChars);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    // Limpiar markdown básico
    const snippet = text.slice(start, end).replace(/[#*`_~\[\]]/g, "").replace(/\n+/g, " ").trim();
    return prefix + snippet + suffix;
  };

  return NextResponse.json({
    results: {
      units: units.map((u) => ({ ...u })),
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        durationMin: l.durationMin,
        unit: l.unit,
        snippet: extractSnippet(l.content, q),
      })),
      activities: activities.map((a) => ({
        ...a,
        completed: Boolean(attemptedMap[a.id]),
        snippet: extractSnippet(a.prompt, q),
      })),
    },
  });
}
