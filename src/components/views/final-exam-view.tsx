"use client";

/**
 * Prueba de cierre del curso — examen de alternativas desbloqueable.
 *
 * Solo disponible cuando el estudiante completó TODAS las unidades (regla
 * server-side: Progress.completed >= total en cada unidad con actividades).
 * El docente configura preguntas, puntaje mínimo e intentos máximos desde el
 * Course Builder. La corrección es server-side (los índices correctos nunca
 * llegan al cliente).
 */

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { getUnitColor } from "@/lib/course-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { CourseStatus, FinalExamQuestion, FinalExamResult, Unit } from "@/lib/types";

interface FinalExamConfig {
  questions: FinalExamQuestion[];
  passScore: number;
  maxAttempts: number;
  attemptsUsed: number;
}

/** Skeleton de carga de la vista. */
function FinalExamSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 lg:p-8">
      <div className="space-y-3">
        <div className="skeleton h-8 w-72 max-w-full" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="skeleton h-40 w-full rounded-xl" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}

export function FinalExamView() {
  const navigate = useAppStore((s) => s.navigate);
  const { toast } = useToast();

  const {
    data: status,
    loading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useFetch<CourseStatus>("/api/course/status", []);

  // Solo se pide el examen cuando está desbloqueado y con intentos disponibles.
  const examReady = Boolean(
    status &&
      status.allUnitsCompleted &&
      status.finalExam.configured &&
      !status.finalExam.passed &&
      status.finalExam.attemptsUsed < status.finalExam.maxAttempts
  );
  const {
    data: exam,
    loading: examLoading,
    error: examError,
    refetch: refetchExam,
  } = useFetch<FinalExamConfig>(examReady ? "/api/course/final-exam" : null, [examReady]);

  const [selections, setSelections] = React.useState<Record<number, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<FinalExamResult | null>(null);

  // Reset de selecciones al cargar un examen nuevo (reintento).
  const [loadedFor, setLoadedFor] = React.useState<FinalExamConfig | null>(null);
  if (exam !== loadedFor) {
    setLoadedFor(exam);
    setSelections({});
    setResult(null);
  }

  if (statusLoading || !status) {
    if (statusError) {
      return (
        <div className="mx-auto max-w-4xl space-y-8 p-4 lg:p-8">
          <PageHeader title="Prueba de cierre" />
          <FetchError description={statusError} onRetry={refetchStatus} />
        </div>
      );
    }
    return <FinalExamSkeleton />;
  }

  const totalQuestions = exam?.questions.length ?? 0;
  const allAnswered =
    totalQuestions > 0 && exam!.questions.every((_, idx) => selections[idx] !== undefined);

  const handleSubmit = async () => {
    if (!exam || !allAnswered) return;
    setSubmitting(true);
    try {
      const res = await postJSON<FinalExamResult>("/api/course/final-exam", {
        answers: exam.questions.map((_, idx) => selections[idx]),
      });
      setResult(res);
      refetchStatus();
    } catch (err) {
      toast({
        title: "Error al enviar la prueba",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    refetchStatus();
    refetchExam();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 lg:p-8">
      <PageHeader
        title="Prueba de cierre"
        description="Examen final del curso: se desbloquea al completar todas las unidades."
        icon="GraduationCap"
        iconGradient="from-brand to-brand/70"
      />

      {/* ---------- Estado bloqueado: faltan unidades ---------- */}
      {!status.allUnitsCompleted && <LockedView />}

      {/* ---------- Examen no configurado por el docente ---------- */}
      {status.allUnitsCompleted && !status.finalExam.configured && (
        <Card className="border-border p-8 text-center shadow-sm animate-fade-in-up">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Prueba de cierre no configurada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Completaste todas las unidades. El docente aún no configura la prueba de cierre.
          </p>
        </Card>
      )}

      {/* ---------- Ya aprobada ---------- */}
      {status.allUnitsCompleted && status.finalExam.passed && (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.04] p-8 text-center shadow-sm animate-fade-in-up">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold">¡Prueba de cierre aprobada!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Completaste el curso. Tu mejor puntaje:
          </p>
          <p className="mt-3 font-mono text-5xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {status.finalExam.bestScore}
            <span className="text-xl text-muted-foreground">/100</span>
          </p>
        </Card>
      )}

      {/* ---------- Intentos agotados ---------- */}
      {status.allUnitsCompleted &&
        status.finalExam.configured &&
        !status.finalExam.passed &&
        status.finalExam.attemptsUsed >= status.finalExam.maxAttempts && (
          <Card className="border-border p-8 text-center shadow-sm animate-fade-in-up">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h3 className="text-lg font-semibold">Sin intentos disponibles</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Usaste tus {status.finalExam.maxAttempts} intentos
              {status.finalExam.bestScore !== null && (
                <> · Mejor puntaje: <span className="font-mono tabular-nums">{status.finalExam.bestScore}/100</span></>
              )}
              . Consulta con tu docente.
            </p>
          </Card>
        )}

      {/* ---------- Examen activo ---------- */}
      {examReady && (
        <>
          {examLoading && <FinalExamSkeleton />}
          {examError && <FetchError description={examError} onRetry={refetchExam} />}
          {exam && !result && (
            <div className="space-y-6 animate-fade-in-up">
              <Card className="flex flex-col gap-2 border-border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Responde las {exam.questions.length} preguntas. Apruebas con{" "}
                  <span className="font-mono font-semibold tabular-nums text-foreground">{exam.passScore}</span>
                  /100 o más.
                </div>
                <Badge variant="outline" className="w-fit">
                  Intento <span className="ml-1 font-mono tabular-nums">{exam.attemptsUsed + 1}</span> de{" "}
                  <span className="ml-1 font-mono tabular-nums">{exam.maxAttempts}</span>
                </Badge>
              </Card>

              {exam.questions.map((q, idx) => (
                <Card key={idx} className="space-y-4 border-border p-5 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">
                    {idx + 1}. {q.question}
                  </p>
                  <RadioGroup
                    value={selections[idx] !== undefined ? String(selections[idx]) : undefined}
                    onValueChange={(val) => setSelections({ ...selections, [idx]: Number(val) })}
                    disabled={submitting}
                  >
                    {q.options.map((opt, oidx) => (
                      <div key={oidx} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50">
                        <RadioGroupItem value={String(oidx)} id={`q${idx}-o${oidx}`} />
                        <Label htmlFor={`q${idx}-o${oidx}`} className="flex-1 cursor-pointer text-sm font-normal">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </Card>
              ))}

              <div className="flex flex-col items-center gap-2">
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting || !allAnswered}
                  className="w-full font-semibold sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando prueba…
                    </>
                  ) : (
                    "Enviar prueba de cierre"
                  )}
                </Button>
                {!allAnswered && (
                  <p className="text-xs text-muted-foreground">
                    Responde todas las preguntas para poder enviar.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ---------- Resultado del intento ---------- */}
          {exam && result && (
            <Card className="space-y-6 border-border p-8 text-center shadow-sm animate-fade-in-up">
              {result.passed ? (
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
              )}
              <div>
                <p className="font-mono text-6xl font-bold tabular-nums">
                  {result.score}
                  <span className="text-2xl text-muted-foreground">/100</span>
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {result.passed ? "¡Aprobaste la prueba de cierre!" : "No alcanzaste el puntaje mínimo"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.correctCount} de {result.totalQuestions} correctas · Puntaje mínimo:{" "}
                  <span className="font-mono tabular-nums">{exam.passScore}/100</span>
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                {!result.passed && result.attemptsUsed < result.maxAttempts && (
                  <Button onClick={handleRetry}>
                    <RotateCcw className="h-4 w-4" />
                    Reintentar ({result.maxAttempts - result.attemptsUsed}{" "}
                    {result.maxAttempts - result.attemptsUsed === 1 ? "intento restante" : "intentos restantes"})
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("dashboard")}>
                  Volver al inicio
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** Vista bloqueada: mensaje + progreso por unidad hacia el desbloqueo. */
function LockedView() {
  const openUnit = useAppStore((s) => s.openUnit);
  const { data } = useFetch<{ units: Unit[] }>("/api/units", []);
  const units = data?.units ?? [];

  return (
    <Card className="space-y-5 border-border p-6 shadow-sm animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Aún no puedes rendir la prueba de cierre</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Se desbloquea cuando completes todas las actividades de todas las unidades del curso.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {units.map((u) => {
          const color = getUnitColor(u.color);
          const completed = u.progress?.completed ?? 0;
          const total = u.progress?.total ?? u.activityCount ?? 0;
          const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
          const done = total > 0 && completed >= total;
          return (
            <button
              key={u.id}
              onClick={() => openUnit(u.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${color.gradient}`}>
                <DynamicIcon name={u.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{u.title}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {completed}/{total}
                  </span>
                </div>
                <Progress value={pct} className="mt-1.5 h-1.5" />
              </div>
              {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
