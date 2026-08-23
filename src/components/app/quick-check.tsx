"use client";

import * as React from "react";
import { Brain, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// Tarjeta de auto-repaso inline. Se escribe en el contenido como un fence con
// lenguaje especial:
//   ```repaso
//   P: ¿Cuál es la ganancia de un amplificador no inversor?
//   R: G = 1 + Rf/R1, siempre mayor o igual a 1.
//   ```
// El estudiante intenta responder mentalmente, revela la respuesta y se
// auto-reporta. Es un pulso de recall, no una evaluación: no se envía nada.
interface QuickCheckProps {
  source: string;
}

// Tolerante: si faltan las marcas P:/R:, la primera línea es la pregunta y el
// resto la respuesta.
function parseQuickCheck(source: string): { question: string; answer: string } {
  const p = /^P:\s*(.+)$/m.exec(source);
  const r = /^R:\s*([\s\S]+)$/m.exec(source);
  if (p || r) {
    return {
      question: (p?.[1] ?? "").trim(),
      answer: (r?.[1] ?? "").trim(),
    };
  }
  const lines = source.split("\n").filter((l) => l.trim() !== "");
  return {
    question: (lines[0] ?? "").trim(),
    answer: lines.slice(1).join("\n").trim(),
  };
}

export function QuickCheck({ source }: QuickCheckProps) {
  const { question, answer } = parseQuickCheck(source);
  const [revealed, setRevealed] = React.useState(false);
  const [mark, setMark] = React.useState<"clear" | "review" | null>(null);

  if (!question) return null;

  return (
    <div className="my-4 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-brand-gold">
        <Brain className="h-3.5 w-3.5" aria-hidden />
        Repaso rápido
      </p>
      <p className="mt-1.5 text-sm font-medium leading-6">{question}</p>

      {revealed ? (
        <div className="animate-fade-in-up">
          {answer && (
            <p className="mt-2 whitespace-pre-line rounded-lg bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
              {answer}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMark("clear")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                mark === "clear"
                  ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <Check className="h-3 w-3" aria-hidden />
              Lo tenía claro
            </button>
            <button
              type="button"
              onClick={() => setMark("review")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                mark === "review"
                  ? "border-amber-600/40 bg-accent/60 text-amber-700 dark:text-amber-300"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              A repasar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-2.5 inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ver respuesta
        </button>
      )}
    </div>
  );
}
