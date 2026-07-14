"use client";

import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getUnitColor,
  activityTypeMeta,
  difficultyMeta,
  timeAgo,
  formatDuration,
} from "@/lib/course-utils";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  CheckCircle2,
  Flame,
  Sparkles,
  Activity,
  Trophy,
  Calendar,
  Zap,
  Brain,
  MessageSquare,
  Star,
} from "lucide-react";
import type { ActivityType, Difficulty, User } from "@/lib/types";

// ---------- Types ----------

interface ProgressUnit {
  unitId: string;
  unit: {
    id: string;
    title: string;
    color: string;
    icon: string;
    slug: string;
  };
  completed: number;
  total: number;
  mastery: number;
  lastVisited: string | null;
}

interface AttemptItem {
  id: string;
  correct: boolean;
  score: number;
  timeSpent: number | null;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    type: ActivityType;
    difficulty: Difficulty;
    lesson: { unit: { title: string; color: string } };
  };
}

interface SelfAssessItem {
  id: string;
  confidence: number;
  reflection: string;
  unitId: string | null;
  createdAt: string;
}

interface DayActivity {
  date: string;
  attempts: number;
  correct: number;
  timeMin: number;
}

interface Breakdown {
  total: number;
  correct: number;
}

interface ProgressResponse {
  user: { id: string; name: string; points: number; streak: number };
  progress: ProgressUnit[];
  attempts: AttemptItem[];
  sessions: { id: string; duration: number; startedAt: string; unitId: string | null }[];
  chatCount: number;
  selfAssess: SelfAssessItem[];
  activityByDay: DayActivity[];
  byType: Record<string, Breakdown>;
  byDifficulty: Record<string, Breakdown>;
  stats: {
    totalAttempts: number;
    correctRate: number;
    totalTimeMin: number;
    avgScore: number;
  };
}

// ---------- Color & format helpers ----------

const chartColors: Record<string, string> = {
  emerald: "#10b981",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  rose: "#f43f5e",
};

const difficultyColors: Record<Difficulty, string> = {
  easy: "#10b981",
  medium: "#f59e0b",
  hard: "#f43f5e",
};

const kpiColors: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
};

function formatHoursMinutes(min: number): string {
  if (min <= 0) return "0m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function unitHex(color: string): string {
  return chartColors[color] ?? chartColors.emerald;
}

function typeLabel(t: string): string {
  return activityTypeMeta[t as ActivityType]?.label ?? t;
}

function difficultyLabel(d: string): string {
  return difficultyMeta[d as Difficulty]?.label ?? d;
}

// ---------- Main component ----------

