"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON } from "@/hooks/use-fetch";
import { useStudySessionTracker } from "@/hooks/use-telemetry";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { ReportErrorDialog } from "@/components/app/report-error-dialog";
import { getUnitColor } from "@/lib/course-utils";
import { resolveMediaSrc, videoEmbedUrl, VideoEmbed } from "@/lib/markdown-media";
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
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  Brain,
  PenTool,
  SkipForward,
} from "lucide-react";
import type { DiagnosticAnswer, User } from "@/lib/types";

const GLOSSARY: Record<string, { term: string; definition: string }> = {
  ecg: { term: "ECG (Electrocardiograma)", definition: "Registro de la actividad eléctrica del corazón a lo largo del tiempo, captada mediante electrodos en la piel." },
  electrocardiograma: { term: "Electrocardiograma", definition: "Registro de la actividad eléctrica del corazón a lo largo del tiempo, captada mediante electrodos en la piel." },
  transductor: { term: "Transductor", definition: "Dispositivo que convierte una forma de energía (como presión o temperatura) en una señal eléctrica analógica." },
  desfibrilador: { term: "Desfibrilador", definition: "Equipo médico que administra una descarga eléctrica controlada al corazón para restablecer su ritmo normal." },
  impedancia: { term: "Impedancia", definition: "Oposición de un conductor o tejido al flujo de una corriente eléctrica alterna." },
  "filtro notch": { term: "Filtro Notch", definition: "Filtro diseñado para eliminar una banda de frecuencia muy estrecha, típicamente la interferencia de la red eléctrica de 50Hz/60Hz." },
  biopotenciales: { term: "Biopotenciales", definition: "Voltajes eléctricos generados por procesos electroquímicos en las células excitables del cuerpo (nervios, músculos)." },
  amplificador: { term: "Amplificador de Instrumentación", definition: "Dispositivo de alta precisión diseñado para medir señales de voltaje biopotenciales muy débiles en presencia de alto ruido." },
  marcapasos: { term: "Marcapasos", definition: "Dispositivo electrónico implantable que envía impulsos eléctricos al corazón para regular su frecuencia cardíaca." },
  sensor: { term: "Sensor", definition: "Dispositivo que detecta una magnitud física o química y la traduce en una señal interpretable." },
};

