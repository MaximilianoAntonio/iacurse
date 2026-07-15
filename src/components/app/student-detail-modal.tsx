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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Sparkles,
  Trophy,
  MessageSquare,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, timeAgo, getUnitColor, activityTypeMeta, difficultyMeta } from "@/lib/course-utils";

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
  lastAttempt: string;
}

interface StudentDetailResponse {
  student: {
    id: string;
    name: string;
    email: string;
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
  chatCount: number;
  badges: { id: string; name: string; icon: string; tier: string; slug: string; awardedAt: string }[];
  stats: {
    totalAttempts: number;
    correctAttempts: number;
    totalActivitiesAttempted: number;
    totalActivitiesCorrect: number;
    totalTimeMin: number;
    avgScore: number;
  };
}

export function StudentDetailModal({ studentId, open, onOpenChange }: StudentDetailModalProps) {
  const { data, loading } = useFetch<StudentDetailResponse>(
    studentId && open ? `/api/teacher/student/${studentId}` : null,
    [studentId, open]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Detalle del estudiante</DialogTitle>
        {loading || !data ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-emerald-500" />
          </div>
        ) : (
          <StudentDetailContent data={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentDetailContent({ data }: { data: StudentDetailResponse }) {
  const { student, progress, activities, chatCount, badges, stats } = data;
  const [activeTab, setActiveTab] = React.useState<"activities" | "progress" | "badges">("activities");

  return (
    <div className="flex max-h-[90vh] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-gradient-to-br from-slate-50 to-slate-100 p-5 dark:from-slate-900/50 dark:to-slate-900/30">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
              {initials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{student.name}</h2>
            <p className="text-xs text-muted-foreground">{student.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                {student.points} pts
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                {student.streak} días
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
      <div className="grid shrink-0 grid-cols-3 gap-px border-b border-border bg-border sm:grid-cols-6">
        <StatCell icon={<Target className="h-3.5 w-3.5" />} label="Actividades" value={`${stats.totalActivitiesCorrect}/${stats.totalActivitiesAttempted}`} />
        <StatCell icon={<TrendingUp className="h-3.5 w-3.5" />} label="Intentos" value={`${stats.totalAttempts}`} />
        <StatCell icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Acierto" value={`${stats.totalAttempts > 0 ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100) : 0}%`} />
        <StatCell icon={<Clock className="h-3.5 w-3.5" />} label="Tiempo" value={`${stats.totalTimeMin}m`} />
        <StatCell icon={<MessageSquare className="h-3.5 w-3.5" />} label="Consultas" value={`${chatCount}`} />
        <StatCell icon={<Trophy className="h-3.5 w-3.5" />} label="Badges" value={`${badges.length}`} />
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
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              activeTab === tab.key ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "activities" && (
          <div className="space-y-2">
            {activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin actividades intentadas.</p>
            ) : (
              activities.map((a) => {
                const color = getUnitColor(a.activity.lesson.unit.color);
                const meta = activityTypeMeta[a.activity.type as keyof typeof activityTypeMeta];
                const diff = difficultyMeta[a.activity.difficulty as keyof typeof difficultyMeta];
                return (
                  <div key={a.activity.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", color.bgSoft, color.text)}>
                            <DynamicIcon name={meta?.icon ?? "ListChecks"} className="h-3 w-3" />
                          </span>
                          <p className="truncate text-sm font-medium">{a.activity.title}</p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {a.activity.lesson.unit.title} · {a.activity.lesson.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {a.correct ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950">
                            <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-600 dark:border-amber-900 dark:bg-amber-950">
                            <XCircle className="mr-0.5 h-2.5 w-2.5" /> Intento
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{a.totalAttempts} intento{a.totalAttempts !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>Mejor: {a.bestScore} pts</span>
                      <span>·</span>
                      <span>{a.totalTime > 0 ? `${Math.round(a.totalTime / 60)}m ${a.totalTime % 60}s` : "—"}</span>
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
          <div className="space-y-3">
            {progress.map((p) => {
              const color = getUnitColor(p.unit.color);
              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <div key={p.unitId} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white", color.gradient)}>
                      <DynamicIcon name={p.unit.icon} className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.unit.title}</p>
                      <p className="text-[11px] text-muted-foreground">{p.completed}/{p.total} actividades · {p.mastery}% dominio</p>
                    </div>
                    <Badge variant="secondary" className={cn("text-[10px]", pct === 100 && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300")}>
                      {pct === 100 ? "Completa" : `${pct}%`}
                    </Badge>
                  </div>
                  <Progress value={pct} className={cn("mt-2 h-1.5", color.bg)} />
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "badges" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin insignias obtenidas.</p>
            ) : (
              badges.map((b) => {
                const tierMeta = {
                  bronze: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950/40" },
                  silver: { color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800/50" },
                  gold: { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-950/50" },
                }[b.tier] ?? { color: "", bg: "" };
                return (
                  <div key={b.id} className="rounded-xl border border-border p-3 text-center">
                    <div className={cn("mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full", tierMeta.bg, tierMeta.color)}>
                      <DynamicIcon name={b.icon} className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">{timeAgo(b.awardedAt)}</p>
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
      <div className="mt-0.5 text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
