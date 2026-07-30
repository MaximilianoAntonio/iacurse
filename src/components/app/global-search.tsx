"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, BookOpen, FileText, ListChecks, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUnitColor, activityTypeMeta, difficultyMeta } from "@/lib/course-utils";

// Helper para resaltar texto coincidente con la búsqueda
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim();
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let idx = lower.indexOf(qLower, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <mark key={idx} className="rounded bg-accent px-0.5 text-accent-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    lastIndex = idx + q.length;
    idx = lower.indexOf(qLower, lastIndex);
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

interface SearchResultUnit {
  id: string;
  title: string;
  summary: string;
  icon: string;
  color: string;
  slug: string;
  order: number;
}

interface SearchResultLesson {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  unit: { id: string; title: string; color: string; icon: string; slug: string };
}

interface SearchResultLesson {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  unit: { id: string; title: string; color: string; icon: string; slug: string };
  snippet?: string;
}

interface SearchResultActivity {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  points: number;
  lessonId: string;
  lesson: {
    id: string;
    title: string;
    unit: { id: string; title: string; color: string; icon: string; slug: string };
  };
  completed: boolean;
  snippet?: string;
}

interface SearchResponse {
  results: {
    units: SearchResultUnit[];
    lessons: SearchResultLesson[];
    activities: SearchResultActivity[];
  };
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const openUnit = useAppStore((s) => s.openUnit);
  const openLesson = useAppStore((s) => s.openLesson);
  const openActivity = useAppStore((s) => s.openActivity);
  const [query, setQuery] = React.useState("");
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);

  // Cargar búsquedas recientes del localStorage cada vez que se abre el
  // buscador (patrón "ajustar estado durante el render").
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      try {
        const stored = localStorage.getItem("electromed-search-history");
        if (stored) setRecentSearches(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }

  const saveSearch = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("electromed-search-history", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const url = query.length >= 2 ? `/api/search?q=${encodeURIComponent(query)}` : null;
  const { data } = useFetch<SearchResponse>(url, [query]);

  const results = data?.results ?? { units: [], lessons: [], activities: [] };
  const totalResults = results.units.length + results.lessons.length + results.activities.length;

  const handleOpenUnit = (unitId: string) => {
    saveSearch(query);
    openUnit(unitId);
    onOpenChange(false);
    setQuery("");
  };
  const handleOpenLesson = (lessonId: string) => {
    saveSearch(query);
    openLesson(lessonId);
    onOpenChange(false);
    setQuery("");
  };
  const handleOpenActivity = (lessonId: string, activityId: string) => {
    saveSearch(query);
    useAppStore.getState().openLesson(lessonId);
    setTimeout(() => openActivity(activityId), 50);
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar unidades, lecciones, actividades..."
            className="h-9 border-0 px-0 text-base shadow-none focus-visible:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length < 2 ? (
            <div className="py-6">
              {recentSearches.length > 0 ? (
                <div>
                  <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
                    Búsquedas recientes
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    {recentSearches.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(s)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Search className="h-3 w-3" />
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem("electromed-search-history");
                    }}
                    className="px-3 text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar historial de búsquedas"
                  >
                    Limpiar historial
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Busca en todo el curso</p>
                  <p className="text-xs text-muted-foreground">
                    Escribe al menos 2 caracteres para comenzar
                  </p>
                </div>
              )}
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Sin resultados</p>
              <p className="text-xs text-muted-foreground">
                No se encontró nada para "{query}"
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Units */}
              {results.units.length > 0 && (
                <div>
                  <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
                    Unidades ({results.units.length})
                  </p>
                  {results.units.map((u) => {
                    const color = getUnitColor(u.color);
                    return (
                      <button
                        key={u.id}
                        onClick={() => handleOpenUnit(u.id)}
                        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white", color.gradient)}>
                          <DynamicIcon name={u.icon} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium"><Highlight text={u.title} query={query} /></p>
                          <p className="truncate text-xs text-muted-foreground"><Highlight text={u.summary} query={query} /></p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Lessons */}
              {results.lessons.length > 0 && (
                <div>
                  <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
                    Lecciones ({results.lessons.length})
                  </p>
                  {results.lessons.map((l) => {
                    const color = getUnitColor(l.unit.color);
                    return (
                      <button
                        key={l.id}
                        onClick={() => handleOpenLesson(l.id)}
                        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", color.bgSoft, color.text)}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium"><Highlight text={l.title} query={query} /></p>
                          <p className="truncate text-xs text-muted-foreground">
                            {l.unit.title} · {l.durationMin} min
                          </p>
                          {l.snippet && (
                            <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground/70">
                              <Highlight text={l.snippet} query={query} />
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Activities */}
              {results.activities.length > 0 && (
                <div>
                  <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
                    Actividades ({results.activities.length})
                  </p>
                  {results.activities.map((a) => {
                    const meta = activityTypeMeta[a.type as keyof typeof activityTypeMeta];
                    const diff = difficultyMeta[a.difficulty as keyof typeof difficultyMeta];
                    return (
                      <button
                        key={a.id}
                        onClick={() => handleOpenActivity(a.lessonId, a.id)}
                        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <ListChecks className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium"><Highlight text={a.title} query={query} /></p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.lesson.unit.title} · {a.lesson.title}
                          </p>
                          {a.snippet && (
                            <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground/70">
                              <Highlight text={a.snippet} query={query} />
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {a.completed && (
                            <Badge variant="outline" className="border-primary/25 bg-primary/5 text-xs text-primary">
                              ✓
                            </Badge>
                          )}
                          <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium", diff.bg, diff.color)}>
                            {diff.label}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
