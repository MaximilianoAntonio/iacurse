"use client";

import { DynamicIcon } from "@/components/app/dynamic-icon";
import { getUnitColor } from "@/lib/course-utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import type { Unit } from "@/lib/types";

// Estado de progreso real de una unidad para el estudiante actual.
export type UnitProgressStatus = "not-started" | "in-progress" | "completed";

/**
 * Deriva el estado de la unidad desde el progreso real (actividades
 * completadas / totales, expuesto por GET /api/units como unit.progress).
 */
export function unitProgressStatus(unit: Unit): UnitProgressStatus {
  const completed = unit.progress?.completed ?? 0;
  const total = unit.progress?.total ?? unit.activityCount ?? 0;
  if (total > 0 && completed >= total) return "completed";
  if (completed > 0) return "in-progress";
  return "not-started";
}

const STATUS_META: Record<UnitProgressStatus, { label: string; cta: string }> = {
  "not-started": { label: "Sin iniciar", cta: "Comenzar" },
  "in-progress": { label: "En curso", cta: "Continuar" },
  completed: { label: "Completada", cta: "Repasar" },
};

interface UnitCardProps {
  unit: Unit;
  onOpen: (unitId: string) => void;
}

/**
 * Tarjeta de unidad compartida (dashboard y listado de unidades).
 * Muestra progreso real —actividades completadas y dominio— en vez del
 * estado de adaptación, que pasa a ser un sello secundario.
 */
export function UnitCard({ unit, onOpen }: UnitCardProps) {
  const color = getUnitColor(unit.color);
  const status = unitProgressStatus(unit);
  const meta = STATUS_META[status];
  const completed = unit.progress?.completed ?? 0;
  const total = unit.progress?.total ?? unit.activityCount ?? 0;
  const mastery = Math.min(100, unit.progress?.mastery ?? 0);
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const adapted = Boolean(unit.hasAdaptedContent && !unit.diagnosticSkipped);

  return (
    <button
      onClick={() => onOpen(unit.id)}
      className="hover-lift group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 text-left shadow-xs hover:border-brand/30 dark:hover:border-brand-gold/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${color.gradient} text-white shadow-sm transition-transform duration-200 ease-out-expo group-hover:scale-105`}>
          <DynamicIcon name={unit.icon} className="h-5 w-5" />
        </div>
        {status === "completed" ? (
          <Badge className="shrink-0 border-none bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 h-3 w-3" /> {meta.label}
          </Badge>
        ) : status === "in-progress" ? (
          <Badge variant="outline" className="shrink-0 border-brand/30 text-brand dark:border-brand-gold/40 dark:text-brand-gold">
            {meta.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            {meta.label}
          </Badge>
        )}
      </div>

      <h3 className="mt-3 font-semibold leading-tight transition-colors duration-200 group-hover:text-brand dark:group-hover:text-brand-gold">
        {unit.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{unit.summary}</p>

      {/* Meta: alcance de la unidad, datos en mono */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-mono font-medium tabular-nums text-foreground">{unit.lessonCount ?? unit.lessons?.length ?? 0}</span> lecciones
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-mono font-medium tabular-nums text-foreground">{total}</span> actividades
        </span>
        {adapted && (
          <span className="ml-auto inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300" title="Contenido nivelado por IA según tu diagnóstico">
            <Sparkles className="h-3 w-3" /> Personalizada
          </span>
        )}
      </div>

      {/* Progreso real */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {status === "completed" ? "Dominio" : "Progreso"}
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {status === "completed" ? `${mastery}%` : `${completed}/${total}`}
          </span>
        </div>
        <Progress
          value={pct}
          className={`h-1.5 bg-muted ${status === "completed" ? "[&_[data-slot=progress-indicator]]:bg-emerald-500" : ""}`}
        />
      </div>

      {/* CTA */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        {status === "not-started" ? (
          <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs">
            {meta.cta}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {meta.cta}
          </span>
        )}
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${color.bgSoft} ${color.text} transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5`}>
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}
