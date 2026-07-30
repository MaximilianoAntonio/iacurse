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
import { LessonToc, slugifyHeading } from "@/components/app/lesson-toc";
import { getUnitColor, activityTypeMeta, difficultyMeta } from "@/lib/course-utils";
import { resolveMediaSrc, videoEmbedUrl, VideoEmbed } from "@/lib/markdown-media";
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
  attemptsByActivity: Record<string, { completed: boolean; bestScore: number | null; attempts: number; lastAnswer?: string }>;
}

// ---------- parsing del contenido ----------

interface LessonSection {
  title: string;
  id: string; // slug del H2, asignado al AccordionItem (ancla del TOC)
  body: string;
  headingIds: string[]; // id del H2 + ids de los H3 internos
}

/**
 * Divide el markdown de la lección por cabeceras H2 (mismo patrón que
 * unit-detail-view): el texto previo al primer H2 se renderiza directo como
 * introducción y cada sección H2 se convierte en un ítem del acordeón.
 * Un H1 inicial se descarta: el título de la lección ya lo muestra el
 * PageHeader, y repetirlo dentro de la tarjeta compite con él.
 */
function splitLessonContent(markdown: string): { intro: string; sections: LessonSection[] } {
  const withoutH1 = markdown.replace(/^\s*#\s+[^\n]*(\n|$)/, "");
  const chunks = withoutH1.split(/(?=^##\s+[^#\n]+)/m);
  let intro = "";
  const sections: LessonSection[] = [];

  for (const chunk of chunks) {
    if (chunk.trim().startsWith("## ")) {
      const lines = chunk.split("\n");
      const title = lines[0].replace(/^##\s+/, "").replace(/[*_`~]/g, "").trim();
      const body = lines.slice(1).join("\n").trim();
      const id = slugifyHeading(title);
      const headingIds = [id];
      // Recoger los H3 internos para que el TOC pueda expandir la sección
      let inCodeBlock = false;
      for (const line of body.split("\n")) {
        if (line.trim().startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        if (inCodeBlock) continue;
        const h3 = line.match(/^###\s+(.+)/);
        if (h3) headingIds.push(slugifyHeading(h3[1].replace(/[*_`~]/g, "").trim()));
      }
      sections.push({ title, id, body, headingIds });
    } else {
      intro += chunk;
    }
  }
  return { intro: intro.trim(), sections };
}

// Clases prose compartidas (intro, secciones y fallback sin secciones)
const PROSE_CLASSES =
  "prose prose-sm sm:prose-base max-w-none dark:prose-invert " +
  "prose-headings:scroll-mt-24 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl " +
  "prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-lg prose-p:my-4 prose-p:leading-7 " +
  "prose-li:my-1.5 prose-strong:font-semibold " +
  "prose-code:rounded-md prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 " +
  "prose-code:font-mono prose-code:text-[0.85em] prose-code:font-medium " +
  "prose-code:text-brand dark:prose-code:text-brand-gold " +
  "prose-code:before:content-none prose-code:after:content-none";

// Texto plano de un heading (por si contiene formato inline como *cursiva*)
function headingText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) =>
      typeof c === "string" || typeof c === "number"
        ? String(c)
        : headingText((c as { props?: { children?: React.ReactNode } })?.props?.children)
    )
    .join("");
}

// Componentes markdown: ids de ancla en h2/h3 (misma función slug que el TOC)
// y cajas destacadas con JetBrains Mono para código/fórmulas.
const markdownComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(headingText(children));
    return <h2 id={id}>{children}</h2>;
  },
  h3: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(headingText(children));
    return <h3 id={id}>{children}</h3>;
  },
  // Bloque de código/fórmula: panel de lectura de instrumento en tinta azul
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-brand-ink/60 bg-brand-ink p-4 font-mono text-[13px] leading-relaxed text-primary-foreground shadow-sm [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  // Cita/nota: caja ámbar suave, sin borde lateral grueso (regla del sistema)
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 rounded-lg bg-accent/50 px-4 py-3 text-sm text-accent-foreground [&_p]:my-1">
      {children}
    </blockquote>
  ),
  // Enlaces de video (YouTube/Vimeo) se embeben; el resto abre en pestaña nueva
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href && videoEmbedUrl(href)) {
      return <VideoEmbed href={href} title={typeof children === "string" ? children : undefined} />;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline dark:text-brand-gold">
        {children}
      </a>
    );
  },
  // Imágenes: las subidas al backend (/media/...) se resuelven contra API_BASE
  img: ({ src, alt }: any) => (
    <img
      src={resolveMediaSrc(typeof src === "string" ? src : undefined)}
      alt={alt || ""}
      className="my-4 max-w-full rounded-xl border border-border shadow-sm"
      loading="lazy"
    />
  ),
};

export function LessonView() {
  const currentLessonId = useAppStore((s) => s.currentLessonId);
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);
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

  const { lesson, attemptsByActivity } = data;
  const color = getUnitColor(lesson.unit.color);
  const completedCount = lesson.activities.filter((a) => attemptsByActivity[a.id]?.completed).length;
  const totalActivities = lesson.activities.length;
  const lessonPct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

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

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={() => openUnit(lesson.unitId)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a la unidad
        </Button>
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
  // splitLessonContent también lo descarta, así el fallback sin secciones
  // y el acordeón comparten la misma fuente).
  const content = React.useMemo(
    () => (lesson.content ?? "").replace(/^\s*#\s+[^\n]*(\n|$)/, ""),
    [lesson.content]
  );

  // Secciones H2 del contenido (acordeón)
  const parsed = React.useMemo(
    () => splitLessonContent(content),
    [content]
  );

  // Acordeón controlado: primera sección abierta por defecto
  const [openSections, setOpenSections] = React.useState<string[]>(() =>
    parsed.sections.length > 0 ? ["sec-0"] : []
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
