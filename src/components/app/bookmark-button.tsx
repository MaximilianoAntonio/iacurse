"use client";

import * as React from "react";
import { useFetch, postJSON, deleteURL } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  activityId: string;
  className?: string;
}

export function BookmarkButton({ activityId, className }: BookmarkButtonProps) {
  const { toast } = useToast();

  // Fetch all bookmarks to check if this activity is bookmarked
  const { data, refetch } = useFetch<{ bookmarks: { activityId: string }[] }>(
    `/api/bookmarks`,
    []
  );

  const isBookmarked = (data?.bookmarks ?? []).some((b) => b.activityId === activityId);

  const handleToggle = async () => {
    if (isBookmarked) {
      try {
        await deleteURL(`/api/bookmarks?activityId=${activityId}`);
        refetch();
        toast({ title: "Bookmark eliminado", description: "La actividad ya no está guardada." });
      } catch {
        toast({ title: "Error", description: "No se pudo eliminar el bookmark.", variant: "destructive" });
      }
    } else {
      try {
        await postJSON("/api/bookmarks", { activityId });
        refetch();
        toast({ title: "Actividad guardada", description: "Puedes encontrarla en Guardados." });
      } catch {
        toast({ title: "Error", description: "No se pudo guardar el bookmark.", variant: "destructive" });
      }
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        isBookmarked
          ? "border-gold/30 bg-gold-soft text-gold-foreground hover:bg-gold-soft "
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
      title={isBookmarked ? "Quitar de guardados" : "Guardar actividad"}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-3.5 w-3.5" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{isBookmarked ? "Guardada" : "Guardar"}</span>
    </button>
  );
}
