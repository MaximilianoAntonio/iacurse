"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { useStudySessionTracker } from "@/hooks/use-telemetry";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { ReportErrorDialog } from "@/components/app/report-error-dialog";
import { ReadingProgress } from "@/components/app/reading-progress";
import { LessonToc } from "@/components/app/lesson-toc";
import { getUnitColor, activityTypeMeta, difficultyMeta } from "@/lib/course-utils";
import {
  splitContentSections,
  PROSE_CLASSES,
  markdownComponents,
} from "@/lib/course-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Lightbulb,
  PlayCircle,
  Sparkles,
} from "lucide-react";

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
    unit: { id: string; title: string; color: string; icon: string; slug: string };
    activities: {
      id: string;
      lessonId: string;
      type: string;
      title: string;
      prompt: string;
      data: string;
      points: number;
      difficulty: string;
      order: number;
    }[];
  };
  /** Lecciones hermanas de la unidad (publicadas, ordenadas) para prev/next. */
  siblingLessons: { id: string; slug: string; title: string; order: number; durationMin: number }[];
  attemptsByActivity: Record<string, { completed: boolean; bestScore: number | null; attempts: number; lastAnswer?: string }>;
}

// El parsing del contenido (split por H2, clases prose y componentes markdown
// con anclas) vive en @/lib/course-content, compartido con unit-detail-view.

