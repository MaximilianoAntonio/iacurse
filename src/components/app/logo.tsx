"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Marca de CAAMI: tile redondeado con degradado azul UV → tinta y un trazado
 * de pulso (ECG) dorado que termina en un nodo — electromedicina + IA.
 * Se usa en sidebar, footer, login y las vistas de gate (consentimiento,
 * diagnóstico, cambio de contraseña).
 */
export function LogoMark({ className }: { className?: string }) {
  const gradientId = React.useId();
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Logo de CAAMI"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A2540" />
          <stop offset="1" stopColor="#003366" />
        </linearGradient>
      </defs>
      <rect
        width="40"
        height="40"
        rx="10"
        fill={`url(#${gradientId})`}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1"
      />
      <path
        d="M7 22h5.5l3-7.5 4.5 13 3-5.5h4"
        fill="none"
        stroke="#F5B800"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31.5" cy="22" r="2.6" fill="#F5B800" />
    </svg>
  );
}

/** Marca completa: isotipo + wordmark "CAAMI" (y subtítulo opcional). */
export function Logo({
  size = "md",
  subtitle,
  className,
  wordmarkClassName,
  subtitleClassName,
}: {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  className?: string;
  wordmarkClassName?: string;
  subtitleClassName?: string;
}) {
  const markSize = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-10 w-10" }[size];
  const textSize = { sm: "text-sm", md: "text-base", lg: "text-lg" }[size];
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <LogoMark className={markSize} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block truncate font-display font-bold tracking-tight",
            textSize,
            wordmarkClassName
          )}
        >
          CAAMI
        </span>
        {subtitle ? (
          <span className={cn("block truncate text-xs", subtitleClassName)}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
