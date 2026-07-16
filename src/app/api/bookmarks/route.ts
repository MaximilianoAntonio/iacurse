import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: listar bookmarks del usuario
export async function GET(req: NextRequest) {
  try {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ bookmarks: [] });
  }

  const bookmarks = await db.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      activity: {
        select: {
          id: true,
          title: true,
          type: true,
          difficulty: true,
          points: true,
          lesson: {
            select: {
              id: true,
              title: true,
              unit: { select: { id: true, title: true, color: true, icon: true, slug: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    bookmarks: bookmarks.map((b) => ({
      id: b.id,
      activityId: b.activityId,
      note: b.note,
      createdAt: b.createdAt.toISOString(),
      activity: b.activity,
    })),
  });
  } catch (error) {
    console.error("Bookmarks GET API error:", error);
    return NextResponse.json({ bookmarks: [] }, { status: 500 });
  }
}

// POST: crear bookmark
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, activityId, note } = body as {
    userId: string;
    activityId: string;
    note?: string;
  };

  if (!userId || !activityId) {
    return NextResponse.json({ error: "Faltan userId o activityId" }, { status: 400 });
  }

  try {
    const bookmark = await db.bookmark.create({
      data: { userId, activityId, note: note?.slice(0, 500) ?? null },
    });
    return NextResponse.json({ id: bookmark.id, ok: true });
  } catch {
    // Ya existe (unique constraint)
    return NextResponse.json({ ok: true, alreadyExists: true });
  }
}

// DELETE: eliminar bookmark
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const activityId = req.nextUrl.searchParams.get("activityId");

    if (!userId || !activityId) {
      return NextResponse.json({ error: "Faltan userId o activityId" }, { status: 400 });
    }

    await db.bookmark.deleteMany({
      where: { userId, activityId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Bookmarks DELETE API error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
