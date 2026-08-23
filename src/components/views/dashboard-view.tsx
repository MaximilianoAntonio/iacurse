"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { UnitCard, unitProgressStatus } from "@/components/views/unit-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BookOpen, CheckCircle2, ArrowRight, GraduationCap, Lock } from "lucide-react";
import type { CourseStatus, Unit, User } from "@/lib/types";

/** Skeleton de carga del panel: replica la estructura hero + grid con shimmer. */
function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton mt-4 h-10 w-72 max-w-full" />
        <div className="skeleton mt-3 h-4 w-full max-w-xl" />
        <div className="skeleton mt-6 h-9 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="skeleton h-11 w-11 rounded-lg" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton mt-2 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const navigate = useAppStore((s) => s.navigate);
  const openUnit = useAppStore((s) => s.openUnit);

  const { data, loading, error, refetch } = useFetch<{ units: Unit[] }>(
    `/api/units`,
    []
  );

  // Estado de la prueba de cierre (solo aplica a estudiantes).
  const isStudent = currentUser?.role === "student";
  const { data: courseStatus } = useFetch<CourseStatus>(
    isStudent ? "/api/course/status" : null,
    [isStudent]
  );

  if (error) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8 animate-fade-in-up">
        <PageHeader title="Panel" />
        <FetchError
          title="No se pudo cargar tu panel"
          description={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  const units = data.units;
  const totalUnits = units.length;
  const completedUnits = units.filter((u) => unitProgressStatus(u) === "completed").length;
  // Progreso global real: actividades completadas sobre el total del curso
  const totalActivities = units.reduce((acc, u) => acc + (u.progress?.total ?? u.activityCount ?? 0), 0);
  const completedActivities = units.reduce((acc, u) => acc + (u.progress?.completed ?? 0), 0);
  const pctGlobal = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
      {/* Bienvenida — panel de instrumento: porcelana, tinta y una señal dorada */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8 animate-fade-in-up">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="border-brand-gold/40 bg-brand-gold/10 text-foreground">
              <Sparkles className="mr-1 h-3 w-3 text-brand-gold" />
              Piloto de innovación docente · UVA24991
            </Badge>
            <h1 className="text-display font-bold">
              Hola, {currentUser?.name.split(" ")[0]}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Continúa tu aprendizaje adaptativo en <strong className="text-foreground">Electromedicina II</strong>.
              La IA nivela los contenidos de cada unidad a partir de tus respuestas de diagnóstico.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button onClick={() => navigate("units")} size="sm">
                <BookOpen className="mr-1.5 h-4 w-4" />
                Explorar unidades
              </Button>
            </div>
          </div>

          {/* Stats compactas — mono solo para los datos medidos */}
          <dl className="grid shrink-0 grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
              <dt className="text-xs text-muted-foreground">Unidades completadas</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {completedUnits}<span className="text-muted-foreground">/{totalUnits}</span>
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
              <dt className="text-xs text-muted-foreground">Progreso global</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{pctGlobal}%</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* CTA de la prueba de cierre (solo estudiantes, si está configurada) */}
      {isStudent && courseStatus?.finalExam.configured && (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in-up sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              courseStatus.finalExam.passed
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : courseStatus.allUnitsCompleted
                  ? "bg-brand-gold/15 text-brand-ink dark:text-brand-gold"
                  : "bg-muted text-muted-foreground"
            }`}>
              {courseStatus.finalExam.passed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : courseStatus.allUnitsCompleted ? (
                <GraduationCap className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="font-semibold">
                {courseStatus.finalExam.passed
                  ? "Prueba de cierre aprobada"
                  : courseStatus.allUnitsCompleted
                    ? "¡Prueba de cierre disponible!"
                    : "Prueba de cierre"}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {courseStatus.finalExam.passed
                  ? `Completaste el curso con un puntaje de ${courseStatus.finalExam.bestScore}/100.`
                  : courseStatus.allUnitsCompleted
                    ? `Completaste todas las unidades. Aprueba con ${courseStatus.finalExam.passScore}/100 o más.`
                    : "Se desbloquea al completar todas las unidades del curso."}
              </p>
            </div>
          </div>
          <Button
            variant={courseStatus.allUnitsCompleted && !courseStatus.finalExam.passed ? "default" : "outline"}
            size="sm"
            onClick={() => navigate("final-exam")}
            className="shrink-0"
          >
            {courseStatus.finalExam.passed ? "Ver resultado" : courseStatus.allUnitsCompleted ? "Rendir prueba" : "Ver progreso"}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </section>
      )}

      {/* Grid de unidades del estudiante */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title font-semibold">Tus unidades temáticas</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("units")} className="text-brand hover:bg-brand/5 dark:text-brand-gold dark:hover:bg-brand-gold/10">
            Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <UnitCard key={u.id} unit={u} onOpen={openUnit} />
          ))}
        </div>
      </section>

      {/* Nota de orientación */}
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-brand/25 bg-brand/[0.04] p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:text-brand-gold">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-brand dark:text-brand-gold">¿Qué debes hacer?</p>
          <p className="text-xs text-muted-foreground">
            Selecciona una unidad temática para comenzar. En cada una puedes personalizar el contenido con IA según tu diagnóstico inicial del curso, o continuar directamente a las lecciones. Al completar todas las unidades se desbloquea la prueba de cierre.
          </p>
        </div>
      </div>
    </div>
  );
}
