"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON, deleteURL } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/app/page-header";
import { FetchError } from "@/components/app/loading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activityTypeMeta,
  difficultyMeta,
  getUnitColor,
  timeAgo,
} from "@/lib/course-utils";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import type { ActivityType, Difficulty } from "@/lib/types";

// ---------- Types ----------

interface BookmarkItem {
  id: string;
  activityId: string;
  note: string;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    type: ActivityType;
    difficulty: Difficulty;
    points: number;
    lesson: {
      id: string;
      title: string;
      unit: { id: string; title: string; color: string; icon: string };
    };
  } | null;
}

interface BookmarksResponse {
  bookmarks: BookmarkItem[];
}

// ---------- Main component ----------

export function BookmarksView() {
  const navigate = useAppStore((s) => s.navigate);

  const { data, loading, error, refetch } = useFetch<BookmarksResponse>(
    `/api/bookmarks`,
    []
  );

  const header = (
    <PageHeader
      title="Guardados"
      icon="Bookmark"
      description="Tus actividades guardadas para repasar, agrupadas por unidad."
    />
  );

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
        {header}
        <FetchError description={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
        {header}
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // El payload puede traer activity=null si la actividad fue eliminada
  const items = data.bookmarks.filter((b) => b.activity !== null);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
        {header}
        <Card className="animate-fade-in-up">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
              <Bookmark className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold">
                Aún no tienes actividades guardadas
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Usa el botón Guardar de cualquier actividad para retomarla
                rápidamente desde aquí, con tus notas personales.
              </p>
            </div>
            <Button onClick={() => navigate("units")}>
              <BookOpen className="mr-1.5 h-4 w-4" />
              Explorar unidades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Agrupar por unidad, manteniendo el orden de llegada del backend
  const groups = new Map<
    string,
    { unit: { id: string; title: string; color: string }; items: BookmarkItem[] }
  >();
  for (const b of items) {
    const unit = b.activity!.lesson.unit;
    const group = groups.get(unit.id) ?? { unit, items: [] };
    group.items.push(b);
    groups.set(unit.id, group);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-8">
      {header}
      {Array.from(groups.values()).map((group) => {
        const color = getUnitColor(group.unit.color);
        return (
          <section key={group.unit.id} className="space-y-3">
            {/* Encabezado de grupo: punto de color de la unidad, sin bloques masivos */}
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", color.dot)} />
              <h2 className={cn("text-sm font-semibold", color.text)}>
                {group.unit.title}
              </h2>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {group.items.length}{" "}
                {group.items.length === 1 ? "guardada" : "guardadas"}
              </span>
            </div>
            <div className="stagger-children grid gap-3">
              {group.items.map((b) => (
                <BookmarkCard key={b.id} bookmark={b} onChanged={refetch} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ---------- Sub-components ----------

function BookmarkCard({
  bookmark,
  onChanged,
}: {
  bookmark: BookmarkItem;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const openActivity = useAppStore((s) => s.openActivity);

  // Estado local de la nota (la tarjeta se remonta por key al re-fetchear)
  const [note, setNote] = useState(bookmark.note ?? "");
  const [savedNote, setSavedNote] = useState(bookmark.note ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [removing, setRemoving] = useState(false);

  const activity = bookmark.activity!;
  const typeLabel =
    activityTypeMeta[activity.type]?.label ?? activity.type;
  const diffMeta = difficultyMeta[activity.difficulty];

  const handleSaveNote = async () => {
    setSaveState("saving");
    try {
      // El POST reutiliza el endpoint de creación: si el bookmark ya existe,
      // el backend actualiza la nota (truncada a 500 caracteres).
      await postJSON("/api/bookmarks", {
        activityId: bookmark.activityId,
        note: note.trim(),
      });
      setSavedNote(note.trim());
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
      toast({
        title: "Error",
        description: "No se pudo guardar la nota.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await deleteURL(`/api/bookmarks?activityId=${bookmark.activityId}`);
      toast({
        title: "Bookmark eliminado",
        description: "La actividad ya no está guardada.",
      });
      onChanged();
    } catch {
      setRemoving(false);
      toast({
        title: "Error",
        description: "No se pudo eliminar el bookmark.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="hover-lift">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-semibold leading-snug">{activity.title}</p>
            <p className="text-xs text-muted-foreground">
              {activity.lesson.title}
              <span aria-hidden> · </span>
              guardada {timeAgo(bookmark.createdAt)}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <Badge variant="secondary">{typeLabel}</Badge>
              {diffMeta && (
                <Badge variant="outline" className={diffMeta.color}>
                  {diffMeta.label}
                </Badge>
              )}
              <Badge variant="outline" className="font-mono tabular-nums">
                {activity.points} pts
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => openActivity(activity.id, activity.lesson.id)}
            >
              Ir a la actividad
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Quitar
            </Button>
          </div>
        </div>

        {/* Nota personal */}
        <div className="space-y-2 border-t border-border pt-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Añade una nota personal…"
            maxLength={500}
            rows={2}
            className="min-h-16 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {note.length}/500
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNote}
              disabled={
                saveState === "saving" ||
                (saveState !== "saved" && note.trim() === savedNote)
              }
            >
              {saveState === "saving" ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : saveState === "saved" ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Guardado
                </>
              ) : (
                "Guardar nota"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
