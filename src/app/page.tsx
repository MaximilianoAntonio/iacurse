"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import type { User } from "@/lib/types";

export default function Home() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setUser = useAppStore((s) => s.setUser);
  const switchUser = useAppStore((s) => s.switchUser);
  const [switching, setSwitching] = useState(false);

  // Cargar usuarios
  const { data: usersData } = useFetch<{ users: User[] }>("/api/users", []);

  // Cargar usuario actual
  const meUrl = currentUserId ? `/api/me?userId=${currentUserId}` : "/api/me";
  const { data: meData, loading } = useFetch<{ user: User }>(meUrl, [currentUserId]);

  useEffect(() => {
    if (meData?.user) {
      setUser(meData.user);
      // Re-aplicar la vista desde la URL después de cargar el usuario,
      // ya que setUser puede haber cambiado el rol y validado la vista.
      // Esto asegura que ?view=teacher respete al recargar la página.
      useAppStore.getState().hydrateFromUrl();
    }
  }, [meData, setUser]);

  const handleSwitchUser = (userId: string) => {
    setSwitching(true);
    switchUser(userId);
    // El useEffect de useFetch se dispara por el cambio de currentUserId
    setTimeout(() => setSwitching(false), 400);
  };

  if (loading || !meData?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
            <Skeleton className="h-7 w-7 bg-white/20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="mx-auto h-4 w-48" />
            <Skeleton className="mx-auto h-3 w-32" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={switching ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <AppShell
        users={usersData?.users ?? []}
        onSwitchUser={handleSwitchUser}
      />
    </div>
  );
}
