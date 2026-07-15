import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateActivityFeedback } from "@/lib/ai";
import { checkAndAwardBadges } from "@/lib/badges";
import type {
  MultipleChoiceData,
  GuidedProblemData,
  CaseAnalysisData,
  ProgressiveExerciseData,
  SelfAssessmentData,
} from "@/lib/types";
import { parseActivityData } from "@/lib/course-utils";

// POST: registra un intento de actividad con retroalimentación IA
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await params;
  const body = await req.json();
  const { userId, answer, timeSpent } = body as {
    userId: string;
    answer: string;
    timeSpent?: number;
  };

  if (!userId || !answer) {
    return NextResponse.json({ error: "Faltan userId o answer" }, { status: 400 });
  }

  const activity = await db.activity.findUnique({
    where: { id: activityId },
    include: { lesson: { include: { unit: true } } },
  });

  if (!activity) {
    return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
  }

  // Evaluar según el tipo de actividad
  let isCorrect = false;
  let correctAnswer = "";
  let score = 0;

  const context = `${activity.lesson.unit.title} — ${activity.lesson.title}`;

  switch (activity.type) {
    case "multiple_choice": {
      const data = parseActivityData<MultipleChoiceData>(activity.data);
      const selectedIdx = Number(answer);
      isCorrect = selectedIdx === data.correctIndex;
      correctAnswer = data.options[data.correctIndex] ?? "";
      score = isCorrect ? activity.points : Math.round(activity.points * 0.2);
      break;
    }
    case "guided_problem": {
      const data = parseActivityData<GuidedProblemData>(activity.data);
      // answer viene como JSON string con array de respuestas por paso
      let stepAnswers: string[] = [];
      try {
        stepAnswers = JSON.parse(answer) as string[];
      } catch {
        stepAnswers = [answer];
      }
      let correctSteps = 0;
      for (let i = 0; i < data.steps.length; i++) {
        const expected = data.steps[i].answer.toLowerCase().trim();
        const given = (stepAnswers[i] ?? "").toLowerCase().trim();
        if (expected && (given === expected || given.includes(expected) || expected.includes(given))) {
          correctSteps++;
        }
      }
      const ratio = data.steps.length > 0 ? correctSteps / data.steps.length : 0;
      isCorrect = ratio >= 0.8;
      correctAnswer = data.finalAnswer;
      score = Math.round(activity.points * (isCorrect ? 1 : ratio));
      break;
    }
    case "progressive_exercise": {
      const data = parseActivityData<ProgressiveExerciseData>(activity.data);
      let levelAnswers: string[] = [];
      try {
        levelAnswers = JSON.parse(answer) as string[];
      } catch {
        levelAnswers = [answer];
      }
      let correctLevels = 0;
      for (let i = 0; i < data.levels.length; i++) {
        const expected = data.levels[i].answer.toLowerCase().trim();
        const given = (levelAnswers[i] ?? "").toLowerCase().trim();
        if (expected && (given === expected || given.includes(expected) || expected.includes(given))) {
          correctLevels++;
        }
      }
      const ratio = data.levels.length > 0 ? correctLevels / data.levels.length : 0;
      isCorrect = ratio >= 0.8;
      correctAnswer = data.levels.map((l) => l.answer).join("; ");
      score = Math.round(activity.points * (isCorrect ? 1 : ratio));
      break;
    }
    case "case_analysis": {
      const data = parseActivityData<CaseAnalysisData>(activity.data);
      let caseAnswers: string[] = [];
      try {
        caseAnswers = JSON.parse(answer) as string[];
      } catch {
        caseAnswers = [answer];
      }
      let matched = 0;
      const matchedFlags: boolean[] = [];
      for (let i = 0; i < data.questions.length; i++) {
        const expected = data.questions[i].answer.toLowerCase().trim();
        const given = (caseAnswers[i] ?? "").toLowerCase().trim();
        const ok = expected && given.length > 3 && (
          given.includes(expected) ||
          expected.includes(given) ||
          expected.split(/[ ,]+/).some((w) => w.length > 3 && given.includes(w))
        );
        matchedFlags.push(ok);
        if (ok) matched++;
      }
      const ratio = data.questions.length > 0 ? matched / data.questions.length : 0;
      isCorrect = ratio >= 0.7;
      correctAnswer = data.questions.map((q) => q.answer).join("; ");
      score = Math.round(activity.points * (isCorrect ? 1 : Math.max(ratio, 0.3)));
      break;
    }
    case "self_assessment": {
      const data = parseActivityData<SelfAssessmentData>(activity.data);
      // answer es la reflexión del estudiante; auto-califica por palabras clave
      const lower = answer.toLowerCase();
      const matchedKw = data.autoGradeKeywords.filter((k) => lower.includes(k.toLowerCase()));
      const ratio = data.autoGradeKeywords.length > 0 ? matchedKw.length / data.autoGradeKeywords.length : 0.6;
      isCorrect = ratio >= 0.4 && answer.length > 40;
      correctAnswer = `Palabras clave esperadas: ${data.autoGradeKeywords.join(", ")}`;
      score = Math.round(activity.points * (isCorrect ? Math.max(ratio, 0.6) : 0.3));
      break;
    }
    default:
      isCorrect = answer.trim().length > 0;
      score = isCorrect ? activity.points : 0;
  }

  // Generar retroalimentación con IA
  const feedback = await generateActivityFeedback({
    activityType: activity.type,
    activityTitle: activity.title,
    prompt: activity.prompt,
    correctAnswer,
    studentAnswer: answer,
    isCorrect,
    context,
  });

  // Consultar SI HUBO un intento correcto previo ANTES de guardar el nuevo.
  // Esto determina si se otorgan puntos (solo la primera vez correcta).
  const hadPreviousCorrect = await db.attempt.findFirst({
    where: { userId, activityId, correct: true },
    select: { id: true, score: true },
  });

  // Guardar intento
  const attempt = await db.attempt.create({
    data: {
      userId,
      activityId,
      answer,
      feedback,
      score,
      correct: isCorrect,
      timeSpent: timeSpent ?? null,
    },
  });

  // Actualizar progreso de la unidad
  const unitId = activity.lesson.unitId;
  const existingProgress = await db.progress.findUnique({
    where: { userId_unitId: { userId, unitId } },
  });
  const totalActivities = await db.activity.count({
    where: { lesson: { unitId } },
  });
  // Contar actividades únicas con al menos un intento correcto
  const correctActivities = await db.attempt.findMany({
    where: { userId, correct: true, activity: { lesson: { unitId } } },
    select: { activityId: true },
    distinct: ["activityId"],
  });
  const completed = correctActivities.length;
  const mastery = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;

  if (existingProgress) {
    await db.progress.update({
      where: { id: existingProgress.id },
      data: { completed, total: totalActivities, mastery, lastVisited: new Date() },
    });
  } else {
    await db.progress.create({
      data: { userId, unitId, completed, total: totalActivities, mastery, lastVisited: new Date() },
    });
  }

  // Actualizar puntos del usuario (solo suma puntos si es mejor puntaje y no había correcto anterior)
  let pointsAwarded = 0;
  if (isCorrect && !hadPreviousCorrect) {
    // Primera vez correcta: otorga puntos
    pointsAwarded = score;
    await db.user.update({
      where: { id: userId },
      data: { points: { increment: pointsAwarded }, lastActive: new Date() },
    });
  } else if (!isCorrect && score > 0) {
    pointsAwarded = Math.max(0, score - (hadPreviousCorrect?.score ?? 0));
    if (pointsAwarded > 0) {
      await db.user.update({
        where: { id: userId },
        data: { points: { increment: pointsAwarded }, lastActive: new Date() },
      });
    }
  }

  // Actualizar racha diaria (si es la primera actividad del día, incrementar racha)
  // Simplificado: si lastActive fue ayer o antes, +1 racha; si es hoy, no cambia.
  const userRecord = await db.user.findUnique({ where: { id: userId }, select: { lastActive: true, streak: true } });
  let unitCompleted = false;
  let unitTitle = "";
  let unitColor = "";
  let unitIcon = "";
  if (userRecord) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActive = userRecord.lastActive ? new Date(userRecord.lastActive) : null;
    const lastDay = lastActive ? new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate()) : null;
    if (!lastDay || lastDay < today) {
      // Es un día nuevo: incrementar racha
      await db.user.update({
        where: { id: userId },
        data: { streak: { increment: 1 } },
      });
    }
  }

  // Verificar si la unidad se completó con este intento
  const correctActivitiesAfter = await db.attempt.findMany({
    where: { userId, correct: true, activity: { lesson: { unitId } } },
    select: { activityId: true },
    distinct: ["activityId"],
  });
  const totalActivitiesUnit = await db.activity.count({
    where: { lesson: { unitId } },
  });
  if (correctActivitiesAfter.length === totalActivitiesUnit && totalActivitiesUnit > 0 && isCorrect && !hadPreviousCorrect) {
    // La unidad se completó justo ahora (antes había N-1 correctas, ahora N)
    unitCompleted = true;
    const unitInfo = await db.unit.findUnique({ where: { id: unitId }, select: { title: true, color: true, icon: true } });
    unitTitle = unitInfo?.title ?? "";
    unitColor = unitInfo?.color ?? "emerald";
    unitIcon = unitInfo?.icon ?? "BookOpen";
  }

  // Evaluar y otorgar badges
  const newBadges = await checkAndAwardBadges(userId);

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      correct: isCorrect,
      score,
      feedback,
      correctAnswer,
      pointsAwarded,
      newBadges,
      unitCompleted,
      unitTitle,
      unitColor,
      unitIcon,
    },
  });
}