function injectGlossary(text: string): string {
  if (!text) return "";
  let processed = text;
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  for (const term of terms) {
    const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedTerm}s?)\\b(?!=[^\\[]*\\])(?![^<]*>)`, "gi");
    processed = processed.replace(regex, (match) => {
      return `[${match}](glossary:${term})`;
    });
  }
  return processed;
}

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
    diagnosticQuestions: string[];
    hasAdaptedContent: boolean;
    adaptedContent: string;
    diagnosticAnswers: DiagnosticAnswer[];
    diagnosticSkipped: boolean;
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
  const openLesson = useAppStore((s) => s.openLesson);
  const openActivity = useAppStore((s) => s.openActivity);

  const { data, loading, error, refetch } = useFetch<UnitDetailResponse>(
    currentUnitId ? `/api/units/${currentUnitId}` : null,
    [currentUnitId]
  );

  useStudySessionTracker(currentUnitId ?? undefined);

  const { toast } = useToast();
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [skipping, setSkipping] = React.useState(false);
  const [forceShowDiagnostic, setForceShowDiagnostic] = React.useState(false);

  const [checkpointAnswers, setCheckpointAnswers] = React.useState<Record<string, string>>({});
  const [checkpointSubmitted, setCheckpointSubmitted] = React.useState(false);
  const [submittingCheckpoint, setSubmittingCheckpoint] = React.useState(false);

  // Cargar borradores al montar o cambiar de unidad (patrón "ajustar estado
  // durante el render" de React: evita el effect con setState sincrónico).
  // Prioridad: borrador local > respuestas del servidor > vacío.
  const [draftsLoadedFor, setDraftsLoadedFor] = React.useState<{
    unitId: string | null;
    serverAnswers?: DiagnosticAnswer[];
  }>({ unitId: null });
  if (
    currentUnitId &&
    (draftsLoadedFor.unitId !== currentUnitId ||
      draftsLoadedFor.serverAnswers !== data?.unit?.diagnosticAnswers)
  ) {
    setDraftsLoadedFor({
      unitId: currentUnitId,
      serverAnswers: data?.unit?.diagnosticAnswers,
    });

    // 1. Diagnóstico
    const storedDiag = localStorage.getItem(`electromed_diagnostic_draft_${currentUnitId}`);
    if (storedDiag) {
      try {
        setAnswers(JSON.parse(storedDiag));
      } catch (e) {
        console.error("Failed to parse diagnostic draft", e);
      }
    } else if (data?.unit?.diagnosticAnswers) {
      const initialAnswers: Record<string, string> = {};
      data.unit.diagnosticAnswers.forEach((ans) => {
        initialAnswers[ans.question] = ans.answer;
      });
      setAnswers(initialAnswers);
    } else {
      setAnswers({});
    }

    // 2. Checkpoints
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

  // Guardar diagnóstico cuando cambie
  React.useEffect(() => {
    if (currentUnitId && Object.keys(answers).length > 0) {
      localStorage.setItem(`electromed_diagnostic_draft_${currentUnitId}`, JSON.stringify(answers));
    }
  }, [answers, currentUnitId]);

  // Guardar checkpoints cuando cambie
  React.useEffect(() => {
    if (currentUnitId && Object.keys(checkpointAnswers).length > 0) {
      localStorage.setItem(`electromed_checkpoint_draft_${currentUnitId}`, JSON.stringify(checkpointAnswers));
    }
  }, [checkpointAnswers, currentUnitId]);

  const showDiagnostic = Boolean(
    data?.unit?.diagnosticQuestions &&
    data.unit.diagnosticQuestions.length > 0 &&
    (!data.unit.hasAdaptedContent || forceShowDiagnostic)
  );

  // Respuestas escritas pero aún no enviadas (borradores locales)
  const hasUnsavedDiagnostic =
    showDiagnostic &&
    !submitting &&
    !skipping &&
    Object.values(answers).some((a) => (a || "").trim().length > 0);
  const hasUnsavedCheckpoints =
    !checkpointSubmitted &&
    !submittingCheckpoint &&
    Object.values(checkpointAnswers).some((a) => (a || "").trim().length > 0);

  // Aviso al salir de la página con respuestas sin enviar
  React.useEffect(() => {
    if (!hasUnsavedDiagnostic && !hasUnsavedCheckpoints) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedDiagnostic, hasUnsavedCheckpoints]);

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

  const handleSubmitDiagnostic = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = unit.diagnosticQuestions.map((q) => ({
        question: q,
        answer: answers[q] || "",
      }));
      await postJSON(`/api/units/${unit.id}`, { answers: formattedAnswers });
      localStorage.removeItem(`electromed_diagnostic_draft_${unit.id}`);
      setAnswers({});
      setForceShowDiagnostic(false);
      toast({
        title: "Unidad personalizada",
        description: "El contenido se adaptó a tu nivel según tus respuestas.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Error al guardar el diagnóstico",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Saltar el diagnóstico: desbloquea la unidad con el contenido base (sin
  // adaptar) y deja la opción de completar el diagnóstico más tarde.
  const handleSkipDiagnostic = async () => {
    setSkipping(true);
    try {
      await postJSON(`/api/units/${unit.id}`, { skip: true });
      localStorage.removeItem(`electromed_diagnostic_draft_${unit.id}`);
      setAnswers({});
      toast({
        title: "Diagnóstico saltado",
        description: "Ya puedes estudiar el contenido base. Completa el diagnóstico cuando quieras para personalizar la unidad.",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Error al saltar el diagnóstico",
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
        actions={
          unit.hasAdaptedContent && !unit.diagnosticSkipped ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForceShowDiagnostic(true)}
            >
              <PenTool className="mr-1.5 h-4 w-4" /> Rehacer diagnóstico
            </Button>
          ) : undefined
        }
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

      {showDiagnostic ? (
        <Card className="space-y-6 border-border bg-card p-6 shadow-sm animate-fade-in-up">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-ink dark:text-brand-gold">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Cuestionario de diagnóstico inicial</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Responde estas preguntas abiertas para que la IA nivele y adapte los contenidos de la unidad según tu conocimiento actual.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-6">
            {unit.diagnosticQuestions.map((q, idx) => (
              <div key={idx} className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">
                  {idx + 1}. {q}
                </label>
                <Textarea
                  value={answers[q] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                  placeholder="Escribe tu respuesta aquí detalladamente..."
                  className="mt-1 min-h-[100px]"
                  disabled={submitting || skipping}
                />
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-[10px] text-muted-foreground/70">
                    Mínimo 50 caracteres recomendados.
                  </span>
                  {(answers[q] || "").trim().length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Borrador guardado localmente
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            {!forceShowDiagnostic ? (
              <div className="space-y-1">
                <Button
                  variant="outline"
                  onClick={handleSkipDiagnostic}
                  disabled={submitting || skipping}
                  className="text-muted-foreground"
                >
                  {skipping ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saltando...
                    </>
                  ) : (
                    <>
                      <SkipForward className="mr-1.5 h-4 w-4" />
                      Saltar diagnóstico por ahora
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Verás el contenido base sin adaptar. Puedes completar el diagnóstico después desde esta misma unidad.
                </p>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setForceShowDiagnostic(false)} disabled={submitting}>
                Cancelar
              </Button>
            )}
            <Button
              onClick={handleSubmitDiagnostic}
              disabled={submitting || skipping || unit.diagnosticQuestions.some(q => !(answers[q] || "").trim())}
            >
              {submitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Personalizando unidad...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Guardar y adaptar unidad con IA
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Aviso para quienes saltaron el diagnóstico */}
          {unit.diagnosticSkipped && (
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-brand-gold/50 bg-brand-gold/[0.06] p-4 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-ink dark:text-brand-gold">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Estás viendo el contenido base, sin adaptar</p>
                  <p className="text-xs text-muted-foreground">
                    Completa el diagnóstico para que la IA nivele esta unidad según tu conocimiento.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setForceShowDiagnostic(true)}
                className="shrink-0"
              >
                <PenTool className="mr-1.5 h-4 w-4" /> Completar diagnóstico
              </Button>
            </div>
          )}

          {/* Contenido Adaptado / Base */}
          {(() => {
            const rawContent = unit.adaptedContent || unit.content || "";
            const parts = rawContent.split("## 🔍 Preguntas de Control");
            const mainMarkdown = parts[0];
            const questionsMarkdown = parts[1] || "";

            // Separar el contenido principal por cabeceras de tipo H2 (## Titulo)
            const rawSections = mainMarkdown.split(/(?=^##\s+[^#\n]+)/m);
            const sections: { title: string; content: string }[] = [];
            let introduction = "";

            rawSections.forEach((sec) => {
              if (sec.trim().startsWith("## ")) {
                const lines = sec.split("\n");
                const titleLine = lines[0].replace(/^##\s+/, "").trim();
                const contentLines = lines.slice(1).join("\n").trim();
                sections.push({
                  title: titleLine,
                  content: contentLines,
                });
              } else {
                introduction += sec;
               }
            });

            const checkpointQuestions: string[] = [];
            if (questionsMarkdown) {
              const matches = questionsMarkdown.match(/\d+\.\s*([^\n]+)/g);
              if (matches) {
                matches.forEach((m) => {
                  checkpointQuestions.push(m.replace(/^\d+\.\s*/, "").trim());
                });
              } else {
                const lines = questionsMarkdown.split("\n").map(l => l.trim()).filter(l => l.startsWith("1.") || l.startsWith("2.") || l.startsWith("-") || l.startsWith("¿"));
                lines.forEach((l) => {
                  checkpointQuestions.push(l.replace(/^[-1234567890.\s]+/, "").trim());
                });
              }
            }

            const markdownComponents = {
              a: ({ href, children }: any) => {
                if (href && videoEmbedUrl(href)) {
                  return <VideoEmbed href={href} title={typeof children === "string" ? children : undefined} />;
                }
                if (href?.startsWith("glossary:")) {
                  const termKey = href.substring("glossary:".length);
                  const entry = GLOSSARY[termKey.toLowerCase()];
                  if (!entry) return <span>{children}</span>;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <span className="cursor-help border-b border-dashed border-brand font-semibold text-brand transition-opacity hover:opacity-80 dark:border-brand-gold dark:text-brand-gold">
                          {children}
                        </span>
                      </PopoverTrigger>
                      <PopoverContent className="z-50 w-80 rounded-xl border border-border bg-card p-3 text-xs shadow-md">
                        <p className="mb-1 font-bold text-brand dark:text-brand-gold">{entry.term}</p>
                        <p className="text-muted-foreground">{entry.definition}</p>
                      </PopoverContent>
                    </Popover>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline dark:text-brand-gold">
                    {children}
                  </a>
                );
              },
              blockquote: ({ children }: any) => (
                <div className="my-4 rounded-r-lg border-l border-brand-gold bg-brand-gold/[0.06] px-4 py-3 text-sm italic text-foreground/90">
                  {children}
                </div>
              ),
              code: ({ inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                ) : (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-brand dark:text-brand-gold" {...props}>
                    {children}
                  </code>
                );
              },
              img: ({ src, alt }: any) => (
                <img
                  src={resolveMediaSrc(src)}
                  alt={alt || ""}
                  className="my-4 max-w-full rounded-xl border border-border shadow-sm"
                  loading="lazy"
                />
              )
            };

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
                    <div className="prose dark:prose-invert mb-6 max-w-none text-sm leading-relaxed">
                      <ReactMarkdown components={markdownComponents}>
                        {injectGlossary(introduction)}
                      </ReactMarkdown>
                    </div>
                  )}

                  {sections.length > 0 && (
                    <Accordion type="multiple" className="w-full space-y-3">
                      {sections.map((sec, idx) => (
                        <AccordionItem
                          key={idx}
                          value={`sec-${idx}`}
                          className="rounded-lg border border-border bg-muted/30 px-4 transition-colors hover:bg-muted/50"
                        >
                          <AccordionTrigger className="py-3 text-sm font-semibold text-brand hover:no-underline dark:text-brand-gold">
                            {sec.title}
                          </AccordionTrigger>
                          <AccordionContent className="prose dark:prose-invert max-w-none pb-4 pt-2 text-sm leading-relaxed">
                            <ReactMarkdown components={markdownComponents}>
                              {injectGlossary(sec.content)}
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
                              onClick={() => {
                                openLesson(lesson.id);
                                setTimeout(() => openActivity(a.id), 50);
                              }}
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

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("units")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Todas las unidades
        </Button>
      </div>
    </div>
  );
}
