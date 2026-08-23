"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Controles de lectura del estudiante: tamaño de fuente del contenido en 3
// pasos, persistido en localStorage y sincronizado entre vistas mediante un
// evento de ventana (lesson-view y unit-detail-view consumen el mismo hook).

export type ReadingFontSize = "sm" | "base" | "lg";

const SIZES: ReadingFontSize[] = ["sm", "base", "lg"];
const STORAGE_KEY = "electromed_reader_font";
const FONT_EVENT = "electromed:reader-font";

function isValidSize(value: string | null): value is ReadingFontSize {
  return value === "sm" || value === "base" || value === "lg";
}

// localStorage como store externo: useSyncExternalStore evita setState en
// effect y mantiene sincronizadas todas las instancias del hook en la página.
function subscribe(callback: () => void) {
  window.addEventListener(FONT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(FONT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): ReadingFontSize {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isValidSize(saved) ? saved : "base";
}

// SSR y primer render: tamaño por defecto (hidrata sin mismatch)
function getServerSnapshot(): ReadingFontSize {
  return "base";
}

export function useReadingFontSize(): [ReadingFontSize, (size: ReadingFontSize) => void] {
  const size = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSize = React.useCallback((next: ReadingFontSize) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(FONT_EVENT, { detail: next }));
  }, []);

  return [size, setSize];
}

export function ReadingControls({ className }: { className?: string }) {
  const [size, setSize] = useReadingFontSize();
  const index = SIZES.indexOf(size);

  return (
    <div
      className={cn("inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5", className)}
      role="group"
      aria-label="Tamaño del texto de lectura"
    >
      <button
        type="button"
        onClick={() => setSize(SIZES[index - 1])}
        disabled={index <= 0}
        className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        aria-label="Reducir tamaño del texto"
        title="Reducir tamaño del texto"
      >
        A−
      </button>
      <button
        type="button"
        onClick={() => setSize(SIZES[index + 1])}
        disabled={index >= SIZES.length - 1}
        className="rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        aria-label="Aumentar tamaño del texto"
        title="Aumentar tamaño del texto"
      >
        A+
      </button>
    </div>
  );
}
