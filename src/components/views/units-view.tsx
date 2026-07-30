"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { getUnitColor } from "@/lib/course-utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowRight, BookMarked, Search, Filter, X, Sparkles } from "lucide-react";
import type { Unit, User } from "@/lib/types";

type FilterKey = "all" | "in-progress" | "completed" | "not-started";

/** Skeleton de carga: replica header + grid de tarjetas con shimmer. */
function UnitsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
      <div className="space-y-3">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="skeleton h-11 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div className="skeleton h-11 w-11 rounded-lg" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton mt-2 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UnitsView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const openUnit = useAppStore((s) => s.openUnit);

  const { data, loading, error, refetch } = useFetch<{ units: Unit[] }>(`/api/units`, []);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  if (error) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
        <PageHeader title="Unidades" />
        <FetchError description={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading || !data) {
    return <UnitsSkeleton />;
  }

  const units = data.units;
  const totalUnits = units.length;
  const isAdapted = (u: Unit) => Boolean(u.hasAdaptedContent && !u.diagnosticSkipped);
  const totalAdapted = units.filter(isAdapted).length;

  const q = search.trim().toLowerCase();
  const filteredUnits = units.filter((u) => {
    if (q) {
      const hay = `${u.title} ${u.summary} ${u.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const adapted = isAdapted(u);
    if (filter === "completed" && !adapted) return false;
    if (filter === "not-started" && adapted) return false;
    return true;
  });

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: units.length },
    { key: "completed", label: "Adaptadas", count: totalAdapted },
    { key: "not-started", label: "Pendientes", count: units.length - totalAdapted },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
      <PageHeader
        title="Unidades temáticas"
        description="Contenido del programa de Electromedicina II, organizado por unidades de aprendizaje."
        icon="BookOpen"
        iconGradient="from-brand to-brand-ink"
        actions={
          <div className="hidden items-center gap-4 rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs sm:flex">
            <div className="flex items-center gap-1.5">
              <BookMarked className="h-4 w-4 text-brand dark:text-brand-gold" />
              <span className="font-mono font-semibold tabular-nums">{totalUnits}</span>
              <span className="text-muted-foreground">unidades</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono font-semibold tabular-nums">{totalAdapted}/{totalUnits}</span>
              <span className="text-muted-foreground">adaptadas</span>
            </div>
          </div>
        }
      />

      {/* Nota explicativa — plana, sin relleno de marca masivo */}
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-brand/25 bg-brand/[0.04] p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:text-brand-gold">
          <DynamicIcon name="Lightbulb" className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-brand dark:text-brand-gold">¿Cómo funciona el aprendizaje adaptativo?</p>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Al entrar a cada unidad por primera vez puedes responder un diagnóstico de preguntas abiertas: la IA adaptará el texto base a tu nivel y lo guardará para tu estudio. Si prefieres, sáltalo y complétalo después.
          </p>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar unidades, temas, conceptos..."
            className="h-11 pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200 ease-out-expo ${
                filter === opt.key
                  ? "border-brand/30 bg-brand/5 text-brand dark:border-brand-gold/40 dark:bg-brand-gold/10 dark:text-brand-gold"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label}
              <span className={`rounded-full px-1.5 font-mono text-xs tabular-nums ${filter === opt.key ? "bg-brand-gold/20 text-brand dark:bg-brand-gold/20 dark:text-brand-gold" : "bg-muted"}`}>
                {opt.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid de unidades */}
      {filteredUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-semibold">No se encontraron unidades</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {search ? `Sin resultados para "${search}"` : "No hay unidades en este filtro"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((u) => {
          const color = getUnitColor(u.color);
          const adapted = isAdapted(u);
          const skipped = Boolean(u.diagnosticSkipped);

          return (
            <button
              key={u.id}
              onClick={() => openUnit(u.id)}
              className="hover-lift group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 text-left shadow-xs hover:border-brand/30"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${color.gradient} text-white shadow-sm transition-transform duration-200 ease-out-expo group-hover:scale-105`}>
                  <DynamicIcon name={u.icon} className="h-5 w-5" />
                </div>
                {adapted ? (
                  <Badge className="shrink-0 border-none bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Adaptada
                  </Badge>
                ) : skipped ? (
                  <Badge variant="outline" className="shrink-0 border-brand-gold/50 text-amber-700 dark:text-brand-gold">
                    Diagnóstico saltado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">Pendiente</Badge>
                )}
              </div>

              <h3 className="mt-3 font-semibold leading-tight transition-colors duration-200 group-hover:text-brand dark:group-hover:text-brand-gold">{u.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{u.summary}</p>

              {/* Progreso */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Diagnóstico</span>
                  <span className="font-medium">
                    {adapted ? "Completado" : skipped ? "Saltado" : "Pendiente"}
                  </span>
                </div>
                <Progress value={adapted ? 100 : 0} className="h-1.5 bg-muted" />
              </div>

              {/* CTA */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                {adapted || skipped ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    Leer contenido
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs">
                    Comenzar
                  </span>
                )}
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${color.bgSoft} ${color.text} transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5`}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
