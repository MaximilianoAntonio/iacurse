"use client";

import * as React from "react";

interface ReadingProgressProps {
  className?: string;
  colorClass?: string; // clase tailwind de fondo para la barra, p.ej. "bg-brand"
}

/**
 * Barra de progreso de lectura fijada al top que sigue el scroll del usuario
 * dentro del contenido principal de la página.
 */
export function ReadingProgress({
  className = "",
  colorClass = "bg-brand",
}: ReadingProgressProps) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
      setProgress(pct);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-16 z-30 h-1 bg-muted/60 ${className}`}
      aria-hidden="true"
    >
      <div
        className={`h-full transition-[width] duration-150 ease-out-expo ${colorClass}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
