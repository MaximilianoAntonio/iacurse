"use client";

import { useEffect, useMemo, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingRows } from "@/components/app/loading";
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
import {
  Users,
  Target,
  MessageSquare,
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
  chatCount: number;
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
  totalChatQueries: number;
  totalStudyHours: number;
}

interface TeacherResponse {
  students: Student[];
  units: TeacherUnit[];
  aggregate: Aggregate;
}

// ---------- Visual config ----------

const chartColors: Record<string, string> = {
  emerald: "#003366",
  sky: "#0066AA",
  amber: "#f59e0b",
  violet: "#fbbf24",
  rose: "#c0392b",
};

function unitHex(color: string): string {
  return chartColors[color] ?? chartColors.emerald;
}

function formatHoursMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function aciertoClass(pct: number): string {
  if (pct >= 70) return "text-[#003366] dark:text-amber-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function aciertoBadge(pct: number): string {
  if (pct >= 70)
    return "bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400";
  if (pct >= 40)
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
}

// ---------- Main component ----------

const ALL_UNITS = "all";

export function TeacherView() {
  const [unitFilter, setUnitFilter] = useState<string>(ALL_UNITS);

  const url =
    unitFilter === ALL_UNITS
      ? `/api/teacher`
      : `/api/teacher?unitId=${unitFilter}`;

  const { data, loading } = useFetch<TeacherResponse>(url, [unitFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Panel docente"
        icon="Users"
        iconGradient="from-[#003366] to-[#004488]"
        description="Seguimiento del aprendizaje del estudiantado en el piloto de Electromedicina II."
      />

      {loading || !data ? (
        <div className="space-y-6">
          <UnitFilterBar
            units={[]}
            value={unitFilter}
            onChange={setUnitFilter}
            disabled
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 pt-6">
                  <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
                  <div className="h-6 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              <LoadingRows count={5} />
            </CardContent>
          </Card>
        </div>
      ) : data.students.length === 0 ? (
        <EmptyState />
      ) : (
        <TeacherDashboard data={data} unitFilter={unitFilter} onUnitFilterChange={setUnitFilter} />
      )}
    </div>
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

      {/* Section 1: Métricas agregadas */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AggregateKpi
          icon={<Users className="h-5 w-5" />}
          label="Estudiantes activos"
          value={aggregate.totalStudents.toString()}
          sub="Inscritos en el piloto"
          tone="slate"
        />
        <AggregateKpi
          icon={<Target className="h-5 w-5" />}
          label="Intentos totales"
          value={aggregate.totalAttempts.toLocaleString("es-CL")}
          sub="Actividades resueltas"
          tone="sky"
        />
        <AggregateKpi
          icon={<MessageSquare className="h-5 w-5" />}
          label="Consultas al tutor"
          value={aggregate.totalChatQueries.toLocaleString("es-CL")}
          sub="Preguntas al tutor IA"
          tone="violet"
        />
        <AggregateKpi
          icon={<Clock className="h-5 w-5" />}
          label="Horas de estudio"
          value={`${aggregate.totalStudyHours}h`}
          sub="Tiempo total invertido"
          tone="emerald"
        />
      </section>

      {/* Section 2: Dominio promedio por unidad */}
      {aggregate.avgMasteryByUnit.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    type="category"
                    dataKey="unitTitle"
                    width={190}
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
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

      {/* Section 3: Tabla de estudiantes */}
      <Card>
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
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[220px] pl-4">Estudiante</TableHead>
                  <TableHead className="text-center border-l border-border/40">Actividades</TableHead>
                  <TableHead className="text-center border-l border-border/40">Intentos</TableHead>
                  <TableHead className="text-center border-l border-border/40">Acierto</TableHead>
                  <TableHead className="min-w-[140px] border-l border-border/40">Dominio medio</TableHead>
                  <TableHead className="text-center border-l border-border/40">Tiempo</TableHead>
                  <TableHead className="text-center border-l border-border/40">Consultas IA</TableHead>
                  <TableHead className="text-right pr-4">Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      {studentSearch ? `Sin resultados para "${studentSearch}"` : "No hay estudiantes."}
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

      {/* Section 4: Distribución de mastery por unidad */}
      {distributionByUnit.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis
                    type="category"
                    dataKey="unitTitle"
                    width={190}
                    tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    content={<DistributionTooltip />}
                  />
                  <Bar dataKey="low" stackId="a" name="Bajo (<40%)" fill="#c0392b" barSize={22} />
                  <Bar dataKey="mid" stackId="a" name="Medio (40–69%)" fill="#f59e0b" barSize={22} />
                  <Bar dataKey="high" stackId="a" name="Alto (≥70%)" fill="#003366" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              <LegendDot color="#003366" label="Alto (≥70%)" />
              <LegendDot color="#f59e0b" label="Medio (40–69%)" />
              <LegendDot color="#c0392b" label="Bajo (<40%)" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4b: Analítica de uso de pistas */}
      {students.some((s) => s.totalHintsUsed > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} content={<HintTooltip />} />
                  <Bar dataKey="hints" name="Pistas usadas" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Pistas usadas
              </span>
              <span>·</span>
              <span>Estudiantes sin pistas no se muestran</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 5: Reportes de errores de IA */}
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

interface ErrorReportItem {
  id: string;
  source: string;
  sourceId: string | null;
  reason: string;
  comment: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatar: string | null };
}

const reasonLabels: Record<string, { label: string; color: string }> = {
  incorrect: { label: "Respuesta incorrecta", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  biased: { label: "Contenido sesgado", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  offtopic: { label: "Fuera de tema", color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  harmful: { label: "Contenido inapropiado", color: "text-red-700 bg-red-50 dark:bg-red-950/40" },
  other: { label: "Otro", color: "text-slate-600 bg-slate-50 dark:bg-slate-950/40" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  open: { label: "Pendiente", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  reviewed: { label: "Revisado", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  resolved: { label: "Resuelto", color: "bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400" },
};

function ErrorReportsSection() {
  const { data, loading, refetch } = useFetch<{ reports: ErrorReportItem[] }>("/api/report?status=open", []);

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Flag className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Reportes de errores de IA</CardTitle>
              <CardDescription>
                Respuestas del tutor reportadas por el estudiantado para revisión docente.
              </CardDescription>
            </div>
          </div>
          {reports.length > 0 && (
            <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {reports.length} pendiente{reports.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#003366]/5 text-[#003366] dark:bg-[#003366]/20/40 dark:text-amber-400">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Sin reportes pendientes</p>
            <p className="text-xs text-muted-foreground">No hay respuestas de IA reportadas para revisar.</p>
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {reports.map((r) => {
              const reason = reasonLabels[r.reason] ?? reasonLabels.other;
              const status = statusLabels[r.status] ?? statusLabels.open;
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border p-3 transition-colors hover:bg-accent/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-gradient-to-br from-[#003366] to-[#0066AA] text-[9px] font-bold text-white">
                          {initials(r.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <p className="text-xs font-semibold">{r.user.name}</p>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${reason.color}`}>
                        {reason.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs italic text-muted-foreground">
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => handleStatus(r.id, "reviewed")}
                    >
                      Marcar revisado
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] text-[#003366] hover:bg-[#003366]/5 hover:text-[#003366]"
                      onClick={() => handleStatus(r.id, "resolved")}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Resolver
                    </Button>
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

const kpiTones: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  violet: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  emerald: "bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400",
};

function AggregateKpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            kpiTones[tone]
          )}
        >
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
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
      className={cn("transition-colors", onSelect && "cursor-pointer hover:bg-accent/50")}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border">
            <AvatarFallback className="bg-muted text-[11px] font-medium text-muted-foreground">
              {initials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{student.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{student.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center border-l border-border/40">
        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          {student.completedActivities}
        </span>
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums border-l border-border/40">
        {student.totalAttempts}
      </TableCell>
      <TableCell className="text-center border-l border-border/40">
        <span
          className={cn(
            "inline-flex min-w-[3rem] justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
            aciertoBadge(acierto)
          )}
        >
          {acierto}%
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={mastery} className="h-1.5 w-20" />
          <span className={cn("text-xs font-semibold tabular-nums", aciertoClass(mastery))}>
            {mastery}%
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
        {formatHoursMinutes(student.totalTimeMin)}
      </TableCell>
      <TableCell className="text-center border-l border-border/40">
        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          {student.chatCount}
        </span>
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Aún no hay estudiantes con actividad</p>
          <p className="text-xs text-muted-foreground">
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
        <span className="font-semibold text-foreground">{row.avgMastery}%</span>
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
          Alto (≥70%): <span className="font-semibold text-[#003366] dark:text-amber-400">{row.high}</span>
        </div>
        <div>
          Medio (40–69%): <span className="font-semibold text-amber-600 dark:text-amber-400">{row.mid}</span>
        </div>
        <div>
          Bajo (&lt;40%): <span className="font-semibold text-rose-600 dark:text-rose-400">{row.low}</span>
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
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        <span className="font-medium">{row.name}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        Pistas usadas: <span className="font-semibold text-foreground">{row.hints}</span>
      </div>
      <div className="text-muted-foreground">
        Intentos totales: <span className="font-semibold text-foreground">{row.attempts}</span>
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
    "Consultas IA",
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
      s.chatCount,
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
