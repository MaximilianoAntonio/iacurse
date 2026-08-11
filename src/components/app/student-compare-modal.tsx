"use client";

import * as React from "react";
import { useFetch } from "@/hooks/use-fetch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, Trophy, Flame, Sparkles, Clock, Target, CheckCircle2, AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials, getUnitColor } from "@/lib/course-utils";

interface CompareStudent {
  id: string;
  /** Código anonimizado del estudiante (sin email ni nombre real). */
  studentCode: string | null;
  points: number;
  streak: number;
  totalAttempts: number;
  correctAttempts: number;
  completedActivities: number;
  totalTimeMin: number;
  avgScore: number;
  totalHintsUsed: number;
  progressByUnit: { unitId: string; unitTitle: string; unitColor: string; completed: number; total: number; mastery: number }[];
}

interface TeacherStudentsResponse {
  students: CompareStudent[];
}

interface StudentCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentCompareModal({ open, onOpenChange }: StudentCompareModalProps) {
  const { data, loading, error, refetch } = useFetch<TeacherStudentsResponse>(
    open ? "/api/teacher" : null,
    [open]
  );
  const [studentAId, setStudentAId] = React.useState<string>("");
  const [studentBId, setStudentBId] = React.useState<string>("");

  const students = data?.students ?? [];
  const studentA = students.find((s) => s.id === studentAId);
  const studentB = students.find((s) => s.id === studentBId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Comparar estudiantes</DialogTitle>
        <div className="flex max-h-[90vh] flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-border bg-muted/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
                <GitCompare className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Comparar estudiantes</h2>
                <p className="text-xs text-muted-foreground">Selecciona dos estudiantes para comparar su rendimiento</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Select value={studentAId} onValueChange={setStudentAId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Estudiante A" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.id === studentBId}>{s.studentCode ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={studentBId} onValueChange={setStudentBId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Estudiante B" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.id === studentAId}>{s.studentCode ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && !data ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">No se pudo cargar la lista de estudiantes</p>
                <p className="text-xs text-muted-foreground">Revisa tu conexión e inténtalo nuevamente.</p>
                <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
                  <RotateCw className="h-3.5 w-3.5" />
                  Reintentar
                </Button>
              </div>
            ) : loading && !data ? (
              <div className="space-y-3" aria-busy="true" aria-label="Cargando estudiantes">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-10" />
                ))}
              </div>
            ) : studentA && studentB ? (
              <ComparisonContent a={studentA} b={studentB} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <GitCompare className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">Selecciona dos estudiantes</p>
                <p className="text-xs text-muted-foreground">Elige ambos para ver la comparación lado a lado.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonContent({ a, b }: { a: CompareStudent; b: CompareStudent }) {
  const rows: { label: string; icon: React.ReactNode; valueA: string | number; valueB: string | number; higherIsBetter: boolean; isNumber?: boolean }[] = [
    { label: "Puntos", icon: <Sparkles className="h-3.5 w-3.5" />, valueA: a.points, valueB: b.points, higherIsBetter: true, isNumber: true },
    { label: "Racha (días)", icon: <Flame className="h-3.5 w-3.5" />, valueA: a.streak, valueB: b.streak, higherIsBetter: true, isNumber: true },
    { label: "Actividades completadas", icon: <CheckCircle2 className="h-3.5 w-3.5" />, valueA: a.completedActivities, valueB: b.completedActivities, higherIsBetter: true, isNumber: true },
    { label: "Intentos totales", icon: <Target className="h-3.5 w-3.5" />, valueA: a.totalAttempts, valueB: b.totalAttempts, higherIsBetter: false, isNumber: true },
    { label: "Tasa de acierto", icon: <Trophy className="h-3.5 w-3.5" />, valueA: `${a.totalAttempts > 0 ? Math.round((a.correctAttempts / a.totalAttempts) * 100) : 0}%`, valueB: `${b.totalAttempts > 0 ? Math.round((b.correctAttempts / b.totalAttempts) * 100) : 0}%`, higherIsBetter: true },
    { label: "Tiempo de estudio", icon: <Clock className="h-3.5 w-3.5" />, valueA: `${a.totalTimeMin}m`, valueB: `${b.totalTimeMin}m`, higherIsBetter: true },
    { label: "Pistas usadas", icon: <Target className="h-3.5 w-3.5" />, valueA: a.totalHintsUsed, valueB: b.totalHintsUsed, higherIsBetter: false, isNumber: true },
  ];

  return (
    <div className="space-y-4">
      {/* Headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <StudentHeader student={a} side="a" />
        <span className="font-mono text-xs font-semibold text-muted-foreground">VS</span>
        <StudentHeader student={b} side="b" />
      </div>

      <Separator />

      {/* Comparison rows: el valor ganador se marca con el verde monitor */}
      <div className="stagger-children space-y-1">
        {rows.map((row, i) => {
          const aWins = row.isNumber
            ? (Number(row.valueA) > Number(row.valueB) && row.higherIsBetter) || (Number(row.valueA) < Number(row.valueB) && !row.higherIsBetter)
            : false;
          const bWins = row.isNumber
            ? (Number(row.valueB) > Number(row.valueA) && row.higherIsBetter) || (Number(row.valueB) < Number(row.valueA) && !row.higherIsBetter)
            : false;
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
              <div className={cn("text-right font-mono text-sm font-medium", aWins && "font-semibold text-chart-3")}>
                {row.valueA}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {row.icon}
                <span className="hidden sm:inline">{row.label}</span>
              </div>
              <div className={cn("text-left font-mono text-sm font-medium", bWins && "font-semibold text-chart-3")}>
                {row.valueB}
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Unit mastery comparison */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Dominio por unidad</p>
        <div className="space-y-2">
          {a.progressByUnit.map((unitA) => {
            const unitB = b.progressByUnit.find((p) => p.unitId === unitA.unitId);
            if (!unitB) return null;
            const color = getUnitColor(unitA.unitColor);
            return (
              <div key={unitA.unitId} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center justify-end gap-2">
                  <span className="font-mono text-xs font-medium">{unitA.mastery}%</span>
                  <Progress value={unitA.mastery} className={cn("h-1.5 w-16", color.bg)} />
                </div>
                <span className="max-w-[100px] truncate text-xs text-muted-foreground">{unitA.unitTitle}</span>
                <div className="flex items-center gap-2">
                  <Progress value={unitB.mastery} className={cn("h-1.5 w-16", color.bg)} />
                  <span className="font-mono text-xs font-medium">{unitB.mastery}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentHeader({ student, side }: { student: CompareStudent; side: "a" | "b" }) {
  // A: tinta azul de marca; B: ámbar de señal, para distinguir lados sin salir de la paleta
  const gradient = side === "a" ? "from-brand to-brand-ink" : "from-amber-400 to-amber-600";
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className={cn("bg-gradient-to-br text-xs font-bold text-white", gradient)}>
          {initials(student.studentCode ?? "?")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold">{student.studentCode ?? "—"}</p>
      </div>
    </div>
  );
}
