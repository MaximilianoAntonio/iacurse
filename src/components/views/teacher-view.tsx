"use client";

import { useEffect, useMemo, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { initials, timeAgo } from "@/lib/course-utils";
import type { ErrorReportItem } from "@/lib/types";
import {
  Users,
  Target,
  Clock,
  Flame,
  CheckCircle2,
  BarChart3,
  Filter,
  Activity,
  Flag,
  Inbox,
  Search,
  X,
  Download,
  Lightbulb,
  GitCompare,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentDetailModal } from "@/components/app/student-detail-modal";
import { StudentCompareModal } from "@/components/app/student-compare-modal";
import { patchJSON } from "@/hooks/use-fetch";

// ---------- Types ----------

interface StudentProgressByUnit {
  unitId: string;
  unitTitle: string;
  unitColor: string;
  completed: number;
  total: number;
  mastery: number;
}

interface Student {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  points: number;
  streak: number;
  progressByUnit: StudentProgressByUnit[];
  totalAttempts: number;
  correctAttempts: number;
  completedActivities: number;
  totalTimeMin: number;
  lastActive: string | null;
  avgScore: number;
  totalHintsUsed: number;
}

interface TeacherUnit {
  id: string;
  title: string;
  color: string;
  icon: string;
  slug: string;
}

interface AggregateMasteryByUnit {
  unitId: string;
  unitTitle: string;
  unitColor: string;
  avgMastery: number;
}

interface Aggregate {
  totalStudents: number;
  totalAttempts: number;
  avgMasteryByUnit: AggregateMasteryByUnit[];
  totalStudyHours: number;
}

interface TeacherResponse {
  students: Student[];
  units: TeacherUnit[];
  aggregate: Aggregate;
}

// ---------- Visual config ----------

// Series de gráficos: tokens --chart-* del sistema (azul UV, dorado, verde
// monitor, rojo alerta, violeta). Se pasan como var() para que recharts
// respete el tema claro/oscuro sin duplicar hex.
const chartColors: Record<string, string> = {
  emerald: "var(--chart-1)",
  sky: "var(--chart-2)",
  amber: "var(--chart-3)",
  violet: "var(--chart-5)",
  rose: "var(--chart-4)",
};

function unitHex(color: string): string {
  return chartColors[color] ?? chartColors.emerald;
}

// Semáforo de niveles: verde monitor = éxito, ámbar = alerta, rojo = crítico.
const levelColors = {
  high: "var(--chart-3)",
  mid: "var(--chart-2)",
  low: "var(--chart-4)",
} as const;

function formatHoursMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function aciertoClass(pct: number): string {
  if (pct >= 70) return "text-chart-3";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function aciertoBadge(pct: number): string {
  if (pct >= 70) return "bg-chart-3/10 text-chart-3";
  if (pct >= 40)
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-destructive/10 text-destructive";
}

// Color del indicador de progreso según el nivel de dominio (semáforo).
function masteryIndicator(pct: number): string {
  if (pct >= 70) return "[&_[data-slot=progress-indicator]]:bg-chart-3";
  if (pct >= 40) return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  return "[&_[data-slot=progress-indicator]]:bg-destructive";
}

// ---------- Main component ----------

const ALL_UNITS = "all";

export function TeacherView() {
  const [unitFilter, setUnitFilter] = useState<string>(ALL_UNITS);

  const url =
    unitFilter === ALL_UNITS
      ? `/api/teacher`
      : `/api/teacher?unitId=${unitFilter}`;

  const { data, loading, error, refetch } = useFetch<TeacherResponse>(url, [unitFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Panel docente"
        icon="Users"
        iconGradient="from-brand to-brand-ink"
        description="Seguimiento del aprendizaje del estudiantado en el piloto de Electromedicina II."
      />

      {error && !data ? (
        <PanelError detail={error} onRetry={refetch} />
      ) : loading || !data ? (
        <PanelSkeleton unitFilter={unitFilter} onUnitFilterChange={setUnitFilter} />
      ) : data.students.length === 0 ? (
        <EmptyState />
      ) : (
        <TeacherDashboard data={data} unitFilter={unitFilter} onUnitFilterChange={setUnitFilter} />
      )}
    </div>
  );
}

// ---------- Estados de carga y error ----------

function PanelSkeleton({
  unitFilter,
  onUnitFilterChange,
}: {
  unitFilter: string;
  onUnitFilterChange: (v: string) => void;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando panel docente">
      <UnitFilterBar
        units={[]}
        value={unitFilter}
        onChange={onUnitFilterChange}
        disabled
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3">
              <div className="skeleton h-9 w-9" />
              <div className="skeleton h-7 w-20" />
              <div className="skeleton h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 pt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
              <div className="skeleton h-4 w-12" />
              <div className="skeleton h-4 w-12" />
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PanelError({ detail, onRetry }: { detail: string | null; onRetry: () => void }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">No se pudo cargar el panel docente</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {detail
              ? `Ocurrió un problema al comunicar con el servidor (${detail}).`
              : "Ocurrió un problema al comunicar con el servidor. Verifica tu conexión e inténtalo de nuevo."}
          </p>
        </div>
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RotateCw className="h-4 w-4" />
          Reintentar
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- Sub-views ----------

function TeacherDashboard({
  data,
  unitFilter,
  onUnitFilterChange,
}: {
  data: TeacherResponse;
  unitFilter: string;
  onUnitFilterChange: (value: string) => void;
}) {
  const { students, units, aggregate } = data;
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  // Filtrar estudiantes por nombre/email
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  // Compute mastery distribution per unit (only when filter = all)
  const distributionByUnit = useMemo(() => {
    if (unitFilter !== ALL_UNITS) return [];
    return units
      .map((u) => {
        let low = 0;
        let mid = 0;
        let high = 0;
        for (const s of students) {
          const p = s.progressByUnit.find((p) => p.unitId === u.id);
          if (!p || p.total === 0) continue;
          if (p.mastery >= 70) high += 1;
          else if (p.mastery >= 40) mid += 1;
          else low += 1;
        }
        return {
          unitId: u.id,
          unitTitle: u.title,
          unitColor: u.color,
          low,
          mid,
          high,
        };
      })
      .filter((d) => d.low + d.mid + d.high > 0);
  }, [students, units, unitFilter]);

  return (
    <div className="space-y-6">
      <UnitFilterBar
        units={units}
        value={unitFilter}
        onChange={onUnitFilterChange}
      />

      {/* Sección 1: métricas agregadas (datos en mono, cascada de entrada) */}
      <section className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AggregateKpi
          icon={<Users className="h-4 w-4" />}
          label="Estudiantes activos"
          value={aggregate.totalStudents.toLocaleString("es-CL")}
          sub="Inscritos en el piloto"
        />
        <AggregateKpi
          icon={<Target className="h-4 w-4" />}
          label="Intentos totales"
          value={aggregate.totalAttempts.toLocaleString("es-CL")}
          sub="Actividades resueltas"
        />
        <AggregateKpi
          icon={<Clock className="h-4 w-4" />}
          label="Horas de estudio"
          value={`${aggregate.totalStudyHours}h`}
          sub="Tiempo total invertido"
        />
      </section>

      {/* Sección 2: dominio promedio por unidad */}
      {aggregate.avgMasteryByUnit.length > 0 && (
        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Dominio promedio por unidad</CardTitle>
                <CardDescription>
                  Porcentaje de mastery promedio del estudiantado en cada unidad temática.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aggregate.avgMasteryByUnit}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-jetbrains)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    type="category"
                    dataKey="unitTitle"
                    width={190}
                    tick={{ fontSize: 12, fill: "var(--foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={<MasteryTooltip />}
                  />
                  <Bar
                    dataKey="avgMastery"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                  >
                    {aggregate.avgMasteryByUnit.map((entry, i) => (
                      <Cell key={i} fill={unitHex(entry.unitColor)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              El dominio se calcula como el promedio ponderado de actividades completadas y
              tasa de acierto por unidad. Un ≥70% indica dominio satisfactorio.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sección 3: tabla de estudiantes */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Estudiantes del piloto</CardTitle>
              <CardDescription>
                {unitFilter === ALL_UNITS
                  ? `Resumen global de cada estudiante inscrito (${filteredStudents.length}${studentSearch ? ` de ${students.length}` : ""}).`
                  : `Filtrado por unidad seleccionada (${filteredStudents.length} estudiantes con actividad).`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Buscar estudiante..."
                  className="h-8 pl-8 pr-8 text-sm"
                />
                {studentSearch && (
                  <button
                    onClick={() => setStudentSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => exportStudentsCSV(filteredStudents)}
                title="Exportar datos como CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setCompareOpen(true)}
                title="Comparar dos estudiantes"
              >
                <GitCompare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Comparar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-[220px] pl-4">Estudiante</TableHead>
                  <TableHead className="text-center">Actividades</TableHead>
                  <TableHead className="text-center">Intentos</TableHead>
                  <TableHead className="text-center">Acierto</TableHead>
                  <TableHead className="min-w-[160px]">Dominio medio</TableHead>
                  <TableHead className="text-center">Tiempo</TableHead>
                  <TableHead className="pr-4 text-right">Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {studentSearch
                        ? `Sin resultados para "${studentSearch}". Prueba con otro nombre o correo.`
                        : "No hay estudiantes."}
                    </TableCell>
                  </TableRow>
                ) : (
                filteredStudents.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    unitFilter={unitFilter}
                    onSelect={() => setSelectedStudentId(s.id)}
                  />
                ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sección 4: distribución de dominio por unidad (semáforo) */}
      {distributionByUnit.length > 0 && (
        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Distribución de dominio por unidad</CardTitle>
                <CardDescription>
                  Cantidad de estudiantes por nivel de mastery en cada unidad.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionByUnit}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                  stackOffset="sign"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-jetbrains)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    type="category"
                    dataKey="unitTitle"
                    width={190}
                    tick={{ fontSize: 12, fill: "var(--foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={<DistributionTooltip />}
                  />
                  <Bar dataKey="low" stackId="a" name="Bajo (<40%)" fill={levelColors.low} barSize={22} />
                  <Bar dataKey="mid" stackId="a" name="Medio (40–69%)" fill={levelColors.mid} barSize={22} />
                  <Bar dataKey="high" stackId="a" name="Alto (≥70%)" fill={levelColors.high} radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              <LegendDot color={levelColors.high} label="Alto (≥70%)" />
              <LegendDot color={levelColors.mid} label="Medio (40–69%)" />
              <LegendDot color={levelColors.low} label="Bajo (<40%)" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 4b: analítica de uso de pistas */}
      {students.some((s) => s.totalHintsUsed > 0) && (
        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Uso de pistas por estudiante</CardTitle>
                <CardDescription>
                  Total de pistas utilizadas en actividades. Un uso alto puede indicar dificultades conceptuales.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={students
                    .filter((s) => s.totalHintsUsed > 0 || s.totalAttempts > 0)
                    .map((s) => ({
                      name: s.name.split(" ")[0] + " " + (s.name.split(" ")[1]?.[0] ?? "") + ".",
                      hints: s.totalHintsUsed,
                      attempts: s.totalAttempts,
                    }))
                    .sort((a, b) => b.hints - a.hints)}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-jetbrains)" }} stroke="var(--border)" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: "var(--foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<HintTooltip />} />
                  <Bar dataKey="hints" name="Pistas usadas" fill="var(--chart-2)" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <LegendDot color="var(--chart-2)" label="Pistas usadas" />
              <span>·</span>
              <span>Estudiantes sin pistas no se muestran</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 5: reportes de errores (IA y contenido del curso) */}
      <ErrorReportsSection />

      {/* Modal de detalle de estudiante */}
      <StudentDetailModal
        studentId={selectedStudentId}
        open={selectedStudentId !== null}
        onOpenChange={(open) => { if (!open) setSelectedStudentId(null); }}
      />

      {/* Modal de comparación de estudiantes */}
      <StudentCompareModal open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}

// ---------- Error Reports Section ----------

const reasonLabels: Record<string, { label: string; color: string }> = {
  incorrect: { label: "Respuesta incorrecta", color: "bg-destructive/10 text-destructive" },
  biased: { label: "Contenido sesgado", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  offtopic: { label: "Fuera de tema", color: "bg-primary/10 text-primary" },
  harmful: { label: "Contenido inapropiado", color: "bg-destructive/15 text-destructive" },
  other: { label: "Otro", color: "bg-muted text-muted-foreground" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  open: { label: "Pendiente", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  reviewed: { label: "Revisado", color: "bg-primary/10 text-primary" },
  resolved: { label: "Resuelto", color: "bg-chart-3/10 text-chart-3" },
};

const sourceLabels: Record<string, string> = {
  chat: "Chat tutor",
  activity: "Actividad",
  content: "Contenido del curso",
};

const STATUS_FILTERS = [
  { value: "open", label: "Pendientes" },
  { value: "reviewed", label: "Revisados" },
  { value: "resolved", label: "Resueltos" },
  { value: "all", label: "Todos" },
] as const;

function ErrorReportsSection() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const { data, loading, error, refetch } = useFetch<{ reports: ErrorReportItem[] }>(
    `/api/report?status=${statusFilter}`,
    [statusFilter]
  );

  // Auto-refresh cada 30 segundos para reportes nuevos
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleStatus = async (reportId: string, status: string) => {
    try {
      await patchJSON("/api/report", { reportId, status });
      refetch();
    } catch {
      // silencioso
    }
  };

  const reports = data?.reports ?? [];

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Flag className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Reportes de errores</CardTitle>
              <CardDescription>
                Errores reportados por el estudiantado en la retroalimentación IA y el contenido del curso.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === f.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="space-y-2" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">No se pudieron cargar los reportes</p>
            <p className="text-xs text-muted-foreground">Revisa tu conexión e inténtalo nuevamente.</p>
            <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
              <RotateCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-chart-3/10 text-chart-3">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">
              {statusFilter === "open" ? "Sin reportes pendientes" : "Sin reportes en este estado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {statusFilter === "open"
                ? "No hay errores reportados para revisar."
                : "Prueba con otro filtro de estado."}
            </p>
          </div>
        ) : (
          <div className="stagger-children max-h-96 space-y-2 overflow-y-auto pr-1">
            {reports.map((r) => {
              const reason = reasonLabels[r.reason] ?? reasonLabels.other;
              const status = statusLabels[r.status] ?? statusLabels.open;
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-brand-ink text-xs font-semibold text-white">
                          {initials(r.reporterName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <p className="text-xs font-semibold">{r.reporterName}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {sourceLabels[r.source] ?? r.source}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", reason.color)}>
                        {reason.label}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.color)}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2 whitespace-pre-line rounded-md bg-muted/60 p-2 text-xs italic text-muted-foreground">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    {r.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleStatus(r.id, "reviewed")}
                      >
                        Marcar revisado
                      </Button>
                    )}
                    {r.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-chart-3 hover:bg-chart-3/10 hover:text-chart-3"
                        onClick={() => handleStatus(r.id, "resolved")}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Resolver
                      </Button>
                    )}
                    {r.status !== "open" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => handleStatus(r.id, "open")}
                      >
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Sub-components ----------

function UnitFilterBar({
  units,
  value,
  onChange,
  disabled,
}: {
  units: TeacherUnit[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="font-medium">Filtrar por unidad:</span>
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[260px]" size="sm">
          <SelectValue placeholder="Todas las unidades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_UNITS}>Todas las unidades</SelectItem>
          {units.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== ALL_UNITS && (
        <Badge variant="secondary" className="gap-1">
          <DynamicIcon name={units.find((u) => u.id === value)?.icon ?? "BookOpen"} className="h-3 w-3" />
          {units.find((u) => u.id === value)?.title ?? ""}
        </Badge>
      )}
    </div>
  );
}

function AggregateKpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          {icon}
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold tracking-tight">{value}</div>
          <div className="text-xs font-medium">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentRow({
  student,
  unitFilter,
  onSelect,
}: {
  student: Student;
  unitFilter: string;
  onSelect?: () => void;
}) {
  const acierto =
    student.totalAttempts > 0
      ? Math.round((student.correctAttempts / student.totalAttempts) * 100)
      : 0;

  // Dominio: si hay filtro, usar mastery de esa unidad; si no, promedio de mastery por unidad
  const mastery =
    unitFilter !== ALL_UNITS
      ? student.progressByUnit.find((p) => p.unitId === unitFilter)?.mastery ?? 0
      : student.progressByUnit.length > 0
        ? Math.round(
            student.progressByUnit.reduce((a, p) => a + p.mastery, 0) /
              student.progressByUnit.length
          )
        : 0;

  return (
    <TableRow
      onClick={onSelect}
      className={cn("transition-colors", onSelect && "cursor-pointer hover:bg-muted/50")}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border">
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
              {initials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{student.name}</p>
            <p className="truncate text-xs text-muted-foreground">{student.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <span className="inline-flex items-center gap-1 font-mono text-sm">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          {student.completedActivities}
        </span>
      </TableCell>
      <TableCell className="text-center font-mono text-sm">
        {student.totalAttempts}
      </TableCell>
      <TableCell className="text-center">
        <span
          className={cn(
            "inline-flex min-w-[3rem] justify-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
            aciertoBadge(acierto)
          )}
        >
          {acierto}%
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress
            value={mastery}
            className={cn("h-1.5 w-20 bg-muted", masteryIndicator(mastery))}
          />
          <span className={cn("font-mono text-xs font-semibold", aciertoClass(mastery))}>
            {mastery}%
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center font-mono text-sm text-muted-foreground">
        {formatHoursMinutes(student.totalTimeMin)}
      </TableCell>
      <TableCell className="pr-4 text-right">
        {student.lastActive ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className="h-3 w-3 text-amber-500" />
            {timeAgo(student.lastActive)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Users className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Aún no hay estudiantes con actividad</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Cuando el estudiantado comience a resolver actividades del piloto, verás aquí
            sus métricas de aprendizaje y progreso por unidad.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ---------- Tooltips (no `any` — structural typing) ----------

interface MasteryRow {
  unitTitle: string;
  unitColor: string;
  avgMastery: number;
}

function MasteryTooltip(props: {
  active?: boolean;
  payload?: { payload: MasteryRow }[];
}) {
  if (!props.active || !props.payload || props.payload.length === 0) return null;
  const row = props.payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: unitHex(row.unitColor) }}
        />
        <span className="font-medium">{row.unitTitle}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        Dominio promedio:{" "}
        <span className="font-mono font-semibold text-foreground">{row.avgMastery}%</span>
      </div>
    </div>
  );
}

interface DistributionRow {
  unitTitle: string;
  unitColor: string;
  low: number;
  mid: number;
  high: number;
}

function DistributionTooltip(props: {
  active?: boolean;
  payload?: { payload: DistributionRow }[];
}) {
  if (!props.active || !props.payload || props.payload.length === 0) return null;
  const row = props.payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2 font-medium">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: unitHex(row.unitColor) }}
        />
        {row.unitTitle}
      </div>
      <div className="mt-1.5 space-y-0.5 text-muted-foreground">
        <div>
          Alto (≥70%): <span className="font-mono font-semibold text-chart-3">{row.high}</span>
        </div>
        <div>
          Medio (40–69%): <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{row.mid}</span>
        </div>
        <div>
          Bajo (&lt;40%): <span className="font-mono font-semibold text-destructive">{row.low}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Hint Tooltip ----------

interface HintRow {
  name: string;
  hints: number;
  attempts: number;
}

function HintTooltip(props: {
  active?: boolean;
  payload?: { payload: HintRow }[];
}) {
  if (!props.active || !props.payload || props.payload.length === 0) return null;
  const row = props.payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-2)" }} />
        <span className="font-medium">{row.name}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        Pistas usadas: <span className="font-mono font-semibold text-foreground">{row.hints}</span>
      </div>
      <div className="text-muted-foreground">
        Intentos totales: <span className="font-mono font-semibold text-foreground">{row.attempts}</span>
      </div>
    </div>
  );
}

// ---------- CSV Export helper ----------

function exportStudentsCSV(students: Student[]) {
  const headers = [
    "Nombre",
    "Email",
    "Puntos",
    "Racha (días)",
    "Actividades completadas",
    "Intentos totales",
    "Intentos correctos",
    "Tasa de acierto (%)",
    "Dominio medio (%)",
    "Tiempo total (min)",
    "Última actividad",
  ];

  const rows = students.map((s) => {
    const acierto = s.totalAttempts > 0 ? Math.round((s.correctAttempts / s.totalAttempts) * 100) : 0;
    const mastery = s.progressByUnit.length > 0
      ? Math.round(s.progressByUnit.reduce((a, p) => a + p.mastery, 0) / s.progressByUnit.length)
      : 0;
    return [
      s.name,
      s.email,
      s.points,
      s.streak,
      s.completedActivities,
      s.totalAttempts,
      s.correctAttempts,
      acierto,
      mastery,
      s.totalTimeMin,
      s.lastActive ?? "—",
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `estudiantes-electromed-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
