"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { LoadingRows } from "@/components/app/loading";
import { Celebration } from "@/components/app/celebration";
import { BookmarkButton } from "@/components/app/bookmark-button";
import { useToast } from "@/hooks/use-toast";
import {
  getUnitColor,
  activityTypeMeta,
  difficultyMeta,
  parseActivityData,
  formatDuration,
} from "@/lib/course-utils";
import { cn } from "@/lib/utils";
import type {
  Activity,
  MultipleChoiceData,
  GuidedProblemData,
  CaseAnalysisData,
  ProgressiveExerciseData,
  SelfAssessmentData,
} from "@/lib/types";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Bot,
  Star,
  Info,
  Eye,
  EyeOff,
  BookOpen,
  Flag,
} from "lucide-react";

// ---------- types ----------

interface LessonResponse {
  lesson: {
    id: string;
    unitId: string;
    slug: string;
    title: string;
    description: string;
    content: string;
    durationMin: number;
    order: number;
    unit: {
      id: string;
      title: string;
      color: string;
      icon: string;
      slug: string;
    };
    activities: Activity[];
  };
  attemptsByActivity: Record<
    string,
    {
      completed: boolean;
      bestScore: number | null;
      attempts: number;
      lastAnswer?: string;
    }
  >;
}

interface BadgeAwardInfo {
  badgeSlug: string;
  badgeName: string;
  badgeIcon: string;
  badgeTier: string;
  newlyAwarded: boolean;
}

interface AttemptResult {
  attempt: {
    id: string;
    correct: boolean;
    score: number;
    feedback: string;
    correctAnswer: string;
    pointsAwarded: number;
    newBadges?: BadgeAwardInfo[];
    unitCompleted?: boolean;
    unitTitle?: string;
    unitColor?: string;
    unitIcon?: string;
  };
}

interface ActivityComponentProps {
  activity: Activity;
  submitted: boolean;
  submitting: boolean;
  onSubmit: (answer: string) => void;
  onHintUsed?: () => void;
}

// ---------- helpers ----------

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Aproxima la lógica del servidor para resaltar respuestas correctas/incorrectas en UI. */
function isAnswerClose(expected: string, given: string): boolean {
  const e = normalize(expected);
  const g = normalize(given);
  if (!e || !g) return false;
  if (g === e) return true;
  if (g.includes(e) || e.includes(g)) return true;
  return e
    .split(/[ ,]+/)
    .some((w) => w.length > 3 && g.includes(w));
}

// ---------- main view ----------

export function ActivityView() {
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);
  const openLesson = useAppStore((s) => s.openLesson);
  const openActivity = useAppStore((s) => s.openActivity);
  const currentLessonId = useAppStore((s) => s.currentLessonId);
  const currentActivityId = useAppStore((s) => s.currentActivityId);

  const url = currentLessonId ? `/api/lessons/${currentLessonId}` : null;

  const { data, loading, error } = useFetch<LessonResponse>(url, [
    currentLessonId,
  ]);

  // Actualizar el título del documento con el nombre de la actividad
  useEffect(() => {
    if (data?.lesson && currentActivityId) {
      const act = data.lesson.activities.find((a) => a.id === currentActivityId);
      if (act) {
        document.title = `${act.title} · ElectroMed IA`;
      }
    }
  }, [data?.lesson?.id, currentActivityId]);

  // ----- fallback / loading states -----

  if (!currentActivityId) {
    return (
      <EmptyState
        title="No hay actividad seleccionada"
        description="Elige una actividad desde una lección para comenzar a practicar."
        onBack={() => navigate("units")}
      />
    );
  }

  if (!currentLessonId) {
    return (
      <EmptyState
        title="No se pudo ubicar la lección"
        description="Vuelve al listado de unidades para continuar tu aprendizaje."
        onBack={() => navigate("units")}
      />
    );
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
        <PageHeader title="Cargando actividad..." />
        <LoadingRows count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Error al cargar la actividad"
        description={error}
        onBack={() => navigate("units")}
      />
    );
  }

  const { lesson } = data;
  const activityIndex = lesson.activities.findIndex(
    (a) => a.id === currentActivityId
  );

  if (activityIndex === -1) {
    return (
      <EmptyState
        title="Actividad no encontrada"
        description="Esta actividad no pertenece a la lección actual."
        onBack={() => openLesson(lesson.id)}
      />
    );
  }

  const activity = lesson.activities[activityIndex];
  const prevActivity =
    activityIndex > 0 ? lesson.activities[activityIndex - 1] : null;
  const nextActivity =
    activityIndex < lesson.activities.length - 1
      ? lesson.activities[activityIndex + 1]
      : null;
  const isLast = activityIndex === lesson.activities.length - 1;

  const unitColor = getUnitColor(lesson.unit.color);
  const typeMeta = activityTypeMeta[activity.type];
  const diffMeta = difficultyMeta[activity.difficulty];
  const attemptCount = data.attemptsByActivity[activity.id]?.attempts ?? 0;

  return (
    <ActivityInner
      key={activity.id}
      activity={activity}
      lesson={lesson}
      unitColor={unitColor}
      typeMeta={typeMeta}
      diffMeta={diffMeta}
      prevActivity={prevActivity}
      nextActivity={nextActivity}
      isLast={isLast}
      activityIndex={activityIndex}
      activityTotal={lesson.activities.length}
      attemptCount={attemptCount}
      onNavigateUnits={() => navigate("units")}
      onOpenUnit={() => openUnit(lesson.unitId)}
      onOpenLesson={() => openLesson(lesson.id)}
      onOpenActivity={(id) => openActivity(id)}
    />
  );
}

