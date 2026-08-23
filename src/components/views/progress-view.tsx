"use client";

import { useEffect, useState } from "react";
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
import { FetchError } from "@/components/app/loading";
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
  Calendar,
  Zap,
} from "lucide-react";
import type { ActivityType, Difficulty } from "@/lib/types";

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

// Colores de identidad de unidad: son series de datos y necesitan hex para
// componer el alfa del mapa de calor. Alineados a la paleta del sistema.
const chartColors: Record<string, string> = {
  emerald: "#003366", // Azul UV
  sky: "#2E6DA8", // Azul medio (ring)
  amber: "#F5B800", // Dorado UV
  violet: "#8B5CF6",
  rose: "#C0452F", // Rojo alerta
};

// Dificultad como serie de gráfico (chart-1 azul, chart-2 dorado, chart-5 violeta);
// el rojo alerta se reserva para errores.
const difficultyColors: Record<Difficulty, string> = {
  easy: "var(--chart-1)",
  medium: "var(--chart-2)",
  hard: "var(--chart-5)",
};

// Verde monitor (chart-3) solo para datos de éxito/progreso. La variante
// oscura en claro mantiene contraste ≥4.5:1 sobre porcelana.
const successText = "text-[oklch(0.45_0.13_165)] dark:text-chart-3";
const successChip = "bg-chart-3/15 text-[oklch(0.45_0.13_165)] dark:bg-chart-3/20 dark:text-chart-3";

// Tonos de acento para las tarjetas KPI
const kpiTones: Record<string, string> = {
  brand: "bg-primary/10 text-primary",
  success: successChip,
  gold: "bg-accent text-accent-foreground",
  neutral: "bg-secondary text-secondary-foreground",
};

