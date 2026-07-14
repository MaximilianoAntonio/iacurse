"use client";

import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingGrid } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { getUnitColor, timeAgo, initials } from "@/lib/course-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sparkles,
  Flame,
  TrendingUp,
  Clock,
  MessageSquare,
  Trophy,
  ArrowRight,
  Target,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import type { Unit, User } from "@/lib/types";

interface ProgressResponse {
  user: { id: string; name: string; points: number; streak: number };
  progress: {
    unitId: string;
    unit: { id: string; title: string; color: string; icon: string; slug: string };
    completed: number;
    total: number;
    mastery: number;
    lastVisited: string | null;
  }[];
  attempts: {
    id: string;
    correct: boolean;
    score: number;
    createdAt: string;
    activity: { id: string; title: string; type: string; lesson: { unit: { title: string; color: string } } };
  }[];
  stats: { totalAttempts: number; correctRate: number; totalTimeMin: number; avgScore: number };
  chatCount: number;
}

export function DashboardView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);
  const openActivity = useAppStore((s) => s.openActivity);

  const userId = currentUser?.id ?? "";
  const { data: unitsData, loading: unitsLoading } = useFetch<{ units: Unit[] }>(
    `/api/units?userId=${userId}`,
    [userId]
  );
  const { data: progressData } = useFetch<ProgressResponse>(
    `/api/progress?userId=${userId}`,
    [userId]
  );

  if (unitsLoading || !unitsData) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
        <PageHeader title="Cargando..." />
        <LoadingGrid count={3} />
      </div>
    );
  }

  const units = unitsData.units;
  const progress = progressData?.progress ?? [];
  const recentAttempts = (progressData?.attempts ?? []).slice(0, 5);
  const stats = progressData?.stats;

  // Calcular progreso global
  const totalCompleted = progress.reduce((a, p) => a + p.completed, 0);
  const totalActivities = units.reduce((a, u) => a + (u.activityCount ?? 0), 0);
  const globalMastery = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;

  // Unidad para continuar (la última visitada o la primera con progreso parcial)
  const continueUnit =
    progress
      .filter((p) => p.lastVisited)
      .sort((a, b) => new Date(b.lastVisited!).getTime() - new Date(a.lastVisited!).getTime())[0]
      ?.unit ??
    units.find((u) => (u.progress?.completed ?? 0) > 0 && (u.progress?.completed ?? 0) < (u.activityCount ?? 1)) ??
    units[0];

  const hoursStudied = Math.round((stats?.totalTimeMin ?? 0) / 60);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
      {/* Hero de bienvenida */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge className="border-white/20 bg-white/15 text-white backdrop-blur">
              <Sparkles className="mr-1 h-3 w-3" /> Piloto de innovación docente
            </Badge>
            <h1 className="text-2xl font-bold leading-tight sm:text-4xl">
              Hola, {currentUser?.name.split(" ")[0]} 👋
            </h1>
            <p className="max-w-xl text-sm text-white/90 sm:text-base">
              Continúa tu aprendizaje adaptativo en <strong>Electromedicina II</strong>.
              La IA te guía sin darte las respuestas: tú construyes el conocimiento.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={() => continueUnit && navigate("units")}
                className="bg-white text-emerald-700 hover:bg-white/90"
                size="sm"
              >
                <BookOpen className="mr-1.5 h-4 w-4" />
                Continuar aprendiendo
              </Button>
              <Button
                onClick={() => useAppStore.getState().setChatOpen(true)}
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Preguntar al tutor IA
              </Button>
            </div>
          </div>

          {/* Stats compactas */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            <StatChip icon={<Flame className="h-4 w-4" />} value={`${currentUser?.streak ?? 0}`} label="días racha" />
            <StatChip icon={<Sparkles className="h-4 w-4" />} value={`${currentUser?.points ?? 0}`} label="puntos" />
            <StatChip icon={<TrendingUp className="h-4 w-4" />} value={`${globalMastery}%`} label="dominio global" />
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="Dominio global"
          value={`${globalMastery}%`}
          sub={`${totalCompleted}/${totalActivities} actividades`}
          color="emerald"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Tasa de acierto"
          value={`${stats?.correctRate ?? 0}%`}
          sub={`${stats?.totalAttempts ?? 0} intentos`}
          color="sky"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Tiempo de estudio"
          value={`${hoursStudied}h ${Math.max(0, (stats?.totalTimeMin ?? 0) - hoursStudied * 60)}m`}
          sub="total invertido"
          color="amber"
        />
        <KpiCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Consultas al tutor"
          value={`${progressData?.chatCount ?? 0}`}
          sub="preguntas IA"
          color="violet"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continuar aprendiendo */}
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tus unidades</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("units")} className="text-emerald-600">
              Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => {
              const color = getUnitColor(u.color);
              const completed = u.progress?.completed ?? 0;
              const total = u.activityCount ?? 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <button
                  key={u.id}
                  onClick={() => openUnit(u.id)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className={`absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-gradient-to-br ${color.gradient} opacity-10 transition-opacity group-hover:opacity-20`} />
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${color.gradient} text-white shadow-md`}>
                      <DynamicIcon name={u.icon} className="h-5 w-5" />
                    </div>
                    {pct === 100 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Completada
                      </Badge>
                    ) : pct > 0 ? (
                      <Badge variant="secondary">{pct}%</Badge>
                    ) : (
                      <Badge variant="outline">Nueva</Badge>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold leading-tight">{u.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{u.summary}</p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{completed}/{total} actividades</span>
                      <span>{u.lessonCount} lecciones</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Actividad reciente */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Actividad reciente</h2>
          <Card>
            <CardContent className="p-0">
              {recentAttempts.length === 0 ? (
                <div className="space-y-3 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aún no tienes actividad. ¡Comienza con la primera unidad!
                  </p>
                  <Button size="sm" onClick={() => navigate("units")} className="bg-emerald-600 hover:bg-emerald-700">
                    Explorar unidades
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentAttempts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 p-3.5">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.correct ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"}`}>
                        {a.correct ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{a.activity.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {a.activity.lesson.unit.title}
                        </p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <div className={a.correct ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                          +{a.score}
                        </div>
                        <div>{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Siguiente insignia */}
          <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:border-violet-900 dark:from-violet-950/40 dark:to-purple-950/40">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Logros</div>
                  <div className="text-[11px] text-muted-foreground">Desbloquea insignias</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950"
                onClick={() => navigate("achievements")}
              >
                Ver mis logros
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-center backdrop-blur">
      <div className="flex items-center justify-center text-white/90">{icon}</div>
      <div className="mt-1 text-xl font-bold leading-none">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/70">{label}</div>
    </div>
  );
}

const kpiColors: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
};

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpiColors[color]}`}>
            {icon}
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
