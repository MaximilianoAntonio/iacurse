"use client";

import * as React from "react";
import { BookOpen, Info, Lightbulb, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Callout tipado del contenido del curso. Se escribe en Markdown como un
// blockquote cuya primera línea es la marca, p. ej.:
//   > [!seguridad]
//   > Verifica siempre la conexión a tierra del equipo.
// course-content.tsx detecta la marca y renderiza este componente; un
// blockquote sin marca se sigue viendo como la caja ámbar genérica.
// Regla del sistema: sin border-left de color grueso; la señal la dan el
// fondo suave, el icono y la etiqueta.

export type CalloutType = "nota" | "advertencia" | "seguridad" | "dato" | "ejemplo";

const CALLOUT_CONFIG: Record<
  CalloutType,
  { icon: LucideIcon; label: string; box: string; tone: string }
> = {
  nota: {
    icon: Info,
    label: "Nota",
    box: "bg-primary/5",
    tone: "text-brand dark:text-brand-gold",
  },
  advertencia: {
    icon: TriangleAlert,
    label: "Advertencia",
    box: "bg-accent/60",
    tone: "text-amber-700 dark:text-amber-300",
  },
  // La seguridad eléctrica/clínica es tema central de Electromedicina:
  // único callout con tono destructivo.
  seguridad: {
    icon: Zap,
    label: "Seguridad eléctrica",
    box: "bg-destructive/10",
    tone: "text-destructive",
  },
  dato: {
    icon: Lightbulb,
    label: "Dato",
    box: "bg-emerald-500/10",
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  ejemplo: {
    icon: BookOpen,
    label: "Ejemplo",
    box: "bg-muted",
    tone: "text-muted-foreground",
  },
};

export function Callout({ type, children }: { type: CalloutType; children?: React.ReactNode }) {
  const { icon: Icon, label, box, tone } = CALLOUT_CONFIG[type] ?? CALLOUT_CONFIG.nota;
  return (
    <div className={cn("my-4 rounded-lg px-4 py-3 text-sm [&_p]:my-1", box)}>
      <p className={cn("mb-1 flex items-center gap-1.5 text-xs font-semibold", tone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </p>
      {children}
    </div>
  );
}
