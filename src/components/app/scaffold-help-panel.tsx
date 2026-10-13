"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, LifeBuoy } from "lucide-react";
import type { ScaffoldHelp, ScaffoldLevel } from "@/lib/types";

// Nombre en español de cada nivel de andamiaje CAAMI (ayuda progresiva A1–A5).
const LEVEL_LABEL: Record<ScaffoldLevel, string> = {
  A1: "Pregunta orientadora",
  A2: "Pista específica",
  A3: "Explicación / ejemplo",
  A4: "Secuencia guiada",
  A5: "Resolución explicada",
};

// Distinción visual por nivel: A1–A2 ámbar suave (coherente con las pistas
// estáticas), A3–A4 azul UV (contenido explicativo), A5 ámbar marcado (la
// señal más fuerte: el estudiante está recibiendo la solución).
const LEVEL_STYLE: Record<
  ScaffoldLevel,
  { alert: string; icon: string; title: string }
> = {
  A1: {
    alert: "border-brand-gold/40 bg-brand-gold/[0.08]",
    icon: "text-amber-600 dark:text-brand-gold",
    title: "text-amber-800 dark:text-brand-gold",
  },
  A2: {
    alert: "border-brand-gold/40 bg-brand-gold/[0.08]",
    icon: "text-amber-600 dark:text-brand-gold",
    title: "text-amber-800 dark:text-brand-gold",
  },
  A3: {
    alert: "border-brand/30 bg-brand/5 dark:border-brand-gold/30 dark:bg-brand-gold/[0.06]",
    icon: "text-brand dark:text-brand-gold",
    title: "text-brand dark:text-brand-gold",
  },
  A4: {
    alert: "border-brand/30 bg-brand/5 dark:border-brand-gold/30 dark:bg-brand-gold/[0.06]",
    icon: "text-brand dark:text-brand-gold",
    title: "text-brand dark:text-brand-gold",
  },
  A5: {
    alert: "border-brand-gold/60 bg-brand-gold/15",
    icon: "text-amber-700 dark:text-brand-gold",
    title: "text-amber-800 dark:text-brand-gold",
  },
};

/** Aviso destacado de verificación (la solución no completa el aprendizaje). */
export function ScaffoldVerificationNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-brand-gold/50 bg-brand-gold/15 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-brand-gold">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Recibir la solución no completa el aprendizaje: deberás verificar tu
        comprensión con un nuevo intento.
      </span>
    </div>
  );
}

interface ScaffoldHelpEntryProps {
  help: ScaffoldHelp;
  /** Fuerza el aviso de verificación (p. ej. llega a nivel de attempt). */
  verificationRequired?: boolean;
}

/** Una intervención de ayuda progresiva (badge de nivel + mensaje en texto plano). */
export function ScaffoldHelpEntry({
  help,
  verificationRequired,
}: ScaffoldHelpEntryProps) {
  const style = LEVEL_STYLE[help.level] ?? LEVEL_STYLE.A1;
  const label = LEVEL_LABEL[help.level] ?? help.supportType;
  const showVerification =
    verificationRequired ?? help.verificationRequired ?? false;

  // El origen (IA o fallback) no se muestra al estudiante; solo depuración.
  useEffect(() => {
    if (help.source === "fallback") {
      console.debug("Ayuda A1–A5 generada con fallback local (sin IA).");
    }
  }, [help.source]);

  return (
    <Alert className={cn("animate-fade-in-up", style.alert)}>
      <LifeBuoy className={cn("h-4 w-4", style.icon)} />
      <AlertTitle
        className={cn("flex flex-wrap items-center gap-2", style.title)}
      >
        <Badge
          variant="outline"
          className="border-current/30 font-mono text-xs tabular-nums"
        >
          {help.level}
        </Badge>
        {label}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-foreground/90">
        {/* Mensaje en texto plano (sin Markdown), respetando saltos de línea */}
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {help.message}
        </p>

        {/* A4: secuencia guiada paso a paso */}
        {help.level === "A4" && help.steps && help.steps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Completa cada paso antes de continuar.
            </p>
            <ol className="space-y-1.5">
              {help.steps.map((s) => (
                <li key={s.step} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold tabular-nums text-primary">
                    {s.step}
                  </span>
                  <span className="leading-relaxed">{s.prompt}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {showVerification && <ScaffoldVerificationNotice />}
      </AlertDescription>
    </Alert>
  );
}

/** Panel con el historial de intervenciones de ayuda recibidas en la actividad. */
export function ScaffoldHelpPanel({ items }: { items: ScaffoldHelp[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3" aria-label="Ayuda recibida">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <LifeBuoy className="h-3.5 w-3.5" /> Ayuda recibida
      </p>
      {items.map((help, i) => (
        <ScaffoldHelpEntry key={i} help={help} />
      ))}
    </div>
  );
}
