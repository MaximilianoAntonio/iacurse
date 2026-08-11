"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { ReportErrorDialog } from "@/components/app/report-error-dialog";

/**
 * FAB global "Reportar un problema": visible en todas las vistas autenticadas
 * (se monta en `app-shell.tsx`). Abre el diálogo de reporte con
 * source="platform" y un sourceId de contexto de navegación
 * ("page:<view>;unit:<id>;lesson:<id>;activity:<id>") para que el docente
 * sepa dónde estaba el usuario al reportar.
 */
export function GlobalReportFab() {
  const [open, setOpen] = React.useState(false);
  const view = useAppStore((s) => s.view);
  const currentUnitId = useAppStore((s) => s.currentUnitId);
  const currentLessonId = useAppStore((s) => s.currentLessonId);
  const currentActivityId = useAppStore((s) => s.currentActivityId);

  // Contexto de navegación legible para el docente
  const sourceId =
    `page:${view}` +
    (currentUnitId ? `;unit:${currentUnitId}` : "") +
    (currentLessonId ? `;lesson:${currentLessonId}` : "") +
    (currentActivityId ? `;activity:${currentActivityId}` : "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar un problema"
        title="Reportar un problema"
        className="hover-lift fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 sm:w-auto sm:px-4"
      >
        <Flag className="h-5 w-5" />
        <span className="hidden text-sm font-medium sm:inline">Reportar</span>
      </button>
      <ReportErrorDialog
        source="platform"
        sourceId={sourceId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