export function LessonView() {
  const currentLessonId = useAppStore((s) => s.currentLessonId);
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);
  const openLesson = useAppStore((s) => s.openLesson);
  const openActivity = useAppStore((s) => s.openActivity);

  const { data, loading, error, refetch } = useFetch<LessonResponse>(
    currentLessonId ? `/api/lessons/${currentLessonId}` : null,
    [currentLessonId]
  );

  // Telemetría: la lectura de la lección cuenta como tiempo de interacción
  // (se activa al llegar los datos, con la unidad como contexto).
  useStudySessionTracker(data?.lesson?.unitId, Boolean(data?.lesson?.unitId));

  // Actualizar el título del documento con el nombre de la lección
  React.useEffect(() => {
    if (data?.lesson) {
      document.title = `${data.lesson.title} · ElectroMed IA`;
    }
  }, [data?.lesson?.id]);

  if (!currentLessonId) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Button variant="ghost" onClick={() => navigate("units")} className="mb-4">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a unidades
        </Button>
        <p className="text-muted-foreground">No se seleccionó ninguna lección.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
        <FetchError description={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
        <div className="space-y-3">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
        <div className="skeleton h-11 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-14 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="skeleton h-44 w-full rounded-xl" />
            <div className="skeleton h-28 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const { lesson, attemptsByActivity, siblingLessons } = data;
  const color = getUnitColor(lesson.unit.color);
  const completedCount = lesson.activities.filter((a) => attemptsByActivity[a.id]?.completed).length;
  const totalActivities = lesson.activities.length;
  const lessonPct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  // Lecciones hermanas (misma unidad) para la navegación anterior/siguiente
  const lessonIdx = (siblingLessons ?? []).findIndex((s) => s.id === lesson.id);
  const prevLesson = lessonIdx > 0 ? siblingLessons[lessonIdx - 1] : null;
  const nextLesson = lessonIdx >= 0 && lessonIdx < (siblingLessons?.length ?? 0) - 1 ? siblingLessons[lessonIdx + 1] : null;

  return (
    <>
      <ReadingProgress colorClass={`bg-gradient-to-r ${color.gradient}`} />
      <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title={lesson.title}
        description={lesson.description}
        icon={lesson.unit.icon}
        iconGradient={color.gradient}
        breadcrumb={[
          { label: "Unidades", onClick: () => navigate("units") },
          { label: lesson.unit.title, onClick: () => openUnit(lesson.unitId) },
          { label: lesson.title },
        ]}
      />

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-xs shadow-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {lesson.durationMin} min de lectura
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Lección {lesson.order}
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Progreso:</span>
          <span className="font-mono text-xs font-semibold tabular-nums">{completedCount}/{totalActivities}</span>
          {lessonPct === 100 && totalActivities > 0 && (
            <Badge className="ml-1 gap-1 bg-brand/10 text-brand hover:bg-brand/10 dark:bg-brand-gold/15 dark:text-brand-gold">
              <CheckCircle2 className="h-3 w-3" /> Completa
            </Badge>
          )}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <LessonContent
          key={lesson.id}
          lesson={lesson}
          attemptsByActivity={attemptsByActivity}
          onOpenActivity={openActivity}
        />
      </div>

      {/* Pie de navegación: lección anterior/siguiente + volver a la unidad */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:max-w-[38%]">
          {prevLesson && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openLesson(prevLesson.id)}
              className="h-auto max-w-full justify-start px-3 py-2 text-muted-foreground hover:text-foreground"
              title={prevLesson.title}
            >
              <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
              <span className="min-w-0 text-left">
                <span className="block text-xs">Lección anterior</span>
                <span className="block truncate font-medium text-foreground">{prevLesson.title}</span>
              </span>
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => openUnit(lesson.unitId)} className="shrink-0">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a la unidad
        </Button>
        <div className="flex sm:max-w-[38%] sm:justify-end">
          {nextLesson && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openLesson(nextLesson.id)}
              className="h-auto max-w-full justify-end px-3 py-2 text-muted-foreground hover:text-foreground"
              title={nextLesson.title}
            >
              <span className="min-w-0 text-right">
                <span className="block text-xs">Lección siguiente</span>
                <span className="block truncate font-medium text-foreground">{nextLesson.title}</span>
              </span>
              <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

// ---------- contenido de la lección (acordeón + sidebar) ----------

interface LessonContentProps {
  lesson: LessonResponse["lesson"];
  attemptsByActivity: LessonResponse["attemptsByActivity"];
  onOpenActivity: (id: string) => void;
}

/**
 * Cuerpo de la lección: material de estudio en acordeón por secciones H2,
 * CTA de práctica, TOC y lista de actividades. Se monta con key={lesson.id},
 * por lo que su estado (secciones abiertas) se reinicia al cambiar de lección.
 */
function LessonContent({ lesson, attemptsByActivity, onOpenActivity }: LessonContentProps) {
  const color = getUnitColor(lesson.unit.color);
  const completedCount = lesson.activities.filter((a) => attemptsByActivity[a.id]?.completed).length;
  const totalActivities = lesson.activities.length;

  // Contenido sin el H1 inicial (el título lo muestra el PageHeader;
  // splitContentSections también lo descarta, así el fallback sin secciones
  // y el acordeón comparten la misma fuente).
  const content = React.useMemo(
    () => (lesson.content ?? "").replace(/^\s*#\s+[^\n]*(\n|$)/, ""),
    [lesson.content]
  );

  // Secciones H2 del contenido (acordeón)
  const parsed = React.useMemo(
    () => splitContentSections(content),
    [content]
  );

  // Acordeón controlado en modo lectura: todas las secciones abiertas por
  // defecto (el TOC sticky sirve para saltar entre ellas; se pueden plegar).
  const [openSections, setOpenSections] = React.useState<string[]>(() =>
    parsed.sections.map((_, idx) => `sec-${idx}`)
  );

  // Navegación del TOC: expande la sección del acordeón antes de hacer scroll
  const handleTocNavigate = React.useCallback(
    (id: string) => {
      const scrollTo = (targetId: string) => {
        const el = document.getElementById(targetId);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 96;
          window.scrollTo({ top, behavior: "smooth" });
        }
      };
      const idx = parsed.sections.findIndex((s) => s.headingIds.includes(id));
      if (idx < 0) {
        scrollTo(id);
        return;
      }
      const value = `sec-${idx}`;
      if (openSections.includes(value)) {
        scrollTo(id);
      } else {
        setOpenSections((prev) => (prev.includes(value) ? prev : [...prev, value]));
        // Esperar a que Radix monte el contenido antes de desplazarse
        window.setTimeout(() => scrollTo(id), 140);
      }
    },
    [parsed, openSections]
  );

  return (
    <>
      {/* Contenido principal */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className={`border-b ${color.border} ${color.bgSoft}`}>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className={`h-4 w-4 ${color.text}`} />
              Material de estudio
              <span className="ml-auto">
                <ReportErrorDialog
                  source="content"
                  sourceId={`lesson:${lesson.id}`}
                  contextLabel={`Lección: ${lesson.title}`}
                />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {parsed.sections.length === 0 ? (
              // Lección sin secciones H2: render completo tradicional
              <div className={PROSE_CLASSES}>
                <ReactMarkdown components={markdownComponents}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="space-y-5">
                {parsed.intro && (
                  <div className={PROSE_CLASSES}>
                    <ReactMarkdown components={markdownComponents}>
                      {parsed.intro}
                    </ReactMarkdown>
                  </div>
                )}
                <Accordion
                  type="multiple"
                  value={openSections}
                  onValueChange={setOpenSections}
                  className="w-full space-y-3"
                >
                  {parsed.sections.map((sec, idx) => (
                    <AccordionItem
                      key={sec.id || idx}
                      id={sec.id}
                      value={`sec-${idx}`}
                      className="scroll-mt-24 rounded-xl border border-border bg-card px-4 shadow-xs transition-[box-shadow,border-color] data-[state=open]:border-brand/25 data-[state=open]:shadow-sm dark:data-[state=open]:border-brand-gold/30"
                    >
                      <AccordionTrigger className="py-4 text-base font-semibold leading-snug hover:text-brand hover:no-underline dark:hover:text-brand-gold">
                        {sec.title}
                      </AccordionTrigger>
                      <AccordionContent className={`${PROSE_CLASSES} pt-1 pb-5`}>
                        <ReactMarkdown components={markdownComponents}>
                          {sec.body}
                        </ReactMarkdown>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA siguiente: actividades */}
        <Card className={`border-dashed ${color.border}`}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color.bgSoft} ${color.text}`}>
              <Lightbulb className="h-4 w-4" />
            </div>
            <p className="flex-1 text-sm">
              <span className="font-semibold">¿Listo para practicar?</span>{" "}
              <span className="text-muted-foreground">Resuelve las actividades para afianzar los conceptos.</span>
            </p>
            {lesson.activities[0] && (
              <Button size="sm" onClick={() => onOpenActivity(lesson.activities[0].id)} className="h-10 bg-brand text-primary-foreground shadow-sm hover:bg-brand/90">
                <PlayCircle className="mr-1 h-4 w-4" /> Empezar
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: TOC + actividades (pegajoso en desktop: acompaña la lectura) */}
      <div className="space-y-4 self-start lg:sticky lg:top-6">
        <LessonToc content={lesson.content} onNavigate={handleTocNavigate} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DynamicIcon name="ListChecks" className={`h-4 w-4 ${color.text}`} />
              Actividades
              <Badge variant="secondary" className="ml-auto font-mono tabular-nums">{completedCount}/{totalActivities}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="stagger-children space-y-2 p-3">
            {lesson.activities.length === 0 && (
              <p className="p-3 text-center text-xs text-muted-foreground">No hay actividades en esta lección.</p>
            )}
            {lesson.activities.map((a, idx) => {
              const meta = activityTypeMeta[a.type as keyof typeof activityTypeMeta];
              const diff = difficultyMeta[a.difficulty as keyof typeof difficultyMeta];
              const status = attemptsByActivity[a.id];
              const isCompleted = status?.completed;
              const attempted = Boolean(status);

              return (
                <button
                  key={a.id}
                  onClick={() => onOpenActivity(a.id)}
                  className={`hover-lift group flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                    isCompleted
                      ? "border-brand/20 bg-brand/5 dark:border-brand-gold/30 dark:bg-brand-gold/10"
                      : attempted
                      ? "border-brand-gold/40 bg-brand-gold/[0.06]"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCompleted
                      ? "bg-brand text-primary-foreground"
                      : attempted
                      ? "bg-brand-gold text-brand-ink"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{a.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-xs font-medium ${meta?.color ?? ""}`}>
                        <DynamicIcon name={meta?.icon ?? "Circle"} className="h-2.5 w-2.5" />
                        {meta?.label ?? a.type}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${diff.bg} ${diff.color}`}>
                        {diff.label}
                      </span>
                      <span className="flex items-center gap-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                        <Sparkles className="h-2.5 w-2.5 text-brand-gold" /> {a.points}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
