"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCw } from "lucide-react";

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-2 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Estado de error para vistas que dependen de un fetch.
 * Evita el "skeleton infinito": si el fetch falla, se muestra este estado
 * con un botón de reintentar en vez de quedarse cargando para siempre.
 */
export function FetchError({
  title = "No se pudo cargar",
  description,
  onRetry,
}: {
  title?: string;
  description?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 py-16 text-center dark:border-rose-900 dark:bg-rose-950/20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {description
              ? `Ocurrió un error de comunicación con el servidor (${description}).`
              : "Ocurrió un error de comunicación con el servidor. Verifica tu conexión e inténtalo de nuevo."}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RotateCw className="h-4 w-4" />
            Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}
