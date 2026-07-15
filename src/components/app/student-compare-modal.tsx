"use client";

import * as React from "react";
import { useFetch } from "@/hooks/use-fetch";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, GitCompare, Trophy, Flame, Sparkles, Clock, Target, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, getUnitColor } from "@/lib/course-utils";

interface CompareStudent {
  id: string;
  name: string;
  email: string;
  points: number;
  streak: number;
  totalAttempts: number;
  correctAttempts: number;
  completedActivities: number;
  totalTimeMin: number;
  chatCount: number;
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
  const { data } = useFetch<TeacherStudentsResponse>("/api/teacher", []);
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
          <div className="shrink-0 border-b border-border bg-gradient-to-br from-slate-50 to-slate-100 p-5 dark:from-slate-900/50 dark:to-slate-900/30">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-600 text-white">
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
                    <SelectItem key={s.id} value={s.id} disabled={s.id === studentBId}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={studentBId} onValueChange={setStudentBId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Estudiante B" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.id === studentAId}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison */}
          <div className="flex-1 overflow-y-auto p-4">
            {studentA && studentB ? (
              <ComparisonContent a={studentA} b={studentB} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <GitCompare className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Selecciona dos estudiantes</p>
                <p className="text-xs text-muted-foreground">Elige ambos para ver la comparación</p>
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
    { label: "Consultas IA", icon: <Sparkles className="h-3.5 w-3.5" />, valueA: a.chatCount, valueB: b.chatCount, higherIsBetter: true, isNumber: true },
    { label: "Pistas usadas", icon: <Target className="h-3.5 w-3.5" />, valueA: a.totalHintsUsed, valueB: b.totalHintsUsed, higherIsBetter: false, isNumber: true },
  ];

  return (
    <div className="space-y-4">
      {/* Headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <StudentHeader student={a} color="emerald" />
        <span className="text-xs font-semibold text-muted-foreground">VS</span>
        <StudentHeader student={b} color="violet" />
      </div>

      <Separator />

      {/* Comparison rows */}
      <div className="space-y-1">
        {rows.map((row, i) => {
          const aWins = row.isNumber
            ? (Number(row.valueA) > Number(row.valueB) && row.higherIsBetter) || (Number(row.valueA) < Number(row.valueB) && !row.higherIsBetter)
            : false;
          const bWins = row.isNumber
            ? (Number(row.valueB) > Number(row.valueA) && row.higherIsBetter) || (Number(row.valueB) < Number(row.valueA) && !row.higherIsBetter)
            : false;
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/30">
              <div className={cn("text-right text-sm font-medium tabular-nums", aWins && "text-emerald-600 dark:text-emerald-400")}>
                {row.valueA}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {row.icon}
                <span className="hidden sm:inline">{row.label}</span>
              </div>
              <div className={cn("text-left text-sm font-medium tabular-nums", bWins && "text-violet-600 dark:text-violet-400")}>
                {row.valueB}
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Unit mastery comparison */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dominio por unidad</p>
        <div className="space-y-2">
          {a.progressByUnit.map((unitA, i) => {
            const unitB = b.progressByUnit.find((p) => p.unitId === unitA.unitId);
            if (!unitB) return null;
            const color = getUnitColor(unitA.unitColor);
            return (
              <div key={unitA.unitId} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs font-medium tabular-nums">{unitA.mastery}%</span>
                  <Progress value={unitA.mastery} className={cn("h-1.5 w-16", color.bg)} />
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{unitA.unitTitle}</span>
                <div className="flex items-center gap-2">
                  <Progress value={unitB.mastery} className={cn("h-1.5 w-16", color.bg)} />
                  <span className="text-xs font-medium tabular-nums">{unitB.mastery}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StudentHeader({ student, color }: { student: CompareStudent; color: "emerald" | "violet" }) {
  const colorMap = {
    emerald: "from-emerald-500 to-teal-600",
    violet: "from-violet-500 to-purple-600",
  };
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className={cn("bg-gradient-to-br text-[10px] font-bold text-white", colorMap[color])}>
          {initials(student.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{student.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{student.email}</p>
      </div>
    </div>
  );
}
