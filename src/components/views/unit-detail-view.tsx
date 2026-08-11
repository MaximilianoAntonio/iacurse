"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON } from "@/hooks/use-fetch";
import { useStudySessionTracker } from "@/hooks/use-telemetry";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { ReportErrorDialog } from "@/components/app/report-error-dialog";
import { getUnitColor } from "@/lib/course-utils";
import {
  splitContentSections,
  splitCheckpoints,
  parseCheckpointQuestions,
  PROSE_CLASSES,
  markdownComponents,
} from "@/lib/course-content";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  Brain,
  PenTool,
} from "lucide-react";
import type { Unit, User } from "@/lib/types";

interface UnitDetailLesson {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  order: number;
  activities: {
    id: string;
    type: string;
    title: string;
    points: number;
    difficulty: string;
    order: number;
  }[];
}

interface UnitDetailResponse {
  unit: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    description: string;
    icon: string;
    color: string;
    order: number;
    content: string;
    hasAdaptedContent: boolean;
    adaptedContent: string;
    diagnosticSkipped: boolean;
    /** true cuando el estudiante ya respondió el diagnóstico general del curso
     *  (habilita el botón "Personalizar con IA"). */
    hasCourseDiagnostic: boolean;
    lessons: UnitDetailLesson[];
  };
  progress: { completed: number; total: number; mastery: number; lastVisited: string | null } | null;
  attemptsByActivity: Record<string, { completed: boolean; bestScore: number | null; attempts: number }>;
}