// ---------- inner (stateful) ----------

interface ActivityInnerProps {
  activity: Activity;
  lesson: LessonResponse["lesson"];
  unitColor: ReturnType<typeof getUnitColor>;
  typeMeta: { label: string; icon: string; color: string };
  diffMeta: { label: string; color: string; bg: string };
  prevActivity: Activity | null;
  nextActivity: Activity | null;
  isLast: boolean;
  activityIndex: number;
  activityTotal: number;
  attemptCount: number;
  onNavigateUnits: () => void;
  onOpenUnit: () => void;
  onOpenLesson: () => void;
  onOpenActivity: (id: string) => void;
}

function ActivityInner(props: ActivityInnerProps) {
  const {
    activity,
    lesson,
    unitColor,
    typeMeta,
    diffMeta,
    prevActivity,
    nextActivity,
    isLast,
    activityIndex,
    activityTotal,
    attemptCount,
    onNavigateUnits,
    onOpenUnit,
    onOpenLesson,
    onOpenActivity,
  } = props;

  const { toast } = useToast();

  const MAX_ATTEMPTS = 3;
  const totalAttempts = attemptCount; // from API (previous attempts)

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult["attempt"] | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [badgeCelebration, setBadgeCelebration] = useState<BadgeAwardInfo | null>(null);
  const [unitCelebration, setUnitCelebration] = useState<{ title: string; color: string; icon: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("incorrect");
  const [reportComment, setReportComment] = useState("");
  const [reported, setReported] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState(0); // attempts in this session
  const [hintsUsed, setHintsUsed] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  const currentAttemptNumber = totalAttempts + sessionAttempts;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - currentAttemptNumber);
  const maxReached = currentAttemptNumber >= MAX_ATTEMPTS;

  // Timer: arranca al montar / cambiar de actividad; se congela al enviar.
  useEffect(() => {
    if (submitted) return;
    startTimeRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activity.id, submitted]);

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (submitting) return;
      setSubmitting(true);
      const timeSpent = Math.max(
        1,
        Math.floor((Date.now() - startTimeRef.current) / 1000)
      );
      try {
        const res = await postJSON<AttemptResult>(
          `/api/activities/${activity.id}/attempt`,
          { answer, timeSpent, hintsUsed }
        );
        setResult(res.attempt);
        setSubmitted(true);
        setSessionAttempts((n) => n + 1);
        // Disparar celebración si fue correcta y ganó puntos (primera vez)
        if (res.attempt.correct && res.attempt.pointsAwarded > 0) {
          setCelebrating(true);
        }
        // Disparar celebración de unidad completada (tiene prioridad sobre badge)
        if (res.attempt.unitCompleted && res.attempt.unitTitle) {
          setTimeout(() => {
            setUnitCelebration({
              title: res.attempt.unitTitle!,
              color: res.attempt.unitColor ?? "emerald",
              icon: res.attempt.unitIcon ?? "BookOpen",
            });
          }, 7000); // después de que cierre la celebración de actividad
        }
        // Disparar celebración de badge desbloqueado
        if (res.attempt.newBadges && res.attempt.newBadges.length > 0) {
          const delay = res.attempt.unitCompleted ? 14000 : 7000;
          setTimeout(() => {
            setBadgeCelebration(res.attempt.newBadges![0]);
          }, delay);
        }
        toast({
          title: res.attempt.correct
            ? "¡Bien hecho!"
            : "Respuesta registrada",
          description: res.attempt.feedback,
        });
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Error al enviar la respuesta";
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [activity.id, submitting, toast]
  );

  const handleRetry = useCallback(() => {
    setResult(null);
    setSubmitted(false);
    setSubmitting(false);
    setResetKey((k) => k + 1);
    setReported(false);
    setReportComment("");
    setReportReason("incorrect");
    setBadgeCelebration(null);
    setUnitCelebration(null);
    setHintsUsed(0);
  }, []);

  const handleNext = useCallback(() => {
    if (nextActivity) onOpenActivity(nextActivity.id);
    else onOpenLesson();
  }, [nextActivity, onOpenActivity, onOpenLesson]);

  const submitReport = useCallback(async () => {
    try {
      await postJSON("/api/report", {
        source: "activity",
        sourceId: activity.id,
        reason: reportReason,
        comment: reportComment || undefined,
      });
      setReported(true);
      setReportOpen(false);
      setReportComment("");
      toast({
        title: "Reporte enviado",
        description: "El equipo docente revisará esta retroalimentación. ¡Gracias!",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al enviar el reporte";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  }, [activity.id, reportReason, reportComment, toast]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      <Celebration
        trigger={celebrating}
        title="¡Actividad completada!"
        description={activity.title}
        points={result?.pointsAwarded}
        onClose={() => setCelebrating(false)}
        accentGradient={unitColor.gradient}
      />
      <Celebration
        trigger={Boolean(unitCelebration)}
        title="¡Unidad completada!"
        description={unitCelebration ? `Has dominado "${unitCelebration.title}"` : ""}
        onClose={() => setUnitCelebration(null)}
        accentGradient={unitCelebration ? `from-${unitCelebration.color}-400 via-${unitCelebration.color}-500 to-${unitCelebration.color}-600` : "from-amber-400 to-amber-600"}
      />
      <Celebration
        trigger={Boolean(badgeCelebration)}
        title={badgeCelebration ? `¡Badge desbloqueado!` : ""}
        description={badgeCelebration ? badgeCelebration.badgeName : ""}
        onClose={() => setBadgeCelebration(null)}
        accentGradient={
          badgeCelebration?.badgeTier === "gold"
            ? "from-yellow-400 via-amber-500 to-orange-500"
            : badgeCelebration?.badgeTier === "silver"
            ? "from-slate-300 via-slate-400 to-slate-500"
            : "from-amber-600 via-orange-700 to-rose-700"
        }
      />
      <PageHeader
        title={activity.title}
        icon={typeMeta.icon}
        iconGradient={unitColor.gradient}
        breadcrumb={[
          { label: "Unidades", onClick: onNavigateUnits },
          { label: lesson.unit.title, onClick: onOpenUnit },
          { label: lesson.title, onClick: onOpenLesson },
          { label: activity.title },
        ]}
      />

      {/* Tarjeta de actividad */}
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className={cn("gap-1 border-transparent", typeMeta.color)}
              >
                <DynamicIcon name={typeMeta.icon} className="h-3 w-3" />
                {typeMeta.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1 border-transparent", diffMeta.color, diffMeta.bg)}
              >
                <DynamicIcon name="Target" className="h-3 w-3" />
                {diffMeta.label}
              </Badge>
              <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
                <Sparkles className="h-3 w-3" />
                {activity.points} pts
              </Badge>
              {/* Badges de evaluación pedagógica */}
              {(activity as any).assessmentType && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 border-transparent capitalize",
                    (activity as any).assessmentType === "diagnostic" && "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                    (activity as any).assessmentType === "formative" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                    (activity as any).assessmentType === "summative" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                    (activity as any).assessmentType === "self_reflection" && "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                  )}
                  title="Tipo de evaluación"
                >
                  <DynamicIcon name="Award" className="h-3 w-3" />
                  {{ diagnostic: "Diagnóstica", formative: "Formativa", summative: "Sumativa", self_reflection: "Auto-reflexión" }[(activity as any).assessmentType] ?? (activity as any).assessmentType}
                </Badge>
              )}
              {(activity as any).bloomLevel && (
                <Badge variant="outline" className="gap-1 border-transparent capitalize text-xs" title="Nivel cognitivo de Bloom">
                  <DynamicIcon name="GraduationCap" className="h-3 w-3" />
                  {{ remember: "Recordar", understand: "Comprender", apply: "Aplicar", analyze: "Analizar", evaluate: "Evaluar", create: "Crear" }[(activity as any).bloomLevel] ?? (activity as any).bloomLevel}
                </Badge>
              )}
              {(activity as any).maxAttempts !== undefined && (activity as any).maxAttempts > 0 && (
                <Badge variant="outline" className="gap-1 border-transparent text-xs" title="Intentos permitidos">
                  <DynamicIcon name="RotateCcw" className="h-3 w-3" />
                  {attemptCount}/{(activity as any).maxAttempts} intentos
                </Badge>
              )}
              {(activity as any).masteryThreshold !== undefined && (activity as any).masteryThreshold > 0 && (activity as any).masteryThreshold < 100 && (
                <Badge variant="outline" className="gap-1 border-transparent text-xs" title="Umbral de aprobación">
                  <DynamicIcon name="Gauge" className="h-3 w-3" />
                  Aprobar: {(activity as any).masteryThreshold}%
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <BookmarkButton activityId={activity.id} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-default items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(elapsed)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Tiempo en esta actividad</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Prompt general */}
          {activity.prompt && (
            <p className="text-base font-medium leading-relaxed">
              {activity.prompt}
            </p>
          )}

          <ActivityRenderer
            key={resetKey}
            activity={activity}
            submitted={submitted}
            submitting={submitting}
            onSubmit={handleSubmit}
            onHintUsed={() => setHintsUsed((n) => n + 1)}
          />
        </CardContent>
      </Card>

      {/* Panel de resultados (post-envío) */}
      {submitted && result && (
        <ResultPanel
          result={result}
          unitColor={unitColor}
          isLast={isLast}
          onRetry={handleRetry}
          onNext={handleNext}
          reportOpen={reportOpen}
          reportReason={reportReason}
          reportComment={reportComment}
          reported={reported}
          onSetReportOpen={setReportOpen}
          onSetReportReason={setReportReason}
          onSetReportComment={setReportComment}
          onSubmitReport={submitReport}
          attemptNumber={currentAttemptNumber}
          maxAttempts={MAX_ATTEMPTS}
          attemptsLeft={attemptsLeft}
          maxReached={maxReached}
        />
      )}

      {/* Navegación entre actividades */}
      <ActivityNavFooter
        activityIndex={activityIndex}
        activityTotal={activityTotal}
        prevActivity={prevActivity}
        nextActivity={nextActivity}
        onOpenActivity={onOpenActivity}
        onOpenLesson={onOpenLesson}
      />
    </div>
  );
}

// ---------- renderer dispatch ----------

function ActivityRenderer(props: ActivityComponentProps) {
  switch (props.activity.type) {
    case "multiple_choice":
      return <MultipleChoiceActivity {...props} />;
    case "guided_problem":
      return <GuidedProblemActivity {...props} />;
    case "case_analysis":
      return <CaseAnalysisActivity {...props} />;
    case "progressive_exercise":
      return <ProgressiveExerciseActivity {...props} />;
    case "self_assessment":
      return <SelfAssessmentActivity {...props} />;
    default:
      return null;
  }
}

// ---------- multiple choice ----------

function MultipleChoiceActivity({
  activity,
  submitted,
  submitting,
  onSubmit,
  onHintUsed,
}: ActivityComponentProps) {
  const data = useMemo(
    () => parseActivityData<MultipleChoiceData>(activity.data),
    [activity.data]
  );
  const options = data.options ?? [];
  const hints = (data.hints ?? []).slice(0, 2); // Máximo 2 pistas
  const MAX_HINTS = 2;

  const [selected, setSelected] = useState<number | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const canSubmit = selected !== null && !submitting;

  const handleSubmit = () => {
    if (selected === null) return;
    onSubmit(String(selected));
  };

  return (
    <div className="space-y-5">
      {data.question && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm leading-relaxed">{data.question}</p>
        </div>
      )}

      <RadioGroup
        value={selected === null ? "" : String(selected)}
        onValueChange={(v) => {
          if (!submitted) setSelected(Number(v));
        }}
        className="gap-2"
      >
        {options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === data.correctIndex;
          return (
            <Label
              key={i}
              htmlFor={`opt-${i}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-all",
                "hover:border-primary/40 hover:bg-accent/40",
                !submitted &&
                  isSelected &&
                  "border-primary bg-accent/60 ring-1 ring-primary/30",
                submitted &&
                  isCorrect &&
                  "border-amber-400 bg-[#003366]/5 dark:border-amber-700 dark:bg-[#003366]/20/40",
                submitted &&
                  isSelected &&
                  !isCorrect &&
                  "border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40",
                submitted &&
                  !isCorrect &&
                  !isSelected &&
                  "border-border opacity-70"
              )}
            >
              <RadioGroupItem
                value={String(i)}
                id={`opt-${i}`}
                className="mt-0.5"
                disabled={submitted}
              />
              <span className="flex-1 leading-relaxed">{opt}</span>
              {submitted && isCorrect && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#003366]" />
              )}
              {submitted && isSelected && !isCorrect && (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
            </Label>
          );
        })}
      </RadioGroup>

      {/* Pistas */}
      {hints.length > 0 && !submitted && (
        <div className="space-y-2">
          {showHint && hints[hintIndex] ? (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-300">
                Pista {hintIndex + 1} de {hints.length}
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-300/90">
                {hints[hintIndex]}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {!showHint ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setShowHint(true); onHintUsed?.(); }}
                className="text-amber-700 dark:text-amber-300"
              >
                <Lightbulb className="mr-1.5 h-4 w-4" /> Ver pista
                <span className="ml-1 text-xs text-muted-foreground">(0/{MAX_HINTS})</span>
              </Button>
            ) : (
              hintIndex < hints.length - 1 && hintIndex < MAX_HINTS - 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setHintIndex((i) => i + 1); onHintUsed?.(); }}
                >
                  <Lightbulb className="mr-1.5 h-4 w-4" /> Otra pista
                  <span className="ml-1 text-xs text-muted-foreground">({hintIndex + 1}/{MAX_HINTS})</span>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sin más pistas ({Math.min(hintIndex + 1, MAX_HINTS)}/{MAX_HINTS} usadas)
                </span>
              )
            )}
          </div>
        </div>
      )}

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar respuesta"}
        </Button>
      )}

      {submitted && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Explicación</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {data.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- guided problem ----------

function GuidedProblemActivity({
  activity,
  submitted,
  submitting,
  onSubmit,
  onHintUsed,
}: ActivityComponentProps) {
  const data = useMemo(
    () => parseActivityData<GuidedProblemData>(activity.data),
    [activity.data]
  );
  const steps = data.steps ?? [];

  const [answers, setAnswers] = useState<string[]>(() =>
    steps.map(() => "")
  );
  const [revealedHints, setRevealedHints] = useState<Set<number>>(
    new Set()
  );
  const GP_MAX_HINTS = 2; // Máximo 2 pistas de paso en problemas guiados

  const allFilled = answers.every((a) => a.trim().length > 0);
  const canSubmit = allFilled && !submitting;
  const hintsUsedCount = revealedHints.size;
  const hintsLeft = GP_MAX_HINTS - hintsUsedCount;

  const handleSubmit = () => {
    if (!allFilled) return;
    onSubmit(JSON.stringify(answers));
  };

  const toggleHint = (i: number) => {
    setRevealedHints((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        // Solo permitir revelar si no se ha alcanzado el límite
        if (next.size >= GP_MAX_HINTS) return prev;
        next.add(i);
        onHintUsed?.();
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {data.scenario && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Escenario
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {data.scenario}
          </p>
        </div>
      )}

      <ol className="space-y-4">
        {steps.map((step, i) => {
          const given = answers[i] ?? "";
          const correct = submitted && isAnswerClose(step.answer, given);
          const wrong =
            submitted && !correct && given.trim().length > 0;
          return (
            <li key={i} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="flex-1 text-sm leading-relaxed">{step.prompt}</p>
                {submitted && correct && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#003366]" />
                )}
                {submitted && wrong && (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                )}
              </div>
              <div className="pl-8">
                <Input
                  value={given}
                  onChange={(e) =>
                    !submitted &&
                    setAnswers((prev) =>
                      prev.map((a, j) => (j === i ? e.target.value : a))
                    )
                  }
                  placeholder="Tu respuesta..."
                  disabled={submitted}
                  className={cn(
                    submitted &&
                      correct &&
                      "border-amber-400 bg-[#003366]/5 dark:border-amber-700 dark:bg-[#003366]/20/30",
                    submitted &&
                      wrong &&
                      "border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"
                  )}
                />
                {!submitted && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHint(i)}
                      disabled={!revealedHints.has(i) && hintsLeft <= 0}
                      className="h-7 px-2 text-xs text-amber-700 dark:text-amber-300 disabled:opacity-40"
                    >
                      {revealedHints.has(i) ? (
                        <>
                          <EyeOff className="mr-1 h-3 w-3" /> Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1 h-3 w-3" /> Ver pista
                        </>
                      )}
                    </Button>
                    {hintsLeft <= 0 && !revealedHints.has(i) && (
                      <span className="text-xs text-muted-foreground">({hintsUsedCount}/{GP_MAX_HINTS} usadas)</span>
                    )}
                    {revealedHints.has(i) && (
                      <p className="rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        {step.hint}
                      </p>
                    )}
                  </div>
                )}
                {submitted && revealedHints.has(i) && (
                  <p className="mt-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    {step.hint}
                  </p>
                )}
                {submitted && (
                  <div
                    className={cn(
                      "mt-1.5 rounded-md px-2.5 py-1.5 text-xs",
                      correct
                        ? "bg-[#003366]/5 text-[#003366] dark:bg-[#003366]/20/30 dark:text-amber-400"
                        : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                    )}
                  >
                    <span className="font-medium">
                      {correct ? "Correcto" : "Respuesta esperada"}:
                    </span>{" "}
                    {step.answer}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar respuestas"}
        </Button>
      )}

      {submitted && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Respuesta final</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {data.finalAnswer}
          </p>
          <Separator className="my-3" />
          <p className="font-medium">Explicación</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {data.explanation}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- case analysis ----------

function CaseAnalysisActivity({
  activity,
  submitted,
  submitting,
  onSubmit,
}: ActivityComponentProps) {
  const data = useMemo(
    () => parseActivityData<CaseAnalysisData>(activity.data),
    [activity.data]
  );
  const questions = data.questions ?? [];

  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => "")
  );

  const minChars = 10;
  const allFilled = answers.every((a) => a.trim().length >= minChars);
  const canSubmit = allFilled && !submitting;

  const handleSubmit = () => {
    if (!allFilled) return;
    onSubmit(JSON.stringify(answers));
  };

  return (
    <div className="space-y-5">
      {data.case && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Caso clínico
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {data.case}
          </p>
        </div>
      )}

      <ol className="space-y-5">
        {questions.map((q, i) => {
          const given = answers[i] ?? "";
          const matched = submitted && isAnswerClose(q.answer, given);
          return (
            <li key={i} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <p className="flex-1 text-sm font-medium leading-relaxed">
                  {q.prompt}
                </p>
                {submitted && matched && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#003366]" />
                )}
              </div>
              <div className="space-y-2 pl-8">
                <Textarea
                  value={given}
                  onChange={(e) =>
                    !submitted &&
                    setAnswers((prev) =>
                      prev.map((a, j) => (j === i ? e.target.value : a))
                    )
                  }
                  placeholder="Escribe tu análisis..."
                  disabled={submitted}
                  rows={3}
                  className={cn(
                    submitted &&
                      matched &&
                      "border-amber-400 bg-[#003366]/5/50 dark:border-amber-700 dark:bg-[#003366]/20/20"
                  )}
                />
                {!submitted &&
                  given.trim().length > 0 &&
                  given.trim().length < minChars && (
                    <p className="text-xs text-muted-foreground">
                      {minChars - given.trim().length} caracteres más como mínimo
                    </p>
                  )}
                {submitted && (
                  <div
                    className={cn(
                      "rounded-md p-3 text-xs",
                      matched
                        ? "bg-[#003366]/5 text-[#003366] dark:bg-[#003366]/20/30 dark:text-amber-200"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1.5 font-medium">
                      {matched ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#003366]" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      Respuesta esperada
                    </div>
                    <p className="leading-relaxed">{q.answer}</p>
                    {q.explanation && (
                      <p className="mt-2 border-t border-current/10 pt-2 italic opacity-90">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar análisis"}
        </Button>
      )}
    </div>
  );
}

// ---------- progressive exercise ----------

const progressiveGradients = [
  "from-[#003366] to-[#0066AA]",
  "from-[#004488] to-[#0066AA]",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-amber-400 to-amber-600",
];

function ProgressiveExerciseActivity({
  activity,
  submitted,
  submitting,
  onSubmit,
}: ActivityComponentProps) {
  const data = useMemo(
    () => parseActivityData<ProgressiveExerciseData>(activity.data),
    [activity.data]
  );
  const levels = data.levels ?? [];

  const [answers, setAnswers] = useState<string[]>(() =>
    levels.map(() => "")
  );

  const allFilled = answers.every((a) => a.trim().length > 0);
  const canSubmit = allFilled && !submitting;

  const handleSubmit = () => {
    if (!allFilled) return;
    onSubmit(JSON.stringify(answers));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Resuelve cada nivel. La dificultad aumenta progresivamente.
      </p>
      <ol className="space-y-4">
        {levels.map((level, i) => {
          const given = answers[i] ?? "";
          const correct = submitted && isAnswerClose(level.answer, given);
          const wrong =
            submitted && !correct && given.trim().length > 0;
          const gradient =
            progressiveGradients[i % progressiveGradients.length];
          return (
            <li
              key={i}
              className="space-y-2 rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white",
                    gradient
                  )}
                >
                  N{i + 1}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nivel {i + 1}
                </span>
                {submitted && correct && (
                  <CheckCircle2 className="h-4 w-4 text-[#003366]" />
                )}
                {submitted && wrong && (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <p className="text-sm leading-relaxed">{level.prompt}</p>
              <Input
                value={given}
                onChange={(e) =>
                  !submitted &&
                  setAnswers((prev) =>
                    prev.map((a, j) => (j === i ? e.target.value : a))
                  )
                }
                placeholder="Tu respuesta..."
                disabled={submitted}
                className={cn(
                  submitted &&
                    correct &&
                    "border-amber-400 bg-[#003366]/5 dark:border-amber-700 dark:bg-[#003366]/20/30",
                  submitted &&
                    wrong &&
                    "border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"
                )}
              />
              {submitted && (
                <div
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs",
                    correct
                      ? "bg-[#003366]/5 text-[#003366] dark:bg-[#003366]/20/30 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="font-medium">
                    {correct ? "Correcto" : "Respuesta esperada"}:
                  </span>{" "}
                  {level.answer}
                  {level.explanation && (
                    <p className="mt-1 italic opacity-90">
                      {level.explanation}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar respuestas"}
        </Button>
      )}
    </div>
  );
}

// ---------- self assessment ----------

function SelfAssessmentActivity({
  activity,
  submitted,
  submitting,
  onSubmit,
}: ActivityComponentProps) {
  const data = useMemo(
    () => parseActivityData<SelfAssessmentData>(activity.data),
    [activity.data]
  );
  const rubric = data.rubric ?? [];
  const keywords = data.autoGradeKeywords ?? [];

  const [reflection, setReflection] = useState("");
  const [confidence, setConfidence] = useState(3);

  const minChars = 40;
  const canSubmit = reflection.trim().length >= minChars && !submitting;

  const matchedKeywords = useMemo(() => {
    const lower = reflection.toLowerCase();
    return keywords.map((k) => ({
      keyword: k,
      present: lower.includes(k.toLowerCase()),
    }));
  }, [reflection, keywords]);

  const handleSubmit = () => {
    if (reflection.trim().length < minChars) return;
    onSubmit(reflection);
  };

  return (
    <div className="space-y-5">
      {data.prompt && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Reflexión
          </p>
          <p className="mt-1 text-sm leading-relaxed">{data.prompt}</p>
        </div>
      )}

      {/* Rúbrica */}
      {rubric.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Rúbrica de autoevaluación
          </p>
          <ul className="mt-2 space-y-1.5">
            {rubric.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selector de confianza */}
      <div>
        <p className="mb-2 text-sm font-medium">
          ¿Qué tan seguro te sientes con este tema?
        </p>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => !submitted && setConfidence(n)}
              disabled={submitted}
              aria-label={`Confianza ${n} de 5`}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border transition-all",
                n <= confidence
                  ? "border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-border bg-background text-muted-foreground hover:border-amber-300",
                submitted && "cursor-not-allowed opacity-80"
              )}
            >
              <Star
                className={cn("h-4 w-4", n <= confidence && "fill-current")}
              />
            </button>
          ))}
          <span className="ml-2 text-sm font-medium">{confidence}/5</span>
        </div>
      </div>

      {/* Textarea de reflexión */}
      <div className="space-y-2">
        <Textarea
          value={reflection}
          onChange={(e) => !submitted && setReflection(e.target.value)}
          placeholder="Escribe tu reflexión: qué entendiste, qué dudas te quedan, cómo lo aplicarías en práctica clínica..."
          rows={5}
          disabled={submitted}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Tu reflexión se evalúa por la presencia de conceptos clave
          </span>
          <span
            className={
              reflection.trim().length >= minChars ? "text-[#003366]" : ""
            }
          >
            {reflection.trim().length}/{minChars} mín.
          </span>
        </div>
      </div>

      {!submitted && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar reflexión"}
        </Button>
      )}

      {submitted && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-amber-600" /> Conceptos clave
            detectados
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {matchedKeywords.map(({ keyword, present }) => (
              <Badge
                key={keyword}
                variant={present ? "default" : "outline"}
                className={cn(
                  present
                    ? "bg-[#003366]/10 text-[#003366] hover:bg-[#003366]/10 dark:bg-[#003366]/20 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                {present && <CheckCircle2 className="mr-1 h-3 w-3" />}
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- result panel ----------

interface ResultPanelProps {
  result: AttemptResult["attempt"];
  unitColor: ReturnType<typeof getUnitColor>;
  isLast: boolean;
  onRetry: () => void;
  onNext: () => void;
  reportOpen: boolean;
  reportReason: string;
  reportComment: string;
  reported: boolean;
  onSetReportOpen: (open: boolean) => void;
  onSetReportReason: (reason: string) => void;
  onSetReportComment: (comment: string) => void;
  onSubmitReport: () => void;
  attemptNumber: number;
  maxAttempts: number;
  attemptsLeft: number;
  maxReached: boolean;
}

function ResultPanel({
  result,
  unitColor,
  isLast,
  onRetry,
  onNext,
  reportOpen,
  reportReason,
  reportComment,
  reported,
  onSetReportOpen,
  onSetReportReason,
  onSetReportComment,
  onSubmitReport,
  attemptNumber,
  maxAttempts,
  attemptsLeft,
  maxReached,
}: ResultPanelProps) {
  const correct = result.correct;
  const reportReasons = [
    { value: "incorrect", label: "Retroalimentación incorrecta" },
    { value: "biased", label: "Contenido sesgado" },
    { value: "offtopic", label: "Fuera de tema" },
    { value: "harmful", label: "Contenido inapropiado" },
    { value: "other", label: "Otro" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "overflow-hidden border-2",
          correct
            ? "border-amber-300 dark:border-[#003366]/30"
            : "border-amber-300 dark:border-amber-800"
        )}
      >
        <CardHeader
          className={cn(
            "pb-4",
            correct
              ? "bg-[#003366]/5 dark:bg-[#003366]/20/30"
              : "bg-amber-50 dark:bg-amber-950/30"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                correct ? "bg-[#003366]" : "bg-amber-600"
              )}
            >
              {correct ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">
                {correct ? "¡Correcto!" : "Sigue intentando"}
              </CardTitle>
              <CardDescription className="mt-0.5 text-sm">
                {correct
                  ? "Has demostrado dominio de este concepto."
                  : "Revisa la retroalimentación y vuelve a intentarlo."}
              </CardDescription>
            </div>
            {result.pointsAwarded > 0 && (
              <Badge
                className={cn(
                  "gap-1 border-transparent text-sm",
                  unitColor.bgSoft,
                  unitColor.text
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />+{result.pointsAwarded} puntos
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Retroalimentación IA */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <Bot className="h-3.5 w-3.5" /> Retroalimentación del tutor IA
              </div>
              <button
                onClick={() => onSetReportOpen(true)}
                disabled={reported}
                className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-rose-500 disabled:cursor-default disabled:opacity-100"
                title="Reportar esta retroalimentación"
              >
                {reported ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-[#003366]" />
                    <span className="text-[#003366] dark:text-amber-400">Reportado</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-3 w-3" />
                    <span className="hidden sm:inline">Reportar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {result.feedback}
            </p>
          </div>

          {/* Puntaje */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Puntaje:</span>
              <span className="font-bold">{result.score}</span>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {correct ? "Aprobado" : "Sin aprobar"}
            </div>
          </div>

          {/* Respuesta correcta */}
          {result.correctAnswer && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Respuesta correcta
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                {result.correctAnswer}
              </p>
            </div>
          )}

          {/* Indicador de intentos */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Intentos:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: maxAttempts }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      i < attemptNumber
                        ? result.correct
                          ? "bg-[#003366]"
                          : "bg-amber-500"
                        : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              <span className="ml-1 font-medium tabular-nums">
                {attemptNumber}/{maxAttempts}
              </span>
            </div>
            {!correct && attemptsLeft > 0 && (
              <span className="text-xs text-muted-foreground">
                {attemptsLeft} intento{attemptsLeft !== 1 ? "s" : ""} restante{attemptsLeft !== 1 ? "s" : ""}
              </span>
            )}
            {!correct && maxReached && (
              <span className="text-xs font-medium text-rose-500">
                Sin intentos restantes
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {maxReached && !correct ? (
              <div className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Has agotado tus intentos. Revisa el material de la lección e intenta la siguiente actividad.</span>
              </div>
            ) : (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="mr-1.5 h-4 w-4" /> Reintentar
              </Button>
            )}
            <Button
              onClick={onNext}
              size="sm"
              className={cn(
                "bg-gradient-to-r text-white shadow-sm hover:opacity-90",
                unitColor.gradient
              )}
            >
              {isLast ? (
                <>
                  <BookOpen className="mr-1.5 h-4 w-4" /> Volver a la lección
                </>
              ) : (
                <>
                  Siguiente actividad{" "}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de reporte de retroalimentación */}
      <Dialog open={reportOpen} onOpenChange={onSetReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-rose-500" />
              Reportar retroalimentación
            </DialogTitle>
            <DialogDescription>
              Tu reporte será revisado por el equipo docente. Esto nos ayuda a mejorar la calidad de la retroalimentación IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Motivo del reporte
              </label>
              <div className="space-y-1.5">
                {reportReasons.map((r) => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                      reportReason === r.value
                        ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reportReason === r.value}
                      onChange={(e) => onSetReportReason(e.target.value)}
                      className="h-3.5 w-3.5 accent-rose-500"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Comentario (opcional)
              </label>
              <Textarea
                value={reportComment}
                onChange={(e) => onSetReportComment(e.target.value)}
                placeholder="Describe el problema que encontraste..."
                className="min-h-[70px] resize-none text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onSetReportOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onSubmitReport} className="bg-rose-600 hover:bg-rose-700">
              <Flag className="mr-1 h-3.5 w-3.5" />
              Enviar reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ---------- navigation footer ----------

interface ActivityNavFooterProps {
  activityIndex: number;
  activityTotal: number;
  prevActivity: Activity | null;
  nextActivity: Activity | null;
  onOpenActivity: (id: string) => void;
  onOpenLesson: () => void;
}

function ActivityNavFooter({
  activityIndex,
  activityTotal,
  prevActivity,
  nextActivity,
  onOpenActivity,
  onOpenLesson,
}: ActivityNavFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
      <Button
        variant="ghost"
        size="sm"
        disabled={!prevActivity}
        onClick={() => prevActivity && onOpenActivity(prevActivity.id)}
        className="text-muted-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
      </Button>
      <span className="text-xs font-medium text-muted-foreground">
        Actividad {activityIndex + 1} de {activityTotal}
      </span>
      {nextActivity ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenActivity(nextActivity.id)}
          className="text-primary"
        >
          Siguiente <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenLesson}
          className="text-primary"
        >
          Terminar lección{" "}
          <CheckCircle2 className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ---------- empty state ----------

function EmptyState({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 p-8 text-center lg:p-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Info className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button onClick={onBack} className="mt-2">
        <BookOpen className="mr-1.5 h-4 w-4" /> Ir a unidades
      </Button>
    </div>
  );
}
