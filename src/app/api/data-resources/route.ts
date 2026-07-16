import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar recursos de datos
export async function GET(req: NextRequest) {
  try {
    const authorId = req.nextUrl.searchParams.get("authorId");
    if (!authorId) {
      return NextResponse.json({ resources: [] });
    }

    const resources = await db.dataResource.findMany({
      where: { authorId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("DataResources GET API error:", error);
    return NextResponse.json({ error: "Error al cargar recursos" }, { status: 500 });
  }
}

// POST: crear recurso
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorId, name, type, content, tags } = body as {
      authorId: string;
      name: string;
      type: string;
      content: string;
      tags?: string;
    };

    if (!authorId || !name || !type || !content) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const resource = await db.dataResource.create({
      data: { authorId, name, type, content, tags: tags || null },
    });

    return NextResponse.json({ resource });
  } catch (error) {
    console.error("DataResources POST API error:", error);
    return NextResponse.json({ error: "Error al crear recurso" }, { status: 500 });
  }
}

// PATCH: actualizar recurso
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { resourceId, name, type, content, tags } = body as {
      resourceId: string;
      name?: string;
      type?: string;
      content?: string;
      tags?: string;
    };

    if (!resourceId) {
      return NextResponse.json({ error: "Falta resourceId" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (content !== undefined) data.content = content;
    if (tags !== undefined) data.tags = tags;

    const resource = await db.dataResource.update({ where: { id: resourceId }, data });
    return NextResponse.json({ resource });
  } catch (error) {
    console.error("DataResources PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar recurso" }, { status: 500 });
  }
}

// DELETE: eliminar recurso
export async function DELETE(req: NextRequest) {
  try {
    const resourceId = req.nextUrl.searchParams.get("resourceId");
    if (!resourceId) {
      return NextResponse.json({ error: "Falta resourceId" }, { status: 400 });
    }

    await db.dataResource.delete({ where: { id: resourceId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DataResources DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar recurso" }, { status: 500 });
  }
}
