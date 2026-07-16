import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar bancos de preguntas del docente (con sus preguntas)
export async function GET(req: NextRequest) {
  try {
    const authorId = req.nextUrl.searchParams.get("authorId");
    if (!authorId) {
      return NextResponse.json({ error: "Falta authorId" }, { status: 400 });
    }

    const banks = await db.questionBank.findMany({
      where: { authorId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return NextResponse.json({
      banks: banks.map((b) => ({
        ...b,
        questionCount: b._count.questions,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("QuestionBanks GET API error:", error);
    return NextResponse.json({ error: "Error al cargar bancos" }, { status: 500 });
  }
}

// POST: crear banco de preguntas
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorId, name, description, category } = body as {
      authorId: string;
      name: string;
      description?: string;
      category?: string;
    };

    if (!authorId || !name) {
      return NextResponse.json({ error: "Faltan authorId o name" }, { status: 400 });
    }

    const bank = await db.questionBank.create({
      data: {
        authorId,
        name,
        description: description || null,
        category: category || "general",
      },
    });

    return NextResponse.json({ bank });
  } catch (error) {
    console.error("QuestionBanks POST API error:", error);
    return NextResponse.json({ error: "Error al crear banco" }, { status: 500 });
  }
}

// PATCH: actualizar banco
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { bankId, name, description, category } = body as {
      bankId: string;
      name?: string;
      description?: string;
      category?: string;
    };

    if (!bankId) {
      return NextResponse.json({ error: "Falta bankId" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;

    const bank = await db.questionBank.update({ where: { id: bankId }, data });
    return NextResponse.json({ bank });
  } catch (error) {
    console.error("QuestionBanks PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar banco" }, { status: 500 });
  }
}

// DELETE: eliminar banco
export async function DELETE(req: NextRequest) {
  try {
    const bankId = req.nextUrl.searchParams.get("bankId");
    if (!bankId) {
      return NextResponse.json({ error: "Falta bankId" }, { status: 400 });
    }

    await db.questionBank.delete({ where: { id: bankId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("QuestionBanks DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar banco" }, { status: 500 });
  }
}
