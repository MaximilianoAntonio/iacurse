import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: detalle de un curso con unidades, lecciones y preguntas
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        units: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      course: {
        ...course,
        units: course.units.map((u) => ({
          ...u,
          lessons: u.lessons.map((l) => ({
            ...l,
            questionCount: l._count.questions,
            _count: undefined,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Course detail GET API error:", error);
    return NextResponse.json({ error: "Error al cargar curso" }, { status: 500 });
  }
}

// ============ UNITS ============

// POST: crear unidad en un curso
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const body = await req.json();
    const { title, summary, description, icon, color } = body as {
      title: string;
      summary?: string;
      description?: string;
      icon?: string;
      color?: string;
    };

    if (!title) {
      return NextResponse.json({ error: "Falta title" }, { status: 400 });
    }

    const unitCount = await db.courseUnit.count({ where: { courseId } });

    const unit = await db.courseUnit.create({
      data: {
        courseId,
        title,
        summary: summary || "",
        description: description || "",
        icon: icon || "BookOpen",
        color: color || "sky",
        order: unitCount,
      },
    });

    return NextResponse.json({ unit });
  } catch (error) {
    console.error("Course unit POST API error:", error);
    return NextResponse.json({ error: "Error al crear unidad" }, { status: 500 });
  }
}

// PATCH: actualizar curso o unidad
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: string };

    if (action === "updateUnit") {
      const { unitId, title, summary, description, icon, color } = body as {
        unitId: string;
        title?: string;
        summary?: string;
        description?: string;
        icon?: string;
        color?: string;
      };
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (summary !== undefined) data.summary = summary;
      if (description !== undefined) data.description = description;
      if (icon !== undefined) data.icon = icon;
      if (color !== undefined) data.color = color;
      const unit = await db.courseUnit.update({ where: { id: unitId }, data });
      return NextResponse.json({ unit });
    }

    if (action === "deleteUnit") {
      const { unitId } = body as { unitId: string };
      await db.courseUnit.delete({ where: { id: unitId } });
      return NextResponse.json({ ok: true });
    }

    if (action === "createLesson") {
      const { unitId, title, description, content, durationMin } = body as {
        unitId: string;
        title: string;
        description?: string;
        content?: string;
        durationMin?: number;
      };
      if (!unitId || !title) {
        return NextResponse.json({ error: "Faltan unitId o title" }, { status: 400 });
      }
      const lessonCount = await db.courseLesson.count({ where: { unitId } });
      const lesson = await db.courseLesson.create({
        data: {
          unitId,
          title,
          description: description || "",
          content: content || "",
          durationMin: durationMin ?? 15,
          order: lessonCount,
        },
      });
      return NextResponse.json({ lesson });
    }

    if (action === "updateLesson") {
      const { lessonId, title, description, content, durationMin } = body as {
        lessonId: string;
        title?: string;
        description?: string;
        content?: string;
        durationMin?: number;
      };
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (content !== undefined) data.content = content;
      if (durationMin !== undefined) data.durationMin = durationMin;
      const lesson = await db.courseLesson.update({ where: { id: lessonId }, data });
      return NextResponse.json({ lesson });
    }

    if (action === "deleteLesson") {
      const { lessonId } = body as { lessonId: string };
      await db.courseLesson.delete({ where: { id: lessonId } });
      return NextResponse.json({ ok: true });
    }

    if (action === "addQuestion") {
      const { lessonId, questionId } = body as { lessonId: string; questionId: string };
      // Vincular pregunta existente a la lección
      const question = await db.question.update({
        where: { id: questionId },
        data: { lessonId },
      });
      return NextResponse.json({ question });
    }

    if (action === "removeQuestion") {
      const { questionId } = body as { questionId: string };
      const question = await db.question.update({
        where: { id: questionId },
        data: { lessonId: null },
      });
      return NextResponse.json({ question });
    }

    if (action === "createQuestionInLesson") {
      const { lessonId, type, title, prompt, data: qData, points, difficulty } = body as {
        lessonId: string;
        type: string;
        title: string;
        prompt: string;
        data: string;
        points?: number;
        difficulty?: string;
      };
      if (!lessonId || !type || !title || !prompt || !qData) {
        return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
      }
      const question = await db.question.create({
        data: {
          lessonId,
          type,
          title,
          prompt,
          data: qData,
          points: points ?? 10,
          difficulty: difficulty ?? "medium",
        },
      });
      return NextResponse.json({ question });
    }

    // Default: update course
    const { title, description, color, icon, status, order } = body as {
      title?: string;
      description?: string;
      color?: string;
      icon?: string;
      status?: string;
      order?: number;
    };
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (color !== undefined) data.color = color;
    if (icon !== undefined) data.icon = icon;
    if (status !== undefined) data.status = status;
    if (order !== undefined) data.order = order;
    const course = await db.course.update({ where: { id }, data });
    return NextResponse.json({ course });
  } catch (error) {
    console.error("Course PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE: eliminar curso completo
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.course.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Course DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar curso" }, { status: 500 });
  }
}
