"use client";

/**
 * Diagnóstico inicial del curso — obligatorio para estudiantes al primer uso.
 *
 * Pantalla completa (sin AppShell) con la misma estética del login y del
 * cambio obligatorio de contraseña: panel de marca en tinta azul y
 * formulario sobre porcelana. No se puede saltar: las respuestas alimentan
 * la adaptación por IA de cada unidad del curso. Al enviar con éxito se
 * invoca ``onCompleted`` y el gate de ``page.tsx`` deja pasar a la app.
 */

import { useState } from "react";
import { Brain, Loader2, Send, XCircle } from "lucide-react";
import { postJSON } from "@/hooks/use-fetch";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CourseDiagnosticViewProps {
  questions: string[];
  onCompleted: () => void;
}

export function CourseDiagnosticView({
  questions,
  onCompleted,
}: CourseDiagnosticViewProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allAnswered = questions.every((_, idx) => (answers[idx] || "").trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered) return;
    setError(null);
    setLoading(true);
    try {
      await postJSON("/api/course/diagnostic", {
        answers: questions.map((q, idx) => ({ question: q, answer: answers[idx] })),
      });
      onCompleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el diagnóstico."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---------- Panel de marca (tinta azul, solo ≥ lg) ---------- */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-ink p-12 text-sidebar-foreground animate-fade-in lg:flex xl:p-16">
        {/* Retícula técnica del panel de instrumento */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(241 245 250 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(241 245 250 / 0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10 shadow-sm" />
          <span className="font-display text-lg font-bold tracking-tight">
            CAAMI
          </span>
        </div>

        <div className="relative space-y-6">
          <div className="h-1 w-12 rounded-full bg-brand-gold" />
          <h1 className="max-w-md font-display text-4xl font-bold leading-[1.1] tracking-tight text-balance xl:text-5xl">
            Cuéntanos desde dónde partes
          </h1>
          <p className="max-w-md text-base leading-relaxed text-sidebar-foreground/75">
            Antes de comenzar el curso necesitamos conocerte: tus respuestas
            describen tu experiencia previa y tus expectativas, y la plataforma
            las usa para personalizar con IA el contenido de cada unidad a tu
            nivel. No hay respuestas correctas ni incorrectas.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">
          Piloto de Innovación Docente · Universidad de Valparaíso
        </p>
      </aside>

      {/* ---------- Panel del formulario (porcelana) ---------- */}
      <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-2xl space-y-8 py-8 animate-fade-in-up">
          {/* Marca compacta para móvil */}
          <div className="flex items-center gap-3 lg:hidden">
            <LogoMark className="h-9 w-9 shadow-sm" />
            <span className="font-display text-base font-bold tracking-tight">
              CAAMI
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Brain className="h-5 w-5" />
            </div>
            <h2 className="font-display text-title font-semibold">
              Diagnóstico inicial del curso
            </h2>
            <p className="text-sm text-muted-foreground">
              Responde con honestidad y detalle: estas respuestas personalizan
              el contenido que verás en cada unidad. Es obligatorio para
              continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="stagger-children space-y-5">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <label htmlFor={`diagnostic-q-${idx}`} className="block text-sm font-semibold text-foreground">
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
        </div>
      </main>
    </div>
  );
}
