import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getZAI, TUTOR_SYSTEM_PROMPT } from "@/lib/ai";
import { checkAndAwardBadges } from "@/lib/badges";

// POST: chat con el tutor IA
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, message, context } = body as {
      userId: string;
      message: string;
      context?: string;
    };

    if (!userId || !message) {
    return NextResponse.json({ error: "Faltan userId o message" }, { status: 400 });
  }

  // Cargar historial reciente (últimos 10 mensajes)
  const history = await db.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const historyMessages = history.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Construir mensajes para el LLM
  const contextPrefix = context ? `\n\n[Contexto actual del estudiante: está estudiando "${context}"]` : "";
  const messages = [
    { role: "assistant" as const, content: TUTOR_SYSTEM_PROMPT + contextPrefix },
    ...historyMessages,
    { role: "user" as const, content: message },
  ];

  // Guardar mensaje del usuario
  await db.chatMessage.create({
    data: { userId, role: "user", content: message, context: context ?? null },
  });

  let assistantContent = "";
  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    assistantContent = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    assistantContent =
      "Disculpa, en este momento no puedo procesar tu consulta. Mientras tanto, te sugiero revisar el material de la unidad correspondiente y reintentar en unos segundos.";
  }

  // Guardar respuesta del asistente
  const saved = await db.chatMessage.create({
    data: { userId, role: "assistant", content: assistantContent, context: context ?? null },
  });

  // Evaluar badges (ej. "tutor-activo" tras 10 consultas)
  const newBadges = await checkAndAwardBadges(userId);

  return NextResponse.json({
    message: {
      id: saved.id,
      role: "assistant",
      content: assistantContent,
      createdAt: saved.createdAt.toISOString(),
    },
    newBadges: newBadges.length > 0 ? newBadges : undefined,
  });
  } catch (error) {
    console.error("Tutor API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la consulta" },
      { status: 500 }
    );
  }
}

// GET: historial de chat del usuario
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ messages: [] });
  }
  const messages = await db.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      role: true,
      content: true,
      context: true,
      rating: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
}

// PATCH: calificar un mensaje del tutor
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { messageId, rating } = body as { messageId: string; rating: number };
  if (!messageId || !rating) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  await db.chatMessage.update({
    where: { id: messageId },
    data: { rating },
  });
  return NextResponse.json({ ok: true });
}