/** Skeleton de carga del detalle de unidad. */
function UnitDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
      <div className="space-y-3">
        <div className="skeleton h-8 w-72 max-w-full" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="skeleton h-40 w-full rounded-xl" />
      <div className="space-y-3 rounded-xl border border-border bg-card p-6">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-24 w-full rounded-lg" />
        <div className="skeleton h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function UnitDetailView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const currentUnitId = useAppStore((s) => s.currentUnitId);
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);
  const openLesson = useAppStore((s) => s.openLesson);
  const openActivity = useAppStore((s) => s.openActivity);

  const { data, loading, error, refetch } = useFetch<UnitDetailResponse>(
    currentUnitId ? `/api/units/${currentUnitId}` : null,
    [currentUnitId]
  );

  // Listado liviano de unidades para la navegación anterior/siguiente
  const { data: unitsList } = useFetch<{ units: Unit[] }>(`/api/units`, []);

  useStudySessionTracker(currentUnitId ?? undefined);

  const { toast } = useToast();
  const [adapting, setAdapting] = React.useState(false);
  const [skipping, setSkipping] = React.useState(false);

  const [checkpointAnswers, setCheckpointAnswers] = React.useState<Record<string, string>>({});
  const [checkpointSubmitted, setCheckpointSubmitted] = React.useState(false);
  const [submittingCheckpoint, setSubmittingCheckpoint] = React.useState(false);

  // Cargar borradores de checkpoints al montar o cambiar de unidad (patrón
  // "ajustar estado durante el render" de React: evita el effect con setState
  // sincrónico).
  const [draftsLoadedFor, setDraftsLoadedFor] = React.useState<string | null>(null);
  if (currentUnitId && draftsLoadedFor !== currentUnitId) {
    setDraftsLoadedFor(currentUnitId);
    const storedCheck = localStorage.getItem(`electromed_checkpoint_draft_${currentUnitId}`);
    if (storedCheck) {
      try {
        setCheckpointAnswers(JSON.parse(storedCheck));
      } catch (e) {
        console.error("Failed to parse checkpoint draft", e);
      }
    } else {
      setCheckpointAnswers({});
    }
  }

  // Guardar checkpoints cuando cambie
  React.useEffect(() => {
    if (currentUnitId && Object.keys(checkpointAnswers).length > 0) {
      localStorage.setItem(`electromed_checkpoint_draft_${currentUnitId}`, JSON.stringify(checkpointAnswers));
    }
  }, [checkpointAnswers, currentUnitId]);

  // Respuestas de checkpoints escritas pero aún no enviadas (borradores locales)
  const hasUnsavedCheckpoints =
    !checkpointSubmitted &&
    !submittingCheckpoint &&
    Object.values(checkpointAnswers).some((a) => (a || "").trim().length > 0);

  // Aviso al salir de la página con respuestas sin enviar
  React.useEffect(() => {
    if (!hasUnsavedCheckpoints) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedCheckpoints]);

  const handleSubmitCheckpoints = async () => {
    setSubmittingCheckpoint(true);
    try {
      const { trackEvent } = await import("@/hooks/use-telemetry");
      await trackEvent("self_assess", {
        checkpoints: Object.entries(checkpointAnswers).map(([question, answer]) => ({
          question,
          answer,
        })),
      }, { unitId: currentUnitId || undefined });

      localStorage.removeItem(`electromed_checkpoint_draft_${currentUnitId}`);
      setCheckpointAnswers({});
      setCheckpointSubmitted(true);
      toast({
        title: "Checkpoints de control guardados",
        description: "Tus respuestas de comprensión han sido guardadas y registradas para tu profesor.",
      });
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: "No se pudieron registrar las respuestas en este momento.",
        variant: "destructive",
      });
    } finally {
      setSubmittingCheckpoint(false);
    }
  };

  // Actualizar el título del documento con el nombre de la unidad
  React.useEffect(() => {
    if (data?.unit) {
      document.title = `${data.unit.title} · ElectroMed IA`;
    }
  }, [data?.unit?.id]);

  if (!currentUnitId) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Button variant="ghost" onClick={() => navigate("units")} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a unidades
        </Button>
        <p className="text-muted-foreground">No se seleccionó ninguna unidad.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
        <PageHeader title="Unidad" />
        <FetchError description={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading || !data) {
    return <UnitDetailSkeleton />;
  }

  const { unit, progress, attemptsByActivity } = data;
  const color = getUnitColor(unit.color);
  const total = progress?.total ?? unit.lessons.reduce((a, l) => a + l.activities.length, 0);
  const completed = Math.min(progress?.completed ?? 0, total);
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const mastery = Math.min(100, progress?.mastery ?? 0);

  // Unidades hermanas para la navegación anterior/siguiente del pie
  const siblings = unitsList?.units ?? [];
  const unitIdx = siblings.findIndex((s) => s.id === unit.id);
  const prevUnit = unitIdx > 0 ? siblings[unitIdx - 1] : null;
  const nextUnit = unitIdx >= 0 && unitIdx < siblings.length - 1 ? siblings[unitIdx + 1] : null;

  // "Personalizar con IA": usa las respuestas del diagnóstico general del
  // curso para adaptar el contenido base de esta unidad (la IA demora: la UI
  // muestra estado de carga mientras tanto).
  const handleAdaptUnit = async () => {
    setAdapting(true);
    try {
      await postJSON(`/api/units/${unit.id}`, { action: "adapt" });
      toast({
        title: "Unidad personalizada",
        description: "El contenido se adaptó a tu perfil según tu diagnóstico del curso.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Error al personalizar la unidad",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setAdapting(false);
    }
  };

  // "Usar contenido base": desbloquea la unidad sin adaptar; puede
  // personalizarla más tarde desde esta misma vista.
  const handleUseBaseContent = async () => {
    setSkipping(true);
    try {
      await postJSON(`/api/units/${unit.id}`, { action: "skip" });
      toast({
        title: "Contenido base habilitado",
        description: "Ya puedes estudiar el contenido base. Personaliza la unidad cuando quieras desde aquí.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Error al usar el contenido base",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSkipping(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
      <PageHeader
        title={unit.title}
        description={unit.summary}
        icon={unit.icon}
        iconGradient={color.gradient}
        breadcrumb={[
          { label: "Unidades", onClick: () => navigate("units") },
          { label: unit.title },
        ]}
      />

      {/* Hero de la unidad — color de identidad de la unidad, datos en mono */}
      <Card className="overflow-hidden border-border shadow-sm">
        <div className={`relative bg-gradient-to-br ${color.gradient} p-6 text-white sm:p-8`}>
          <div className="relative grid gap-6 sm:grid-cols-3">
            <div className="space-y-3 sm:col-span-2">
              <Badge className="border-white/25 bg-white/15 text-white">
                Unidad {unit.order}
              </Badge>
              <p className="text-sm leading-relaxed text-white/90">{unit.description}</p>
            </div>
            <div className="space-y-3 rounded-lg bg-black/15 p-4">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/80">Progreso</span>
                  <span className="font-mono font-semibold tabular-nums">{completed}/{total}</span>
                </div>
                <Progress value={pct} className="mt-2 h-2 bg-white/20" />
              </div>
              <Separator className="bg-white/20" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/80">Dominio</span>
                <span className="font-mono text-2xl font-semibold tabular-nums">{mastery}%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {!unit.hasAdaptedContent ? (
        <Card className="space-y-5 border-border bg-card p-6 shadow-sm animate-fade-in-up">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-ink dark:text-brand-gold">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Elige cómo estudiar esta unidad</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {unit.hasCourseDiagnostic
                  ? "Puedes personalizar el contenido con IA según tu diagnóstico inicial del curso, o estudiar directamente el contenido base."
                  : "Esta unidad aún no está personalizada. Puedes estudiar el contenido base directamente."}
              </p>
            </div>
          </div>

          <Separator />

          {adapting ? (
            /* La adaptación por IA demora varios segundos: skeleton de espera */
            <div className="space-y-3" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Personalizando la unidad con IA… esto puede tardar unos segundos.
              </p>
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
              <div className="skeleton h-4 w-4/6" />
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {unit.hasCourseDiagnostic && (
                <Button onClick={handleAdaptUnit} disabled={skipping}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Personalizar esta unidad con IA
                </Button>
              )}
              <div className="space-y-1">
                <Button
                  variant="outline"
                  onClick={handleUseBaseContent}
                  disabled={skipping}
                  className="text-muted-foreground"
                >
                  {skipping ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Habilitando...
                    </>
                  ) : (
                    "Usar contenido base"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Verás el contenido original sin adaptar. Puedes personalizar la unidad después desde esta misma vista.
                </p>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Aviso para quienes usan el contenido base sin personalizar */}
          {unit.diagnosticSkipped && unit.hasCourseDiagnostic && (
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-brand-gold/50 bg-brand-gold/[0.06] p-4 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-ink dark:text-brand-gold">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Estás viendo el contenido base, sin adaptar</p>
                  <p className="text-xs text-muted-foreground">
                    Personaliza la unidad para que la IA nivele el contenido según tu diagnóstico del curso.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleAdaptUnit}
                disabled={adapting}
                className="shrink-0"
              >
                {adapting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Personalizando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Personalizar con IA
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Contenido Adaptado / Base — parsing unificado en @/lib/course-content */}
          {(() => {
            const { main: mainMarkdown, questionsMarkdown } = splitCheckpoints(
              unit.adaptedContent || unit.content || ""
            );
            const { intro: introduction, sections } = splitContentSections(mainMarkdown);
            const checkpointQuestions = parseCheckpointQuestions(questionsMarkdown);

            return (
              <div className="space-y-6">
                <Card className="border-border p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-lg font-semibold">
                        {unit.adaptedContent && !unit.diagnosticSkipped ? "Contenido de la unidad (personalizado con IA)" : "Contenido base de la unidad"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {unit.adaptedContent && !unit.diagnosticSkipped && (
                        <Badge className="border-none bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Nivel adaptativo</Badge>
                      )}
                      <ReportErrorDialog
                        source="content"
                        sourceId={`unit:${unit.id}`}
                        contextLabel={`Unidad: ${unit.title}`}
                      />
                    </div>
                  </div>

                  {introduction.trim() && (
                    <div className={`${PROSE_CLASSES} mb-6`}>
                      <ReactMarkdown components={markdownComponents}>
                        {introduction}
                      </ReactMarkdown>
                    </div>
                  )}

                  {sections.length > 0 && (
                    /* Modo lectura: secciones abiertas por defecto (se pueden plegar) */
                    <Accordion
                      key={unit.id}
                      type="multiple"
                      defaultValue={sections.map((_, idx) => `sec-${idx}`)}
                      className="w-full space-y-3"
                    >
                      {sections.map((sec, idx) => (
                        <AccordionItem
                          key={sec.id || idx}
                          value={`sec-${idx}`}
                          className="rounded-lg border border-border bg-muted/30 px-4 transition-colors hover:bg-muted/50"
                        >
                          <AccordionTrigger className="py-3 text-sm font-semibold text-brand hover:no-underline dark:text-brand-gold">
                            {sec.title}
                          </AccordionTrigger>
                          <AccordionContent className={`${PROSE_CLASSES} pb-4 pt-2`}>
                            <ReactMarkdown components={markdownComponents}>
                              {sec.body}
                            </ReactMarkdown>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </Card>

                {/* Checkpoint Questions Section */}
                {checkpointQuestions.length > 0 && (
                  <Card className="space-y-4 border-border p-6 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-border pb-3">
                      <PenTool className="h-5 w-5 text-brand-gold" />
                      <h3 className="text-lg font-semibold">Checkpoints de comprensión</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Responde las siguientes preguntas basadas en la lectura anterior para verificar tu nivel de comprensión y guardar tus respuestas.
                    </p>

                    {checkpointSubmitted ? (
                      <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-emerald-800 dark:text-emerald-200">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          ¡Respuestas registradas exitosamente!
                        </div>
                        <p className="text-xs">
                          Tus respuestas han sido grabadas en el sistema de telemetría y estarán disponibles para el docente.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2">
                        {checkpointQuestions.map((q, idx) => (
                          <div key={idx} className="space-y-2">
                            <label className="block text-sm font-medium text-foreground">
                              {idx + 1}. {q}
                            </label>
                            <Textarea
                              value={checkpointAnswers[q] || ""}
                              onChange={(e) => setCheckpointAnswers({ ...checkpointAnswers, [q]: e.target.value })}
                              placeholder="Escribe tu respuesta corta aquí..."
                              className="mt-1 min-h-[70px]"
                              disabled={submittingCheckpoint}
                            />
                            <div className="mt-1 flex items-center justify-between px-1">
                              <span className="text-[10px] text-muted-foreground/70">
                                Explica con tus palabras.
                              </span>
                              {(checkpointAnswers[q] || "").trim().length > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Borrador guardado
                                </span>
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-end pt-2">
                          <Button
                            onClick={handleSubmitCheckpoints}
                            disabled={submittingCheckpoint || checkpointQuestions.some(q => !(checkpointAnswers[q] || "").trim())}
                          >
                            {submittingCheckpoint ? (
                              <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Enviando...
                              </>
                            ) : (
                              <>Enviar respuestas de control</>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            );
          })()}

          {/* Lecciones y actividades de la unidad */}
          {unit.lessons.length > 0 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand dark:text-brand-gold" />
                <h3 className="text-lg font-semibold">Lecciones de la unidad</h3>
              </div>
              <div className="stagger-children grid gap-4 md:grid-cols-2">
                {unit.lessons.map((lesson) => (
                  <Card key={lesson.id} className="hover-lift flex flex-col border-border p-5 shadow-sm">
                    <button
                      onClick={() => openLesson(lesson.id)}
                      className="group flex items-start justify-between gap-2 text-left"
                    >
                      <div>
                        <h4 className="font-semibold text-foreground transition-colors group-hover:text-brand dark:group-hover:text-brand-gold">
                          {lesson.title}
                        </h4>
                        {lesson.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{lesson.description}</p>
                        )}
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand dark:group-hover:text-brand-gold" />
                    </button>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-mono tabular-nums">{lesson.durationMin} min</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{lesson.activities.length} actividades</span>
                    </div>
                    {lesson.activities.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                        {lesson.activities.map((a) => {
                          const summary = attemptsByActivity?.[a.id];
                          return (
                            <button
                              key={a.id}
                              onClick={() => openActivity(a.id, lesson.id)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                            >
                              {summary?.completed ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
                              )}
                              <span className="flex-1 truncate">{a.title}</span>
                              <span className="font-mono tabular-nums text-muted-foreground">{a.points} pts</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Pie de navegación: unidad anterior/siguiente + listado completo */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:max-w-[38%]">
          {prevUnit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openUnit(prevUnit.id)}
              className="h-auto max-w-full justify-start px-3 py-2 text-muted-foreground hover:text-foreground"
              title={prevUnit.title}
            >
              <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
              <span className="min-w-0 text-left">
                <span className="block text-xs">Unidad anterior</span>
                <span className="block truncate font-medium text-foreground">{prevUnit.title}</span>
              </span>
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("units")} className="shrink-0">
          <ArrowLeft className="mr-1 h-4 w-4" /> Todas las unidades
        </Button>
        <div className="flex sm:max-w-[38%] sm:justify-end">
          {nextUnit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openUnit(nextUnit.id)}
              className="h-auto max-w-full justify-end px-3 py-2 text-muted-foreground hover:text-foreground"
              title={nextUnit.title}
            >
              <span className="min-w-0 text-right">
                <span className="block text-xs">Unidad siguiente</span>
                <span className="block truncate font-medium text-foreground">{nextUnit.title}</span>
              </span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
