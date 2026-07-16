"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingGrid } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { getUnitColor, activityTypeMeta, difficultyMeta } from "@/lib/course-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  PlayCircle,
  MessageSquare,
} from "lucide-react";
import type { User } from "@/lib/types";

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
    lessons: UnitDetailLesson[];
  };
  progress: { completed: number; total: number; mastery: number; lastVisited: string | null } | null;
  attemptsByActivity: Record<string, { completed: boolean; bestScore: number | null; attempts: number }>;
}

export function UnitDetailView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const currentUnitId = useAppStore((s) => s.currentUnitId);
  const navigate = useAppStore((s) => s.navigate);
  const openLesson = useAppStore((s) => s.openLesson);
  const openActivity = useAppStore((s) => s.openActivity);
  const setTutorContext = useAppStore((s) => s.setTutorContext);
  const userId = currentUser?.id ?? "";

  const { data, loading } = useFetch<UnitDetailResponse>(
    `/api/units/${currentUnitId}?userId=${userId}`,
    [currentUnitId, userId]
  );

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

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
        <PageHeader title="Cargando unidad..." />
        <LoadingGrid count={3} />
      </div>
    );
  }

  const { unit, progress, attemptsByActivity } = data;
  const color = getUnitColor(unit.color);
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? unit.lessons.reduce((a, l) => a + l.activities.length, 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const mastery = progress?.mastery ?? 0;

  const askTutor = () => {
    setTutorContext(unit.title);
    useAppStore.getState().setChatOpen(true);
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
          <Button variant="outline" size="sm" onClick={askTutor} className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950">
            <MessageSquare className="mr-1.5 h-4 w-4" /> Preguntar al tutor
          </Button>
        }
      />

      {/* Hero de la unidad */}
      <Card className={`overflow-hidden border-2 ${color.border}`}>
        <div className={`relative bg-gradient-to-br ${color.gradient} p-6 text-white sm:p-8`}>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div className="relative grid gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-3">
              <Badge className="border-white/20 bg-white/20 text-white backdrop-blur">
                Unidad {unit.order}
              </Badge>
              <p className="text-sm leading-relaxed text-white/90">{unit.description}</p>
            </div>
            <div className="space-y-3 rounded-2xl bg-white/15 p-4 backdrop-blur">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/80">Progreso</span>
                  <span className="font-bold">{completed}/{total}</span>
                </div>
                <Progress value={pct} className="mt-1.5 h-2 bg-white/20" />
              </div>
              <Separator className="bg-white/20" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/80">Dominio</span>
                <span className="text-2xl font-bold">{mastery}%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lecciones */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-[#003366]" />
            Lecciones
          </h2>
          <span className="text-xs text-muted-foreground">{unit.lessons.length} lecciones</span>
        </div>

        <div className="space-y-4">
          {unit.lessons.map((lesson, idx) => {
            const lessonActivities = lesson.activities;
            const lessonCompleted = lessonActivities.filter((a) => attemptsByActivity[a.id]?.completed).length;
            const lessonPct = lessonActivities.length > 0 ? Math.round((lessonCompleted / lessonActivities.length) * 100) : 0;
            const isDone = lessonPct === 100 && lessonActivities.length > 0;

            return (
              <Card key={lesson.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-0 sm:flex-row">
                  {/* Number column */}
                  <div className={`flex items-center justify-center bg-gradient-to-br ${color.gradient} p-4 sm:w-16 sm:shrink-0`}>
                    <span className="text-3xl font-bold text-white">{idx + 1}</span>
                  </div>

                  {/* Content */}
                  <button
                    onClick={() => openLesson(lesson.id)}
                    className="flex flex-1 items-center gap-4 p-4 text-left transition-colors hover:bg-accent/40 sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight">{lesson.title}</h3>
                        {isDone ? (
                          <Badge className="shrink-0 bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Completa
                          </Badge>
                        ) : lessonPct > 0 ? (
                          <Badge variant="secondary" className="shrink-0">{lessonPct}%</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{lesson.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {lesson.durationMin} min
                        </span>
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" /> {lessonActivities.length} actividades
                        </span>
                      </div>
                      {lessonActivities.length > 0 && (
                        <Progress value={lessonPct} className="mt-2.5 h-1.5" />
                      )}
                    </div>
                    <div className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full ${color.bgSoft} ${color.text} sm:flex`}>
                      <PlayCircle className="h-4 w-4" />
                    </div>
                  </button>
                </div>

                {/* Activities quick list (collapsible-ish: always show as chips) */}
                {lessonActivities.length > 0 && (
                  <div className="border-t border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {lessonActivities.map((a) => {
                        const meta = activityTypeMeta[a.type as keyof typeof activityTypeMeta];
                        const status = attemptsByActivity[a.id];
                        return (
                          <button
                            key={a.id}
                            onClick={() => openActivity(a.id)}
                            className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              status?.completed
                                ? "border-[#003366]/20 bg-[#003366]/5 text-[#003366] hover:bg-[#003366]/10 dark:border-[#003366]/30 dark:bg-[#003366]/20/40 dark:text-amber-400"
                                : status
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                : "border-border bg-background text-muted-foreground hover:bg-accent"
                            }`}
                            title={a.title}
                          >
                            {status?.completed ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : status ? (
                              <Circle className="h-3 w-3 fill-amber-400 text-amber-500" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                            <span className="max-w-[140px] truncate">{a.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("units")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Todas las unidades
        </Button>
      </div>
    </div>
  );
}
