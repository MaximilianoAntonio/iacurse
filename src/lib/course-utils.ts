import type { ActivityType, Difficulty } from "@/lib/types";

// Mapeo de colores de unidades a clases Tailwind
export const unitColorMap: Record<
  string,
  {
    bg: string;
    bgSoft: string;
    text: string;
    border: string;
    ring: string;
    gradient: string;
    dot: string;
  }
> = {
  emerald: {
    bg: "bg-emerald-600",
    bgSoft: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    ring: "ring-emerald-500/30",
    gradient: "from-emerald-500 to-teal-600",
    dot: "bg-emerald-500",
  },
  rose: {
    bg: "bg-rose-600",
    bgSoft: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    ring: "ring-rose-500/30",
    gradient: "from-rose-500 to-pink-600",
    dot: "bg-rose-500",
  },
  sky: {
    bg: "bg-sky-600",
    bgSoft: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
    ring: "ring-sky-500/30",
    gradient: "from-sky-500 to-cyan-600",
    dot: "bg-sky-500",
  },
  amber: {
    bg: "bg-amber-600",
    bgSoft: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    ring: "ring-amber-500/30",
    gradient: "from-amber-500 to-orange-600",
    dot: "bg-amber-500",
  },
  violet: {
    bg: "bg-violet-600",
    bgSoft: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
    ring: "ring-violet-500/30",
    gradient: "from-violet-500 to-purple-600",
    dot: "bg-violet-500",
  },
};

export function getUnitColor(color: string) {
  return unitColorMap[color] ?? unitColorMap.emerald;
}

// Metadata de tipos de actividad
export const activityTypeMeta: Record<
  ActivityType,
  { label: string; icon: string; color: string }
> = {
  multiple_choice: {
    label: "Selección múltiple",
    icon: "ListChecks",
    color: "text-sky-600",
  },
  guided_problem: {
    label: "Problema guiado",
    icon: "Calculator",
    color: "text-emerald-600",
  },
  case_analysis: {
    label: "Análisis de caso",
    icon: "Stethoscope",
    color: "text-rose-600",
  },
  progressive_exercise: {
    label: "Ejercicio progresivo",
    icon: "TrendingUp",
    color: "text-amber-600",
  },
  self_assessment: {
    label: "Autoevaluación",
    icon: "Brain",
    color: "text-violet-600",
  },
};

export const difficultyMeta: Record<
  Difficulty,
  { label: string; color: string; bg: string }
> = {
  easy: { label: "Básico", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950" },
  medium: { label: "Intermedio", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-950" },
  hard: { label: "Avanzado", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-950" },
};

export function parseActivityData<T>(data: string): T {
  try {
    return JSON.parse(data) as T;
  } catch {
    return {} as T;
  }
}

// Icono de badge por tier
export const badgeTierMeta: Record<
  string,
  { color: string; bg: string; border: string; glow: string }
> = {
  bronze: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/50",
    border: "border-amber-300 dark:border-amber-800",
    glow: "shadow-amber-500/20",
  },
  silver: {
    color: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800/50",
    border: "border-slate-300 dark:border-slate-700",
    glow: "shadow-slate-400/20",
  },
  gold: {
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-950/50",
    border: "border-yellow-300 dark:border-yellow-800",
    glow: "shadow-yellow-500/30",
  },
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  const weeks = Math.floor(days / 7);
  return `hace ${weeks} sem`;
}
