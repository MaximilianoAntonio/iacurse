import type { ActivityType, Difficulty } from "@/lib/types";

// Mapeo de colores de unidades — Paleta institucional UV
// Azul UV (#003366) como base, dorado UV (#fbbf24) como acento
// Cada unidad mantiene un color distintivo pero dentro de la familia UV
const unitColorMap: Record<
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
    bg: "bg-[#003366]",
    bgSoft: "bg-[#003366]/5 dark:bg-[#0066AA]/10",
    text: "text-[#003366] dark:text-[#5b9bd5]",
    border: "border-[#003366]/20 dark:border-[#0066AA]/30",
    ring: "ring-[#003366]/30",
    gradient: "from-[#003366] to-[#0066AA]",
    dot: "bg-[#003366]",
  },
  rose: {
    bg: "bg-rose-600",
    bgSoft: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    ring: "ring-rose-500/30",
    gradient: "from-rose-500 to-rose-700",
    dot: "bg-rose-500",
  },
  sky: {
    bg: "bg-[#0066AA]",
    bgSoft: "bg-[#0066AA]/5 dark:bg-[#0066AA]/10",
    text: "text-[#0066AA] dark:text-[#5b9bd5]",
    border: "border-[#0066AA]/20 dark:border-[#0066AA]/30",
    ring: "ring-[#0066AA]/30",
    gradient: "from-[#004488] to-[#0066AA]",
    dot: "bg-[#0066AA]",
  },
  amber: {
    bg: "bg-amber-500",
    bgSoft: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    ring: "ring-amber-500/30",
    gradient: "from-amber-400 to-amber-600",
    dot: "bg-amber-500",
  },
  violet: {
    bg: "bg-[#004488]",
    bgSoft: "bg-[#004488]/5 dark:bg-[#004488]/10",
    text: "text-[#004488] dark:text-[#5b9bd5]",
    border: "border-[#004488]/20 dark:border-[#004488]/30",
    ring: "ring-[#004488]/30",
    gradient: "from-[#003366] to-[#004488]",
    dot: "bg-[#004488]",
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

// El backend Django devuelve `data` de actividad como objeto JSON; la versión
// legacy (Prisma/SQLite) la entregaba como string serializado. Se aceptan
// ambas formas (parity con parse_activity_data del backend).
export function parseActivityData<T>(data: unknown): T {
  if (data && typeof data === "object") return data as T;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return {} as T;
    }
  }
  return {} as T;
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