function formatHoursMinutes(min: number): string {
  if (min <= 0) return "0m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatShortDate(iso: string): string {
  // La fecha viene como "YYYY-MM-DD" (día civil, sin hora): parsearla como
  // fecha local. Con `new Date(iso)` se interpreta como medianoche UTC y en
  // zonas UTC negativas (Chile) se mostraba un día atrasado.
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}/${m}`;
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

// ---------- Motion helpers (CSS + tokens, sin librerías nuevas) ----------

// Conteo de entrada suave para métricas: el momento focal de la vista.
// Respeta prefers-reduced-motion mostrando el valor final de inmediato.
function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Salto directo al valor final, diferido un frame para no llamar
      // setState sincrónicamente en el cuerpo del effect.
      const id = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out exponencial, en la línea de --ease-out-expo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

// Barra de progreso con llenado animado al montar: parte de 0 y la
// transición del indicador (ui/progress) la lleva a su valor real.
function AnimatedProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return <Progress value={mounted ? value : 0} className={className} />;
}

// ---------- Main component ----------

export function ProgressView() {
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);

  const { data, loading, error, refetch } = useFetch<ProgressResponse>(
    `/api/progress`,
    []
  );

  if (error) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <PageHeader
          title="Mi progreso"
          icon="BarChart3"
          description="Analítica de tu aprendizaje adaptativo en Electromedicina II."
        />
        <FetchError description={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <PageHeader
          title="Mi progreso"
          icon="BarChart3"
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
    activityByDay,
    byType,
    byDifficulty,
    stats,
    user,
  } = data;

  // Friendly empty state: no attempts at all
  if (stats.totalAttempts === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <PageHeader
          title="Mi progreso"
          icon="BarChart3"
          description="Analítica de tu aprendizaje adaptativo en Electromedicina II."
        />
        <Card className="animate-fade-in-up">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
              <Activity className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold">Aún no tienes datos suficientes</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Resuelve tu primera actividad y aquí verás tu dominio por unidad,
                tu tasa de acierto y tu tiempo de estudio.
              </p>
            </div>
            <Button onClick={() => navigate("units")}>
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
        description="Analítica de tu aprendizaje adaptativo en Electromedicina II."
      />

      {/* KPI row: entrada en cascada + conteo suave de cada métrica */}
      <section className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-full">
          <KpiCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Dominio global"
            value={globalMastery}
            format={(n) => `${n}%`}
            sub={`Promedio de ${progress.length} ${progress.length === 1 ? "unidad" : "unidades"}`}
            tone={kpiTones.success}
          />
        </div>
        <div className="h-full">
          <KpiCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Tasa de acierto"
            value={stats.correctRate}
            format={(n) => `${n}%`}
            sub={`${stats.totalAttempts} ${stats.totalAttempts === 1 ? "intento" : "intentos"}`}
            tone={kpiTones.brand}
          />
        </div>
        <div className="h-full">
          <KpiCard
            icon={<Clock className="h-5 w-5" />}
            label="Tiempo total"
            value={stats.totalTimeMin}
            format={formatHoursMinutes}
            sub="tiempo de estudio"
            tone={kpiTones.gold}
          />
        </div>
      </section>

      {/* Charts tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="flex w-fit flex-wrap h-11 p-1 gap-1">
          <TabsTrigger value="activity" className="gap-2 text-sm font-medium" title="Tu actividad diaria en los últimos 14 días">
            <Activity className="h-4 w-4" /> Actividad
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-2 text-sm font-medium" title="Dominio por unidad temática">
            <BarChart3 className="h-4 w-4" /> Por unidad
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2 text-sm font-medium" title="Desempeño por tipo y dificultad de actividad">
            <Target className="h-4 w-4" /> Por tipo
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Activity over time */}
        <TabsContent value="activity" className="animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> Actividad de los últimos 14 días
              </CardTitle>
              <CardDescription>
                Intentos y aciertos diarios. La franja azul representa intentos y la verde los aciertos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={activityChartData}
                  margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="attemptsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="correctGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="attempts"
                    name="Intentos"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#attemptsGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="correct"
                    name="Correctos"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    fill="url(#correctGrad)"
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
                <MiniStat
                  icon={<Zap className="h-4 w-4 text-primary" />}
                  label="Intentos en el período"
                  value={`${periodAttempts}`}
                />
                <MiniStat
                  icon={<Calendar className="h-4 w-4 text-primary" />}
                  label="Mejor día"
                  value={bestDay.date ? formatShortDate(bestDay.date) : "—"}
                  sub={bestDay.attempts > 0 ? `${bestDay.attempts} intentos` : undefined}
                />
                <MiniStat
                  icon={<Flame className="h-4 w-4 text-brand-gold" />}
                  label="Racha actual"
                  value={`${user.streak} d`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: By unit */}
        <TabsContent value="units" className="animate-fade-in space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Dominio por unidad
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
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={unitChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      axisLine={false}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={200}
                      tick={{ fontSize: 12 }}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<UnitBarTooltip />}
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
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

          {/* Tarjetas de unidad: cascada en el grid, hover-lift en la tarjeta */}
          <div className="stagger-children grid gap-3 sm:grid-cols-2">
            {progress.map((p) => {
              const color = getUnitColor(p.unit.color);
              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <div key={p.unitId} className="h-full">
                  <button
                    onClick={() => openUnit(p.unit.id)}
                    className="group hover-lift h-full w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                          color.gradient
                        )}
                      >
                        <DynamicIcon name={p.unit.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.unit.title}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">{p.completed}/{p.total}</span>
                          {" "}actividades ·{" "}
                          <span className="font-mono tabular-nums">{p.mastery}%</span> dominio
                        </p>
                      </div>
                      {p.mastery >= 100 ? (
                        <Badge variant="secondary" className={cn("gap-1", successChip)}>
                          <CheckCircle2 className="h-3 w-3" /> Lista
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-mono tabular-nums">{pct}%</Badge>
                      )}
                    </div>
                    <div className="mt-3">
                      <AnimatedProgress value={p.mastery} className="h-2 bg-muted/50" />
                    </div>
                    {p.lastVisited && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Última visita {timeAgo(p.lastVisited)}
                      </p>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: By type & difficulty */}
        <TabsContent value="types" className="animate-fade-in space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" /> Rendimiento por tipo
                </CardTitle>
                <CardDescription>
                  Total de intentos vs. aciertos en cada tipo de actividad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {radarData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} outerRadius={95}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="type"
                        tick={{ fontSize: 11 }}
                        stroke="var(--muted-foreground)"
                      />
                      <PolarRadiusAxis
                        tick={{ fontSize: 10 }}
                        stroke="var(--muted-foreground)"
                      />
                      <Radar
                        name="Intentos"
                        dataKey="total"
                        stroke="var(--muted-foreground)"
                        fill="var(--muted-foreground)"
                        fillOpacity={0.15}
                      />
                      <Radar
                        name="Correctos"
                        dataKey="correct"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
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
                  <Zap className="h-4 w-4 text-brand-gold" /> Distribución por dificultad
                </CardTitle>
                <CardDescription>
                  Proporción de intentos por nivel de dificultad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {diffData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
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
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-muted-foreground">
                          {row.total}
                        </td>
                        <td className={cn("py-2.5 pr-4 font-mono tabular-nums", successText)}>
                          {row.correct}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-medium tabular-nums">
                          {row.rate}%
                        </td>
                        <td className="py-2.5">
                          <AnimatedProgress value={row.rate} className="h-2 bg-muted/50" />
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
                <Sparkles className="h-4 w-4 text-primary" /> Mapa de dominio por unidad y dificultad
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
      </Tabs>

      {/* Recent attempts feed */}
      <div className="pt-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" /> Intentos recientes
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
                  <li key={a.id} className="flex items-start gap-2.5 px-4 py-2.5 sm:px-6 sm:py-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        a.correct ? successChip : "bg-destructive/10 text-destructive"
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
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
                              <Clock className="h-3 w-3" />
                              <span className="font-mono tabular-nums">{formatDuration(a.timeSpent)}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <div
                        className={cn(
                          "font-mono font-semibold tabular-nums",
                          a.correct ? successText : "text-destructive"
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
    </div>
  );
}

// ---------- Sub-components ----------

function KpiCard({
  icon,
  label,
  value,
  format,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: (n: number) => string;
  sub: string;
  tone: string;
}) {
  const display = useCountUp(value);
  return (
    <Card className="hover-lift h-full overflow-hidden">
      <CardContent className="p-5">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone)}>
          {icon}
        </div>
        <div className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums">
          {format ? format(display) : display.toLocaleString("es-CL")}
        </div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-mono text-lg font-semibold leading-none tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
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
      <div className="mx-auto flex h-9 w-full max-w-[110px] items-center justify-center rounded-md bg-muted font-mono text-xs text-muted-foreground">
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
      className="mx-auto flex h-9 w-full max-w-[110px] items-center justify-center rounded-md font-mono text-xs font-medium tabular-nums text-white"
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
            style={{ background: entry.color ?? "var(--chart-1)" }}
          />
          <span className="text-muted-foreground">{String(entry.name ?? "")}</span>
          <span className="font-mono font-medium tabular-nums">{String(entry.value ?? "")}</span>
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
          style={{ background: d.color ?? "var(--chart-1)" }}
        />
        {d.title}
      </div>
      <div className="text-muted-foreground">
        Dominio:{" "}
        <span className="font-mono font-medium tabular-nums text-foreground">
          {d.mastery ?? 0}%
        </span>
      </div>
      <div className="text-muted-foreground">
        Actividades:{" "}
        <span className="font-mono font-medium tabular-nums text-foreground">
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
          style={{ background: d.color ?? "var(--chart-1)" }}
        />
        {d.label}
      </div>
      <div className="text-muted-foreground">
        Intentos:{" "}
        <span className="font-mono font-medium tabular-nums text-foreground">
          {d.total ?? 0}
        </span>
      </div>
      <div className="text-muted-foreground">
        Correctos:{" "}
        <span className={cn("font-mono font-medium tabular-nums", successText)}>
          {d.correct ?? 0}
        </span>{" "}
        ({rate}%)
      </div>
    </div>
  );
}
