"use client";

import * as React from "react";
import { useFetch } from "@/hooks/use-fetch";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Sparkles,
  Trophy,
  Target,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, timeAgo, getUnitColor, activityTypeMeta } from "@/lib/course-utils";

interface StudentDetailModalProps {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActivityBreakdown {
  activity: {
    id: string;
    title: string;
    type: string;
    difficulty: string;
    points: number;
    lesson: {
      id: string;
      title: string;
      unit: { id: string; title: string; color: string; icon: string };
    };
  };
  attempts: {
    id: string;
    correct: boolean;
    score: number;
    timeSpent: number | null;
    createdAt: string;
  }[];
  bestScore: number;
  correct: boolean;
  totalAttempts: number;
  totalTime: number;
  totalHints: number;
  lastAttempt: string;
}

interface StudentDetailResponse {
  student: {
    id: string;
    /** Código anonimizado del estudiante (sin email ni nombre real). */
    studentCode: string | null;
    avatar: string | null;
    points: number;
    streak: number;
    lastActive: string | null;
    createdAt: string;
  };
  progress: {
    unitId: string;
    unit: { id: string; title: string; color: string; icon: string; slug: string; order: number };
    completed: number;
    total: number;
    mastery: number;
    lastVisited: string | null;
  }[];
  activities: ActivityBreakdown[];
  badges: { id: string; name: string; icon: string; tier: string; slug: string; awardedAt: string }[];
  stats: {
    totalAttempts: number;
    correctAttempts: number;
    totalActivitiesAttempted: number;
    totalActivitiesCorrect: number;
    totalTimeMin: number;
    avgScore: number;
    totalHintsUsed: number;
  };
}

export function StudentDetailModal({ studentId, open, onOpenChange }: StudentDetailModalProps) {
  const { data, loading, error, refetch } = useFetch<StudentDetailResponse>(
    studentId && open ? `/api/teacher/student/${studentId}` : null,
    [studentId, open]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Detalle del estudiante</DialogTitle>
        {error && !data ? (
          <DetailError detail={error} onRetry={refetch} />
        ) : loading || !data ? (
          <DetailSkeleton />
        ) : (
          <StudentDetailContent data={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Estados de carga y error ----------

function DetailSkeleton() {
  return (
    <div className="flex max-h-[90vh] flex-col" aria-busy="true" aria-label="Cargando detalle del estudiante">
      <div className="shrink-0 border-b border-border p-5">
        <div className="flex items-start gap-4">
          <div className="skeleton h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-3 w-64" />
            <div className="skeleton h-3 w-40" />
          </div>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-px border-b border-border bg-border lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-background p-2.5">
            <div className="skeleton mx-auto h-4 w-4" />
            <div className="skeleton mx-auto mt-1.5 h-4 w-10" />
            <div className="skeleton mx-auto mt-1 h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    </div>
  );
}

function DetailError({ detail, onRetry }: { detail: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">No se pudo cargar el detalle del estudiante</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {detail
            ? `Ocurrió un problema al comunicar con el servidor (${detail}).`
            : "Ocurrió un problema al comunicar con el servidor. Inténtalo de nuevo."}
        </p>
      </div>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RotateCw className="h-4 w-4" />
        Reintentar
      </Button>
    </div>
  );
}

// ---------- Contenido ----------

function StudentDetailContent({ data }: { data: StudentDetailResponse }) {
  const { student, progress, activities, badges, stats } = data;
  const [activeTab, setActiveTab] = React.useState<"activities" | "progress" | "badges">("activities");

  return (
    <div className="flex max-h-[90vh] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-muted/40 p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-ink text-sm font-bold text-white">
              {initials(student.studentCode ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="font-mono text-lg font-bold">{student.studentCode ?? "—"}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
                <span className="font-mono">{student.points}</span> pts
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-mono">{student.streak}</span> días
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {student.lastActive ? `Activo ${timeAgo(student.lastActive)}` : "Sin actividad"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid shrink-0 grid-cols-4 gap-px border-b border-border bg-border lg:grid-cols-7">
        <StatCell icon={<Target className="h-3.5 w-3.5" />} label="Actividades" value={`${stats.totalActivitiesCorrect}/${stats.totalActivitiesAttempted}`} />
        <StatCell icon={<TrendingUp className="h-3.5 w-3.5" />} label="Intentos" value={`${stats.totalAttempts}`} />
        <StatCell icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Acierto" value={`${stats.totalAttempts > 0 ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100) : 0}%`} />
        <StatCell icon={<Clock className="h-3.5 w-3.5" />} label="Tiempo" value={`${stats.totalTimeMin}m`} />
        <StatCell icon={<Lightbulb className="h-3.5 w-3.5" />} label="Pistas" value={`${stats.totalHintsUsed}`} />
        <StatCell icon={<Trophy className="h-3.5 w-3.5" />} label="Insignias" value={`${badges.length}`} />
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border">
        {[
          { key: "activities" as const, label: "Actividades", count: activities.length },
          { key: "progress" as const, label: "Progreso por unidad", count: progress.length },
          { key: "badges" as const, label: "Insignias", count: badges.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 font-mono text-xs font-semibold",
              activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "activities" && (
          <div className="stagger-children space-y-2">
            {activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin actividades intentadas todavía.
              </p>
            ) : (
              activities.map((a) => {
                const color = getUnitColor(a.activity.lesson.unit.color);
                const meta = activityTypeMeta[a.activity.type as keyof typeof activityTypeMeta];
                return (
                  <div key={a.activity.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", color.bgSoft, color.text)}>
                            <DynamicIcon name={meta?.icon ?? "ListChecks"} className="h-3 w-3" />
                          </span>
                          <p className="truncate text-sm font-medium">{a.activity.title}</p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {a.activity.lesson.unit.title} · {a.activity.lesson.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {a.correct ? (
                          <Badge variant="outline" className="border-chart-3/30 bg-chart-3/10 text-xs text-chart-3">
                            <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> Completada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                            <XCircle className="mr-0.5 h-2.5 w-2.5" /> En intento
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span><span className="font-mono">{a.totalAttempts}</span> intento{a.totalAttempts !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>Mejor: <span className="font-mono">{a.bestScore}</span> pts</span>
                      <span>·</span>
                      <span className="font-mono">{a.totalTime > 0 ? `${Math.round(a.totalTime / 60)}m ${a.totalTime % 60}s` : "—"}</span>
                      {a.totalHints > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            <span className="font-mono">{a.totalHints}</span> pista{a.totalHints !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{timeAgo(a.lastAttempt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "progress" && (
          <div className="stagger-children space-y-3">
            {progress.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin progreso registrado por unidad.
              </p>
            ) : (
              progress.map((p) => {
                const color = getUnitColor(p.unit.color);
                const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                return (
                  <div key={p.unitId} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white", color.gradient)}>
                        <DynamicIcon name={p.unit.icon} className="h-4 w-4" />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.unit.title}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{p.completed}/{p.total}</span> actividades · <span className="font-mono">{p.mastery}%</span> dominio
                        </p>
                      </div>
                      <Badge variant="secondary" className={cn("font-mono text-xs", pct === 100 && "bg-chart-3/10 text-chart-3 hover:bg-chart-3/10")}>
                        {pct === 100 ? "Completa" : `${pct}%`}
                      </Badge>
                    </div>
                    <Progress value={pct} className={cn("mt-2 h-1.5", color.bg)} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                Sin insignias obtenidas todavía.
              </p>
            ) : (
              badges.map((b) => {
                const tierMeta = {
                  bronze: { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50" },
                  silver: { color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800/50" },
                  gold: { color: "text-brand-gold", bg: "bg-brand-gold/15" },
                }[b.tier] ?? { color: "text-muted-foreground", bg: "bg-muted" };
                return (
                  <div key={b.id} className="rounded-lg border border-border p-3 text-center">
                    <div className={cn("mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full", tierMeta.bg, tierMeta.color)}>
                      <DynamicIcon name={b.icon} className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(b.awardedAt)}</p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-background p-2.5 text-center">
      <div className="flex items-center justify-center text-muted-foreground">{icon}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
