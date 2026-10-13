"use client";

/**
 * Diagnóstico inicial del curso — módulo obligatorio para estudiantes.
 *
 * Vista dentro del AppShell (mismo patrón que la prueba de cierre): item
 * propio en el sidebar y tarjeta de estado en el dashboard. Mientras está
 * pendiente, ``page.tsx`` fuerza esta vista (forceView) para que el
 * estudiante no pueda salir del módulo. Las respuestas alimentan la
 * adaptación por IA de cada unidad; una vez enviado queda completado y
 * solo se repite si el docente edita las preguntas.
 */

import { useState } from "react";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { postJSON, useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CourseStatus } from "@/lib/types";

interface CourseDiagnosticViewProps {
  /** Se invoca tras un envío exitoso (además del refetch local) para que el
   * gate de page.tsx refresque el estado del curso. */
  onSubmitted?: () => void;
}

export function CourseDiagnosticView({ onSubmitted }: CourseDiagnosticViewProps) {
  const {
    data: courseStatus,
    loading: statusLoading,
    error: statusError,
    refetch,
  } = useFetch<CourseStatus>("/api/course/status", []);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (statusError) {
    return (
      <FetchError
        title="No se pudo cargar el diagnóstico"
        description={statusError}
        onRetry={refetch}
      />
    );
  }

  if (statusLoading || !courseStatus) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 p-4 lg:p-8">
        <div className="skeleton h-8 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const questions = courseStatus.diagnosticQuestions ?? [];
  const completed = courseStatus.diagnosticCompleted;
  const allAnswered = questions.every(
    (_, idx) => (answers[idx] || "").trim().length > 0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered) return;
    setError(null);
    setLoading(true);
    try {
      await postJSON("/api/course/diagnostic", {
        answers: questions.map((q, idx) => ({ question: q, answer: answers[idx] })),
      });
      refetch();
      // Avisar a page.tsx para que refresque /api/course/status y levante el
      // forceView del módulo obligatorio.
      onSubmitted?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el diagnóstico."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 lg:p-8">
      <PageHeader
        title="Diagnóstico inicial"
        description="Antes de comenzar el curso necesitamos conocerte: tus respuestas describen tu experiencia previa y tus expectativas, y la plataforma las usa para personalizar con IA el contenido de cada unidad a tu nivel. No hay respuestas correctas ni incorrectas."
        icon="Stethoscope"
      />

      {completed ? (
        <section className="flex items-start gap-4 rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">Diagnóstico inicial completado</h2>
            <p className="text-sm text-muted-foreground">
              Tus respuestas ya están registradas y alimentan la personalización
              con IA de cada unidad. Solo tendrás que repetirlo si el docente
              actualiza las preguntas del diagnóstico.
            </p>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="stagger-children space-y-5">
          <p className="text-sm text-muted-foreground">
            Responde con honestidad y detalle. Este módulo es obligatorio para
            acceder a las unidades del curso.
          </p>
          {questions.map((q, idx) => (
            <div
              key={idx}
              className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <label
                htmlFor={`diagnostic-q-${idx}`}
                className="block text-sm font-semibold text-foreground"
              >
                {idx + 1}. {q}
              </label>
              <Textarea
                id={`diagnostic-q-${idx}`}
                value={answers[idx] || ""}
                onChange={(e) => setAnswers({ ...answers, [idx]: e.target.value })}
                placeholder="Escribe tu respuesta aquí..."
                className="min-h-[90px]"
                disabled={loading}
              />
            </div>
          ))}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in"
            >
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading || !allAnswered}
            className="w-full font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando diagnóstico…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar diagnóstico
              </>
            )}
          </Button>
          {!allAnswered && (
            <p className="text-center text-xs text-muted-foreground">
              Responde todas las preguntas para poder enviar.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
