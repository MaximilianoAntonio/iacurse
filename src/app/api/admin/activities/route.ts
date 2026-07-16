import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST: crear nueva actividad en una lección (con metadatos de evaluación)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lessonId, type, title, prompt, data, points, difficulty,
      assessmentType, bloomLevel, maxAttempts, masteryThreshold, weight, timeLimitMin, rubricId,
      objectiveIds,
    } = body as {
      lessonId: string;
      type: string;
      title: string;
      prompt: string;
      data: string;
      points?: number;
      difficulty?: string;
      assessmentType?: string;
      bloomLevel?: string;
      maxAttempts?: number;
      masteryThreshold?: number;
      weight?: number;
      timeLimitMin?: number | null;
      rubricId?: string | null;
      objectiveIds?: string[];
    };

    if (!lessonId || !type || !title || !prompt) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const activityCount = await db.activity.count({ where: { lessonId } });

    const activity = await db.activity.create({
      data: {
        lessonId,
        type,
        title,
        prompt,
        data: data || "{}",
        points: points ?? 10,
        difficulty: difficulty ?? "medium",
        order: activityCount,
        assessmentType: assessmentType ?? "formative",
        bloomLevel: bloomLevel ?? "apply",
        maxAttempts: maxAttempts ?? 3,
        masteryThreshold: masteryThreshold ?? 70,
        weight: weight ?? 1,
        timeLimitMin: timeLimitMin ?? null,
        rubricId: rubricId ?? null,
      },
    });

    // Vincular objetivos de aprendizaje
    if (objectiveIds && objectiveIds.length > 0) {
      await db.activityObjective.createMany({
        data: objectiveIds.map((oid) => ({ activityId: activity.id, objectiveId: oid })),
        skipDuplicates: true,
      });
    }

    // Actualizar el total del progreso
    const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { unitId: true } });
    if (lesson) {
      const total = await db.activity.count({ where: { lesson: { unitId: lesson.unitId } } });
      await db.progress.updateMany({
        where: { unitId: lesson.unitId },
        data: { total },
      });
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Admin activities POST API error:", error);
    return NextResponse.json({ error: "Error al crear actividad" }, { status: 500 });
  }
}

// PATCH: actualizar actividad existente (incluye metadatos de evaluación + objetivos)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      activityId, type, title, prompt, data, points, difficulty, order,
      assessmentType, bloomLevel, maxAttempts, masteryThreshold, weight, timeLimitMin, rubricId,
      objectiveIds,
    } = body as {
      activityId: string;
      type?: string;
      title?: string;
      prompt?: string;
      data?: string;
      points?: number;
      difficulty?: string;
      order?: number;
      assessmentType?: string;
      bloomLevel?: string;
      maxAttempts?: number;
      masteryThreshold?: number;
      weight?: number;
      timeLimitMin?: number | null;
      rubricId?: string | null;
      objectiveIds?: string[];
    };

    if (!activityId) {
      return NextResponse.json({ error: "Falta activityId" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (data !== undefined) updateData.data = data;
    if (points !== undefined) updateData.points = points;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (order !== undefined) updateData.order = order;
    if (assessmentType !== undefined) updateData.assessmentType = assessmentType;
    if (bloomLevel !== undefined) updateData.bloomLevel = bloomLevel;
    if (maxAttempts !== undefined) updateData.maxAttempts = maxAttempts;
    if (masteryThreshold !== undefined) updateData.masteryThreshold = masteryThreshold;
    if (weight !== undefined) updateData.weight = weight;
    if (timeLimitMin !== undefined) updateData.timeLimitMin = timeLimitMin;
    if (rubricId !== undefined) updateData.rubricId = rubricId || null;

    const activity = await db.activity.update({ where: { id: activityId }, data: updateData });

    // Sincronizar objetivos de aprendizaje
    if (objectiveIds !== undefined) {
      await db.activityObjective.deleteMany({ where: { activityId } });
      if (objectiveIds.length > 0) {
        await db.activityObjective.createMany({
          data: objectiveIds.map((oid) => ({ activityId, objectiveId: oid })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Admin activities PATCH API error:", error);
    return NextResponse.json({ error: "Error al actualizar actividad" }, { status: 500 });
  }
}

// DELETE: eliminar actividad
export async function DELETE(req: NextRequest) {
  try {
    const activityId = req.nextUrl.searchParams.get("activityId");
    if (!activityId) {
      return NextResponse.json({ error: "Falta activityId" }, { status: 400 });
    }

    // Obtener lessonId/unitId antes de eliminar
    const activity = await db.activity.findUnique({
      where: { id: activityId },
      select: { lesson: { select: { unitId: true } } },
    });

    await db.activity.delete({ where: { id: activityId } });

    if (activity) {
      const total = await db.activity.count({ where: { lesson: { unitId: activity.lesson.unitId } } });
      await db.progress.updateMany({
        where: { unitId: activity.lesson.unitId },
        data: { total },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin activities DELETE API error:", error);
    return NextResponse.json({ error: "Error al eliminar actividad" }, { status: 500 });
  }
}
