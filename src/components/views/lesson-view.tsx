"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingRows } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { ReadingProgress } from "@/components/app/reading-progress";
import { LessonToc } from "@/components/app/lesson-toc";
import { getUnitColor, activityTypeMeta, difficultyMeta } from "@/lib/course-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Lightbulb,
  MessageSquare,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import type { User } from "@/lib/types";

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

export function LessonView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const currentLessonId = useAppStore((s) => s.currentLessonId);
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);
  const openActivity = useAppStore((s) => s.openActivity);
  const setTutorContext = useAppStore((s) => s.setTutorContext);
  const userId = currentUser?.id ?? "";

  const { data, loading } = useFetch<LessonResponse>(
    currentLessonId ? `/api/lessons/${currentLessonId}?userId=${userId}` : null,
    [currentLessonId, userId]
  );

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

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
        <PageHeader title="Cargando lección..." />
        <LoadingRows count={3} />
      </div>
    );
  }

  const { lesson, attemptsByActivity } = data;
  const color = getUnitColor(lesson.unit.color);
  const completedCount = lesson.activities.filter((a) => attemptsByActivity[a.id]?.completed).length;
  const totalActivities = lesson.activities.length;
  const lessonPct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  const askTutor = () => {
    setTutorContext(`${lesson.unit.title} · ${lesson.title}`);
    useAppStore.getState().setChatOpen(true);
  };

  return (
    <>
      <ReadingProgress colorClass={`bg-gradient-to-r ${color.gradient}`} />
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
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
        actions={
          <Button variant="outline" size="sm" onClick={askTutor} className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300">
            <MessageSquare className="mr-1.5 h-4 w-4" /> Tutor
          </Button>
        }
      />

      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-3.5 text-xs">
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
          <span className="font-semibold">{completedCount}/{totalActivities}</span>
          {lessonPct === 100 && totalActivities > 0 && (
            <Badge className="ml-1 bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Completa
            </Badge>
          )}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contenido principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className={`border-b ${color.border} ${color.bgSoft}`}>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className={`h-4 w-4 ${color.text}`} />
                Material de estudio
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm:max-w-none sm:prose-base p-6 sm:p-7 dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-5 prose-h3:mb-2 prose-p:leading-7 prose-p:my-4 prose-li:my-1.5 prose-strong:font-semibold prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    return <h2 id={id}>{children}</h2>;
                  },
                  h3: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    return <h3 id={id}>{children}</h3>;
                  },
                }}
              >
                {lesson.content}
              </ReactMarkdown>
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
                <Button size="sm" onClick={() => openActivity(lesson.activities[0].id)} className="h-10 bg-gradient-to-br from-[#003366] to-[#0066AA] text-white hover:opacity-90">
                  <PlayCircle className="mr-1 h-4 w-4" /> Empezar
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: TOC + actividades */}
        <div className="space-y-4">
          <LessonToc content={lesson.content} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DynamicIcon name="ListChecks" className={`h-4 w-4 ${color.text}`} />
                Actividades
                <Badge variant="secondary" className="ml-auto">{completedCount}/{totalActivities}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
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
                    onClick={() => openActivity(a.id)}
                    className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                      isCompleted
                        ? "border-[#003366]/20 bg-[#003366]/5/50 dark:border-[#003366]/30 dark:bg-[#003366]/20/20"
                        : attempted
                        ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                        : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isCompleted
                        ? "bg-[#003366] text-white"
                        : attempted
                        ? "bg-amber-400 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{a.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full bg-background px-1.5 py-0.5 text-xs font-medium ${meta?.color ?? ""} border border-border`}>
                          <DynamicIcon name={meta?.icon ?? "Circle"} className="h-2.5 w-2.5" />
                          {meta?.label ?? a.type}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${diff.bg} ${diff.color}`}>
                          {diff.label}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Sparkles className="h-2.5 w-2.5" /> {a.points}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Tutor card */}
          <Card className={`bg-gradient-to-br ${color.bgSoft} ${color.border}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">¿Dudas sobre la lección?</p>
                  <p className="text-xs text-muted-foreground">Pregunta al tutor IA</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full border-amber-200 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:text-amber-300" onClick={askTutor}>
                Abrir tutor
              </Button>
            </CardContent>
          </Card>
        </div>
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
