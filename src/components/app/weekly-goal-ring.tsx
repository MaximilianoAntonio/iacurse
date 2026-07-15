"use client";

import { motion } from "framer-motion";
import { Flame, Target } from "lucide-react";

interface WeeklyGoalRingProps {
  /** Minutes studied this week */
  current: number;
  /** Weekly goal in minutes */
  goal: number;
  /** Days active this week (0-7) */
  daysActive: number;
}

export function WeeklyGoalRing({ current, goal, daysActive }: WeeklyGoalRingProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const hours = Math.floor(current / 60);
  const mins = current % 60;
  const goalHours = Math.floor(goal / 60);
  const goalMins = goal % 60;

  return (
    <div className="flex items-center gap-4">
      {/* Circular progress ring */}
      <div className="relative h-32 w-32 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          {/* Background ring */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-muted"
          />
          {/* Progress ring */}
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={pct >= 100 ? "stroke-emerald-500" : "stroke-amber-500"}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", damping: 12 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg"
          >
            <Flame className="h-5 w-5" />
          </motion.div>
          <div className="mt-1 text-lg font-bold tabular-nums">{pct}%</div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 space-y-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Meta semanal</p>
          <p className="text-2xl font-bold leading-tight">
            {hours > 0 ? `${hours}h ` : ""}
            {mins}m
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {goalHours > 0 ? `${goalHours}h ` : ""}{goalMins}m
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i < daysActive
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {daysActive}/7 días activo
          </span>
        </div>
        {pct >= 100 ? (
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Target className="h-3 w-3" /> ¡Meta alcanzada esta semana!
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Te faltan {Math.max(0, goal - current)} min para tu meta
          </p>
        )}
      </div>
    </div>
  );
}
