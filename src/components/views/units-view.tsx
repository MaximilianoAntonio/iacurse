"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingGrid } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { getUnitColor } from "@/lib/course-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, CheckCircle2, ArrowRight, BookMarked, Clock, ListChecks, Search, Filter, X } from "lucide-react";
import type { Unit, User } from "@/lib/types";

type FilterKey = "all" | "in-progress" | "completed" | "not-started";

export function UnitsView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const openUnit = useAppStore((s) => s.openUnit);
  const userId = currentUser?.id ?? "";

  const { data, loading } = useFetch<{ units: Unit[] }>(`/api/units?userId=${userId}`, [userId]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
        <PageHeader title="Unidades" description="Cargando contenido del curso..." />
        <LoadingGrid count={5} />
      </div>
    );
  }

  const units = data.units;
  const totalActivities = units.reduce((a, u) => a + (u.activityCount ?? 0), 0);
  const totalCompleted = units.reduce((a, u) => a + (u.progress?.completed ?? 0), 0);

  const q = search.trim().toLowerCase();
  const filteredUnits = units.filter((u) => {
    if (q) {
      const hay = `${u.title} ${u.summary} ${u.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const completed = u.progress?.completed ?? 0;
    const total = u.activityCount ?? 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (filter === "completed" && pct < 100) return false;
    if (filter === "in-progress" && (pct === 0 || pct >= 100)) return false;
    if (filter === "not-started" && pct > 0) return false;
    return true;
  });

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: units.length },
    { key: "in-progress", label: "En progreso", count: units.filter((u) => { const p = (u.progress?.completed ?? 0) / Math.max(1, u.activityCount ?? 1); return p > 0 && p < 1; }).length },
    { key: "completed", label: "Completadas", count: units.filter((u) => (u.progress?.completed ?? 0) >= (u.activityCount ?? 1) && (u.activityCount ?? 0) > 0).length },
    { key: "not-started", label: "Sin empezar", count: units.filter((u) => (u.progress?.completed ?? 0) === 0).length },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
      <PageHeader
        title="Unidades temáticas"
        description="Contenido del programa de Electromedicina II, organizado por unidades de aprendizaje."
        icon="BookOpen"
        iconGradient="from-[#003366] to-[#0066AA]"
        actions={
          <div className="hidden items-center gap-4 rounded-xl border border-border bg-card px-4 py-2 text-sm sm:flex">
            <div className="flex items-center gap-1.5">
              <BookMarked className="h-4 w-4 text-[#003366]" />
              <span className="font-semibold">{units.length}</span>
              <span className="text-muted-foreground">unidades</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-4 w-4 text-sky-600" />
              <span className="font-semibold">{totalCompleted}/{totalActivities}</span>
              <span className="text-muted-foreground">actividades</span>
            </div>
          </div>
        }
      />

      {/* Intro banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[#003366]/20 bg-gradient-to-br from-[#003366]/5 via-[#004488]/5 to-[#0066AA]/5 p-6 dark:border-[#003366]/30 dark:from-[#003366]/20 dark:via-[#004488]/10 dark:to-[#0066AA]/10">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-200/40 blur-2xl dark:bg-amber-800/20" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-[#0066AA] text-white shadow-lg">
            <DynamicIcon name="Lightbulb" className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-[#003366] dark:text-amber-100">¿Cómo se estructura el aprendizaje?</h3>
            <p className="max-w-2xl text-sm text-[#003366]/80 dark:text-amber-200/70">
              Cada unidad contiene lecciones con material teórico y actividades guiadas. Resuelve problemas, analiza casos clínicos
              y recibe retroalimentación inmediata del tutor IA. Tu progreso y dominio se actualizan automáticamente.
            </p>
          </div>
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
            className="h-10 pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                filter === opt.key
                  ? "border-amber-300 bg-[#003366]/5 text-[#003366] dark:border-[#003366]/30 dark:bg-[#003366]/20/40 dark:text-amber-400"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {opt.label}
              <span className={`rounded-full px-1.5 text-[10px] ${filter === opt.key ? "bg-amber-200 text-[#003366] dark:bg-amber-900 dark:text-amber-200" : "bg-muted"}`}>
                {opt.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid de unidades */}
      {filteredUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((u, idx) => {
          const color = getUnitColor(u.color);
          const completed = u.progress?.completed ?? 0;
          const total = u.activityCount ?? 0;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const mastery = u.progress?.mastery ?? 0;
          const isComplete = pct === 100 && total > 0;
          const isInProgress = pct > 0 && pct < 100;

          return (
            <button
              key={u.id}
              onClick={() => openUnit(u.id)}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Gradient header strip */}
              <div className={`relative h-24 bg-gradient-to-br ${color.gradient} p-4`}>
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                    UNIDAD {idx + 1}
                  </span>
                </div>
                <div className="relative flex h-full items-end">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur transition-transform group-hover:scale-110">
                    <DynamicIcon name={u.icon} className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-tight">{u.title}</h3>
                  {isComplete ? (
                    <Badge className="shrink-0 bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> OK
                    </Badge>
                  ) : isInProgress ? (
                    <Badge variant="secondary" className="shrink-0">{pct}%</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">Nueva</Badge>
                  )}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{u.summary}</p>

                {/* Meta */}
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" /> {u.lessonCount} lecciones
                  </span>
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" /> {total} actividades
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Progreso</span>
                    <span className="font-semibold">{completed}/{total}</span>
                  </div>
                  <Progress value={pct} className={`h-1.5 ${color.bg}`} />
                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>Dominio: <span className="font-semibold text-foreground">{mastery}%</span></span>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs font-medium text-[#003366]">
                    {isComplete ? "Revisar unidad" : isInProgress ? "Continuar" : "Comenzar"}
                  </span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${color.bgSoft} ${color.text} transition-transform group-hover:translate-x-0.5`}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      )}

      {/* Tip card */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <DynamicIcon name="MessageSquare" className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">¿Dudas con algún concepto?</p>
            <p className="text-xs text-muted-foreground">
              El tutor IA está disponible para guiarte con el método socrático, sin darte las respuestas directas.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0 text-amber-600"
            onClick={() => useAppStore.getState().setChatOpen(true)}
          >
            Abrir tutor <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
