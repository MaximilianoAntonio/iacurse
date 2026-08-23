"use client";

import * as React from "react";
import { BookMarked, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Glosario inline de términos clave. Se escribe como un fence con lenguaje
// especial, una línea por término:
//   ```glosario
//   Biopotencial :: Señal eléctrica generada por tejido vivo (ECG, EEG, EMG).
//   CMR :: Relación de rechazo en modo común de un amplificador diferencial.
//   ```
// Cada término se expande al click para mostrar su definición (funciona con
// teclado y táctil, a diferencia de un tooltip).
interface GlossaryBlockProps {
  source: string;
}

function parseTerms(source: string): { term: string; definition: string }[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("::");
      if (idx === -1) return { term: line, definition: "" };
      return { term: line.slice(0, idx).trim(), definition: line.slice(idx + 2).trim() };
    })
    .filter((t) => t.term);
}

export function GlossaryBlock({ source }: GlossaryBlockProps) {
  const terms = React.useMemo(() => parseTerms(source), [source]);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  if (terms.length === 0) return null;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <p className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-xs font-semibold text-brand dark:text-brand-gold">
        <BookMarked className="h-3.5 w-3.5" aria-hidden />
        Términos clave
      </p>
      <ul>
        {terms.map((t, i) => {
          const open = openIndex === i;
          return (
            <li key={i} className={i > 0 ? "border-t border-border" : undefined}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/60"
              >
                {t.term}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                  aria-hidden
                />
              </button>
              {open && t.definition && (
                <p className="animate-fade-in px-4 pb-3 text-sm leading-6 text-muted-foreground">
                  {t.definition}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
