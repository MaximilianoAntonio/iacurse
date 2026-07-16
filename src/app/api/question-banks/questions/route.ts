import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar preguntas (por banco o todas)
export async function GET(req: NextRequest) {
  try {
    const bankId = req.nextUrl.searchParams.get("bankId");
    const authorId = req.nextUrl.searchParams.get("authorId");

    if (bankId) {
      const questions = await db.question.findMany({
        where: { bankId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ questions });
    }

    if (authorId) {
      const banks = await db.questionBank.findMany({
        where: { authorId },
        select: { id: true },
      });
      const bankIds = banks.map((b) => b.id);
      const questions = await db.question.findMany({
        where: { bankId: { in: bankIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return NextResponse.json({ questions });
    }

    return NextResponse.json({ questions: [] });
  } catch (error) {
    console.error("Questions GET API error:", error);
    return NextResponse.json({ error: "Error al cargar preguntas" }, { status: 500 });
  }
}

// POST: crear pregunta
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bankId, type, title, prompt, data, points, difficulty, tags } = body as {
      bankId?: string;
      type: string;
      title: string;
      prompt: string;
      data: string;
      points?: number;
      difficulty?: string;
      tags?: string;
    };

    if (!type || !title || !prompt || !data) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const question = await db.question.create({
      data: {
        bankId: bankId || null,
        type,
        title,
        prompt,
        data,
        points: points ?? 10,
        difficulty: difficulty ?? "medium",
        tags: tags || null,
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Questions POST API error:", error);
    return NextResponse.json({ error: "Error al crear pregunta" }, { status: 500 });
  }
}

// PATCH: actualizar pregunta
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { questionId, type, title, prompt, data, points, difficulty, tags } = body as {
      questionId: string;
      type?: string;
      title?: string;
      prompt?: string;
      data?: string;
      points?: number;
      difficulty?: string;
      tags?: string;
    };

    if (!questionId) {
      return NextResponse.json({ error: "Falta questionId" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (data !== undefined) updateData.data = data;
    if (points !== undefined) updateData.points = points;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (tags !== undefined) updateData.tags = tags;

    const question = await db.question.update({
      where: { id: questionId },
      data: updateData,
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Questions PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar pregunta" }, { status: 500 });
  }
}

// DELETE: eliminar pregunta
export async function DELETE(req: NextRequest) {
  try {
    const questionId = req.nextUrl.searchParams.get("questionId");
    if (!questionId) {
      return NextResponse.json({ error: "Falta questionId" }, { status: 400 });
    }

    await db.question.delete({ where: { id: questionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Questions DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar pregunta" }, { status: 500 });
  }
}