export function ProgressView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);

  const userId = currentUser?.id ?? "";
  const { data, loading } = useFetch<ProgressResponse>(
    `/api/progress?userId=${userId}`,
    [userId]
  );

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <PageHeader
          title="Mi progreso"
          icon="BarChart3"
          iconGradient="from-sky-500 to-cyan-600"
          description="Analítica de tu aprendizaje adaptativo en Electromedicina II."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const {
    progress,
    attempts,
    selfAssess,
    activityByDay,
    byType,
    byDifficulty,
    stats,
    chatCount,
    user,
  } = data;

  // Friendly empty state: no attempts at all
  if (stats.totalAttempts === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <PageHeader
          title="Mi progreso"
          icon="BarChart3"
          iconGradient="from-sky-500 to-cyan-600"
          description="Analítica de tu aprendizaje adaptativo en Electromedicina II."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950">
              <Activity className="h-7 w-7 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold">Aún no tienes datos suficientes</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                ¡Resuelve tu primera actividad para empezar a ver tu analítica de aprendizaje aquí!
              </p>
            </div>
            <Button onClick={() => navigate("units")} className="bg-sky-600 hover:bg-sky-700">
              <Target className="mr-1.5 h-4 w-4" />
              Explorar unidades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Derived values
  const globalMastery =
    progress.length > 0
      ? Math.round(progress.reduce((acc, p) => acc + p.mastery, 0) / progress.length)
      : 0;

  const recentAttempts = attempts.slice(0, 8);

  const activityChartData = activityByDay.map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  }));

  const bestDay = activityByDay.reduce(
    (best, d) => (d.attempts > best.attempts ? d : best),
    activityByDay[0] ?? { date: "", attempts: 0, correct: 0, timeMin: 0 }
  );

  const periodAttempts = activityByDay.reduce((a, d) => a + d.attempts, 0);

  const unitChartData = progress.map((p) => ({
    id: p.unit.id,
    title: p.unit.title,
    color: unitHex(p.unit.color),
    mastery: p.mastery,
    completed: p.completed,
    total: p.total,
  }));

  const radarData = Object.entries(byType).map(([type, b]) => ({
    type: typeLabel(type),
    total: b.total,
    correct: b.correct,
  }));

  const diffData: {
    label: string;
    total: number;
    correct: number;
    color: string;
    key: Difficulty;
  }[] = (["easy", "medium", "hard"] as Difficulty[])
    .filter((d) => byDifficulty[d])
    .map((d) => ({
      label: difficultyLabel(d),
      total: byDifficulty[d].total,
      correct: byDifficulty[d].correct,
      color: difficultyColors[d],
      key: d,
    }));

  const typeRows = Object.entries(byType).map(([type, b]) => ({
    type,
    label: typeLabel(type),
    total: b.total,
    correct: b.correct,
    rate: b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0,
  }));

  const selfAssessAvg =
    selfAssess.length > 0
      ? Math.round(
          (selfAssess.reduce((a, s) => a + s.confidence, 0) / selfAssess.length) * 10
        ) / 10
      : 0;

  const unitTitleById = new Map<string, { title: string; color: string }>();
  for (const p of progress) {
    unitTitleById.set(p.unit.id, { title: p.unit.title, color: p.unit.color });
  }

  // Mastery heatmap: rows = units, cols = difficulty
  const heatUnits = progress.map((p) => p.unit);
  const heatMap = new Map<string, Record<Difficulty, { total: number; correct: number }>>();
  for (const u of heatUnits) {
    heatMap.set(u.title, {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    });
  }
  for (const a of attempts) {
    const uTitle = a.activity.lesson.unit.title;
    const row = heatMap.get(uTitle);
    if (!row) continue;
    const diff = a.activity.difficulty;
    row[diff].total++;
    if (a.correct) row[diff].correct++;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Mi progreso"
        icon="BarChart3"
        iconGradient="from-sky-500 to-cyan-600"
        description="Analítica de tu aprendizaje adaptativo en Electromedicina II."
      />

      {/* KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Dominio global"
          value={`${globalMastery}%`}
          sub={`Promedio de ${progress.length} ${progress.length === 1 ? "unidad" : "unidades"}`}
          color="emerald"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Tasa de acierto"
          value={`${stats.correctRate}%`}
          sub={`${stats.totalAttempts} ${stats.totalAttempts === 1 ? "intento" : "intentos"}`}
          color="sky"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Tiempo total"
          value={formatHoursMinutes(stats.totalTimeMin)}
          sub="tiempo de estudio"
          color="amber"
        />
        <KpiCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="Consultas al tutor"
          value={`${chatCount}`}
          sub="preguntas a la IA"
          color="violet"
        />
      </section>

      {/* Charts tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="flex w-fit flex-wrap">
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Actividad
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Por unidad
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Por tipo
          </TabsTrigger>
          <TabsTrigger value="reflection" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Reflexión
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Activity over time */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-sky-600" /> Actividad de los últimos 14 días
              </CardTitle>
              <CardDescription>
                Intentos y aciertos diarios. La franja sky representa intentos y la verde los aciertos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={activityChartData}
                  margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="attemptsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="correctGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="attempts"
                    name="Intentos"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#attemptsGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="correct"
                    name="Correctos"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#correctGrad)"
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
                <MiniStat
                  icon={<Zap className="h-4 w-4 text-amber-500" />}
                  label="Intentos en el período"
                  value={`${periodAttempts}`}
                />
                <MiniStat
                  icon={<Calendar className="h-4 w-4 text-emerald-500" />}
                  label="Mejor día"
                  value={bestDay.date ? formatShortDate(bestDay.date) : "—"}
                  sub={bestDay.attempts > 0 ? `${bestDay.attempts} intentos` : undefined}
                />
                <MiniStat
                  icon={<Flame className="h-4 w-4 text-rose-500" />}
                  label="Racha actual"
                  value={`${user.streak} d`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: By unit */}
        <TabsContent value="units" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-emerald-600" /> Dominio por unidad
              </CardTitle>
              <CardDescription>
                Porcentaje de dominio alcanzado en cada unidad del curso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unitChartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay progreso registrado todavía.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={unitChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={200}
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<UnitBarTooltip />}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    />
                    <Bar dataKey="mastery" radius={[0, 6, 6, 0]} barSize={22}>
                      {unitChartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {progress.map((p) => {
              const color = getUnitColor(p.unit.color);
              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <button
                  key={p.unitId}
                  onClick={() => openUnit(p.unit.id)}
                  className="group rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow",
                        color.gradient
                      )}
                    >
                      <DynamicIcon name={p.unit.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.unit.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.completed}/{p.total} actividades · {p.mastery}% dominio
                      </p>
                    </div>
                    {p.mastery >= 100 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Listo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{pct}%</Badge>
                    )}
                  </div>
                  <div className="mt-3">
                    <Progress value={p.mastery} className="h-1.5" />
                  </div>
                  {p.lastVisited && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Última visita {timeAgo(p.lastVisited)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: By type & difficulty */}
        <TabsContent value="types" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-violet-600" /> Rendimiento por tipo
                </CardTitle>
                <CardDescription>
                  Total de intentos vs. aciertos en cada tipo de actividad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {radarData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData} outerRadius={95}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis
                        dataKey="type"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <PolarRadiusAxis
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Radar
                        name="Total"
                        dataKey="total"
                        stroke="#94a3b8"
                        fill="#94a3b8"
                        fillOpacity={0.15}
                      />
                      <Radar
                        name="Correctos"
                        dataKey="correct"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.4}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" /> Distribución por dificultad
                </CardTitle>
                <CardDescription>
                  Proporción de intentos por nivel de dificultad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {diffData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={diffData}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={45}
                        paddingAngle={3}
                        labelLine={false}
                      >
                        {diffData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DiffPieTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* byType summary table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por tipo de actividad</CardTitle>
              <CardDescription>
                Total de intentos, aciertos y tasa de acierto por tipo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Tipo</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 pr-4 font-medium">Correctos</th>
                      <th className="pb-2 pr-4 font-medium">Tasa</th>
                      <th className="pb-2 font-medium w-32">Progreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeRows.map((row) => (
                      <tr key={row.type} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{row.label}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{row.total}</td>
                        <td className="py-2.5 pr-4 text-emerald-600 dark:text-emerald-400">
                          {row.correct}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{row.rate}%</td>
                        <td className="py-2.5">
                          <Progress value={row.rate} className="h-1.5" />
                        </td>
                      </tr>
                    ))}
                    {typeRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                          Sin datos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mastery heatmap (nice-to-have) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-sky-500" /> Mapa de dominio por unidad y dificultad
              </CardTitle>
              <CardDescription>
                Cada celda muestra aciertos/total. La intensidad del color refleja la tasa de acierto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Unidad</th>
                      {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                        <th key={d} className="pb-2 px-2 text-center font-medium">
                          {difficultyMeta[d].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((p) => {
                      const row = heatMap.get(p.unit.title);
                      return (
                        <tr key={p.unitId} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{p.unit.title}</td>
                          {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                            const cell = row?.[d] ?? { total: 0, correct: 0 };
                            return (
                              <td key={d} className="px-2 py-1.5">
                                <HeatCell
                                  total={cell.total}
                                  correct={cell.correct}
                                  color={p.unit.color}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {progress.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          Sin datos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Reflection / metacognition */}
        <TabsContent value="reflection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-violet-600" /> Autoevaluación metacognitiva
              </CardTitle>
              <CardDescription>
                Registro de tu nivel de confianza y reflexiones sobre tu aprendizaje.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selfAssess.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950">
                    <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Aún no has registrado autoevaluaciones</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Realiza actividades de autoevaluación para reflexionar sobre tu proceso y
                      construir metacognición.
                    </p>
                  </div>
                  <Button onClick={() => navigate("units")} variant="outline" size="sm">
                    <Target className="mr-1.5 h-4 w-4" /> Ir a actividades
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-violet-600" />
                      <span className="text-sm font-medium">Confianza promedio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stars value={Math.round(selfAssessAvg)} />
                      <span className="text-sm font-bold">{selfAssessAvg.toFixed(1)} / 5</span>
                    </div>
                  </div>

                  {selfAssess.map((s) => {
                    const unit = s.unitId ? unitTitleById.get(s.unitId) : undefined;
                    return (
                      <div key={s.id} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Stars value={s.confidence} />
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {unit && (
                              <Badge variant="outline" className="gap-1">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    getUnitColor(unit.color).dot
                                  )}
                                />
                                {unit.title}
                              </Badge>
                            )}
                            <span>{timeAgo(s.createdAt)}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                          {s.reflection}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent attempts feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-sky-600" /> Intentos recientes
          </CardTitle>
          <CardDescription>Tus últimas 8 actividades resueltas.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {recentAttempts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Aún no has resuelto actividades.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentAttempts.map((a) => {
                const color = getUnitColor(a.activity.lesson.unit.color);
                return (
                  <li key={a.id} className="flex items-start gap-3 px-6 py-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        a.correct
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
                      )}
                    >
                      {a.correct ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Target className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.activity.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                          {a.activity.lesson.unit.title}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{typeLabel(a.activity.type)}</span>
                        {a.timeSpent !== null && a.timeSpent > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> {formatDuration(a.timeSpent)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px]">
                      <div
                        className={cn(
                          "font-semibold",
                          a.correct
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {a.score > 0 ? `+${a.score}` : "—"}
                      </div>
                      <div className="text-muted-foreground">{timeAgo(a.createdAt)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Sub-components ----------

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
  const colorClass = kpiColors[color] ?? kpiColors.emerald;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", colorClass)}>
          {icon}
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold leading-none">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < value
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}

function HeatCell({
  total,
  correct,
  color,
}: {
  total: number;
  correct: number;
  color: string;
}) {
  if (total === 0) {
    return (
      <div className="mx-auto flex h-9 w-full max-w-[110px] items-center justify-center rounded-md bg-muted text-[11px] text-muted-foreground">
        —
      </div>
    );
  }
  const rate = correct / total;
  const opacity = 0.18 + rate * 0.72;
  const hex = unitHex(color);
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return (
    <div
      className="mx-auto flex h-9 w-full max-w-[110px] items-center justify-center rounded-md text-[11px] font-medium text-white"
      style={{ background: `${hex}${alpha}` }}
      title={`${correct} de ${total} correctos`}
    >
      {correct}/{total}
    </div>
  );
}

interface TooltipEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== "" && (
        <div className="mb-1 font-medium">{String(label)}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color ?? "#0ea5e9" }}
          />
          <span className="text-muted-foreground">{String(entry.name ?? "")}</span>
          <span className="font-medium">{String(entry.value ?? "")}</span>
        </div>
      ))}
    </div>
  );
}

function UnitBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      title?: string;
      mastery?: number;
      completed?: number;
      total?: number;
      color?: string;
    };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: d.color ?? "#10b981" }}
        />
        {d.title}
      </div>
      <div className="text-muted-foreground">
        Dominio: <span className="font-medium text-foreground">{d.mastery ?? 0}%</span>
      </div>
      <div className="text-muted-foreground">
        Actividades:{" "}
        <span className="font-medium text-foreground">
          {d.completed ?? 0}/{d.total ?? 0}
        </span>
      </div>
    </div>
  );
}

function DiffPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: { label?: string; total?: number; correct?: number; color?: string };
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const rate = d.total && d.total > 0 ? Math.round(((d.correct ?? 0) / d.total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: d.color ?? "#10b981" }}
        />
        {d.label}
      </div>
      <div className="text-muted-foreground">
        Intentos: <span className="font-medium text-foreground">{d.total ?? 0}</span>
      </div>
      <div className="text-muted-foreground">
        Correctos:{" "}
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {d.correct ?? 0}
        </span>{" "}
        ({rate}%)
      </div>
    </div>
  );
}
