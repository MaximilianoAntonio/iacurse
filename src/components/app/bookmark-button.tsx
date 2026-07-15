"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

interface BookmarkButtonProps {
  activityId: string;
  className?: string;
}

export function BookmarkButton({ activityId, className }: BookmarkButtonProps) {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const userId = currentUser?.id ?? "";
  const { toast } = useToast();

  // Fetch all bookmarks to check if this activity is bookmarked
  const { data, refetch } = useFetch<{ bookmarks: { activityId: string }[] }>(
    userId ? `/api/bookmarks?userId=${userId}` : null,
    [userId]
  );

  const isBookmarked = (data?.bookmarks ?? []).some((b) => b.activityId === activityId);

  const handleToggle = async () => {
    if (!userId) return;
    if (isBookmarked) {
      try {
        await fetch(`/api/bookmarks?userId=${userId}&activityId=${activityId}`, { method: "DELETE" });
        refetch();
        toast({ title: "Bookmark eliminado", description: "La actividad ya no está guardada." });
      } catch {
        toast({ title: "Error", description: "No se pudo eliminar el bookmark.", variant: "destructive" });
      }
    } else {
      try {
        await postJSON("/api/bookmarks", { userId, activityId });
        refetch();
        toast({ title: "Actividad guardada", description: "Puedes encontrarla en tus bookmarks." });
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
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
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
