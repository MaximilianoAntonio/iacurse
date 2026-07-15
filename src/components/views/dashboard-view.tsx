"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/app/page-header";
import { LoadingGrid } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { WeeklyGoalRing } from "@/components/app/weekly-goal-ring";
import { getUnitColor, timeAgo, initials } from "@/lib/course-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  PlayCircle,
  Zap,
  Settings2,
  BookmarkCheck,
} from "lucide-react";
import type { Unit, User } from "@/lib/types";

interface NextActivityResponse {
  recommendation: {
    activity: { id: string; title: string; type: string; difficulty: string; points: number; lessonId: string };
    lesson: { id: string; title: string };
    unit: { id: string; title: string; color: string; icon: string; slug: string; order: number };
    reason: string;
    unitProgress: { completed: number; total: number; mastery: number };
  } | null;
}

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
  const { data: nextData } = useFetch<NextActivityResponse>(
    userId ? `/api/next-activity?userId=${userId}` : null,
    [userId]
  );
  const { data: recentBadgesData } = useFetch<{ badges: { id: string; name: string; icon: string; tier: string; description: string; awardedAt: string }[] }>(
    userId ? `/api/recent-badges?userId=${userId}` : null,
    [userId]
  );
  const { data: bookmarksData } = useFetch<{ bookmarks: { id: string; activityId: string; activity: { id: string; title: string; type: string; difficulty: string; points: number; lesson: { id: string; title: string; unit: { id: string; title: string; color: string; icon: string } } } }[] }>(
    userId ? `/api/bookmarks?userId=${userId}` : null,
    [userId]
  );

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("180");
  const { toast } = useToast();

  const handleSaveGoal = async () => {
    const minutes = parseInt(goalInput, 10);
    if (isNaN(minutes) || minutes < 30 || minutes > 1200) {
      toast({ title: "Valor inválido", description: "Ingresa entre 30 y 1200 minutos.", variant: "destructive" });
      return;
    }
    try {
      await postJSON("/api/user/weekly-goal", { userId, weeklyGoalMin: minutes });
      useAppStore.setState((s) => ({
        currentUser: s.currentUser ? { ...s.currentUser, weeklyGoalMin: minutes } : null,
      }));
      setGoalDialogOpen(false);
      toast({ title: "Meta actualizada", description: `Tu meta semanal es ahora ${minutes} minutos.` });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar la meta.", variant: "destructive" });
    }
  };

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
      {/* Hero de bienvenida — Identidad UV */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003366] via-[#004488] to-[#0066AA] p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge className="border-amber-400/30 bg-amber-400/15 text-amber-300 backdrop-blur">
              <Sparkles className="mr-1 h-3 w-3" /> Piloto de innovación docente · UVA24991
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
                className="bg-amber-400 text-[#003366] hover:bg-amber-300"
                size="sm"
              >
                <BookOpen className="mr-1.5 h-4 w-4" />
                Continuar aprendiendo
              </Button>
              <Button
                onClick={() => useAppStore.getState().setChatOpen(true)}
                variant="outline"
                size="sm"
                className="border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:text-amber-200"
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

      {/* Continuar donde quedé — tarjeta inteligente */}
      {nextData?.recommendation && (
        <ContinueCard
          recommendation={nextData.recommendation}
          onOpenActivity={(lessonId, activityId) => {
            useAppStore.getState().openLesson(lessonId);
            setTimeout(() => useAppStore.getState().openActivity(activityId), 50);
          }}
          onOpenUnit={(unitId) => openUnit(unitId)}
        />
      )}

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

      {/* Meta semanal + Resumen rápido */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="relative">
              <WeeklyGoalRing
                current={(() => {
                  const days = progressData?.activityByDay ?? [];
                  return days.slice(-7).reduce((a, d) => a + d.timeMin, 0);
                })()}
                goal={currentUser?.weeklyGoalMin ?? 180}
                daysActive={(() => {
                  const days = progressData?.activityByDay ?? [];
                  return days.slice(-7).filter((d) => d.attempts > 0).length;
                })()}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                onClick={() => setGoalDialogOpen(true)}
              >
                <Settings2 className="h-3 w-3" />
                Ajustar
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-950/20">
          <CardContent className="flex flex-col justify-between p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Racha actual</p>
                <p className="text-[11px] text-muted-foreground">Mantén la constancia</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold tabular-nums">{currentUser?.streak ?? 0}</span>
                <span className="pb-1 text-sm text-muted-foreground">días</span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {Array.from({ length: 7 }).map((_, i) => {
                  const days = progressData?.activityByDay ?? [];
                  const active = i < days.slice(-7).filter((d) => d.attempts > 0).length;
                  return (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        active ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-muted-foreground/15"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Notificación de badges recientes */}
      {recentBadgesData?.badges && recentBadgesData.badges.length > 0 && (
        <section className="space-y-3">
          {recentBadgesData.badges.map((badge, i) => {
            const tierMeta = {
              bronze: { gradient: "from-amber-400 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900" },
              silver: { gradient: "from-amber-300 to-amber-500", bg: "bg-slate-50 dark:bg-slate-900/30", border: "border-slate-200 dark:border-slate-800" },
              gold: { gradient: "from-yellow-400 to-amber-500", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-900" },
            }[badge.tier] ?? { gradient: "from-amber-400 to-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900" };
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center gap-3 rounded-2xl border ${tierMeta.border} ${tierMeta.bg} p-4`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tierMeta.gradient} text-white shadow-lg`}>
                  <DynamicIcon name={badge.icon} className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">¡Nuevo badge desbloqueado!</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{badge.tier}</span>
                  </div>
                  <p className="text-sm font-medium">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("achievements")}
                  className="shrink-0 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950"
                >
                  Ver <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </motion.div>
            );
          })}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continuar aprendiendo */}
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tus unidades</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("units")} className="text-[#003366]">
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
                      <Badge className="bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400">
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

          {/* Bookmarks guardados */}
          {bookmarksData?.bookmarks && bookmarksData.bookmarks.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <BookmarkCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-semibold">Actividades guardadas</h3>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{bookmarksData.bookmarks.length}</Badge>
                </div>
                <div className="space-y-1.5">
                  {bookmarksData.bookmarks.slice(0, 4).map((b) => {
                    const color = getUnitColor(b.activity.lesson.unit.color);
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          useAppStore.getState().openLesson(b.activity.lesson.id);
                          setTimeout(() => useAppStore.getState().openActivity(b.activityId), 50);
                        }}
                        className="group flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-950/30"
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color.bgSoft} ${color.text}`}>
                          <DynamicIcon name="ListChecks" className="h-3 w-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{b.activity.title}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{b.activity.lesson.unit.title}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

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
                  <Button size="sm" onClick={() => navigate("units")} className="bg-[#003366] hover:bg-[#004488]">
                    Explorar unidades
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentAttempts.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 p-3.5">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.correct ? "bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400" : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"}`}>
                        {a.correct ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{a.activity.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {a.activity.lesson.unit.title}
                        </p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        <div className={a.correct ? "font-semibold text-[#003366]" : "font-semibold text-amber-600"}>
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
          <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 dark:border-amber-900 dark:from-amber-950/40 dark:to-amber-950/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
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
                className="mt-3 w-full border-amber-200 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
                onClick={() => navigate("achievements")}
              >
                Ver mis logros
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Dialog: Editar meta semanal */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar meta semanal</DialogTitle>
            <DialogDescription>
              Define cuántos minutos quieres estudiar por semana. Recomendado: 120-300 min.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="goal-minutes" className="text-xs font-semibold">
                Minutos por semana
              </Label>
              <Input
                id="goal-minutes"
                type="number"
                min={30}
                max={1200}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Equivalente a ~{Math.round(parseInt(goalInput || "0", 10) / 7)} min/día
              </p>
            </div>
            <div className="flex gap-2">
              {[60, 120, 180, 300].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setGoalInput(String(preset))}
                  className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveGoal}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  emerald: "bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  violet: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
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

interface ContinueCardProps {
  recommendation: {
    activity: { id: string; title: string; type: string; difficulty: string; points: number; lessonId: string };
    lesson: { id: string; title: string };
    unit: { id: string; title: string; color: string; icon: string; slug: string; order: number };
    reason: string;
    unitProgress: { completed: number; total: number; mastery: number };
  };
  onOpenActivity: (lessonId: string, activityId: string) => void;
  onOpenUnit: (unitId: string) => void;
}

function ContinueCard({ recommendation, onOpenActivity, onOpenUnit }: ContinueCardProps) {
  const { activity, lesson, unit, reason, unitProgress } = recommendation;
  const color = getUnitColor(unit.color);
  const isContinue = reason === "continue";
  const pct = unitProgress.total > 0 ? Math.round((unitProgress.completed / unitProgress.total) * 100) : 0;

  const typeLabels: Record<string, string> = {
    multiple_choice: "Selección múltiple",
    guided_problem: "Problema guiado",
    case_analysis: "Análisis de caso",
    progressive_exercise: "Ejercicio progresivo",
    self_assessment: "Autoevaluación",
  };

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 ${color.border} ${color.bgSoft} transition-all`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${color.gradient}`} />
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${color.gradient} text-white shadow-lg`}>
            <DynamicIcon name={unit.icon} className="h-7 w-7" />
            {isContinue && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-900 shadow">
                !
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`gap-1 ${color.text} ${color.border}`}>
                {isContinue ? (
                  <>
                    <PlayCircle className="h-3 w-3" /> Continuar donde quedaste
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3" /> Empezar nueva unidad
                  </>
                )}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Unidad {unit.order} · {unit.title}
              </span>
            </div>
            <h3 className="truncate text-base font-bold leading-tight sm:text-lg">
              {activity.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {lesson.title} · {typeLabels[activity.type] ?? activity.type}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Progress value={pct} className={`h-1.5 w-24 ${color.bg}`} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {unitProgress.completed}/{unitProgress.total} actividades
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">·</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3" /> {activity.points} pts
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onOpenUnit(unit.id)}
          >
            Ver unidad
          </Button>
          <Button
            size="sm"
            className={`bg-gradient-to-br ${color.gradient} text-white shadow-md hover:opacity-90`}
            onClick={() => onOpenActivity(activity.lessonId, activity.id)}
          >
            <PlayCircle className="mr-1.5 h-4 w-4" />
            {isContinue ? "Continuar" : "Comenzar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
