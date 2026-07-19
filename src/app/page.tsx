"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { LoginView } from "@/components/views/login-view";
import type { User } from "@/lib/types";

export default function Home() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setUser = useAppStore((s) => s.setUser);
  const switchUser = useAppStore((s) => s.switchUser);
  const [switching, setSwitching] = useState(false);
  // Modo demo: si true, omite el login y usa el primer estudiante (UX del piloto)
  const [demoMode, setDemoMode] = useState(false);

  // Cargar usuarios
  const { data: usersData } = useFetch<{ users: User[] }>("/api/users", []);

  // Cargar usuario actual.
  // En modo autenticado, /api/me devuelve el usuario de la sesión.
  // En modo demo (sin login), devuelve el primer estudiante (parity con Next.js original).
  const meUrl = demoMode || currentUserId ? `/api/me${currentUserId ? `?userId=${currentUserId}` : ""}` : null;
  const { data: meData, loading } = useFetch<{ user: User }>(meUrl, [currentUserId, demoMode]);

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

  const handleLogin = (user: User) => {
    setUser(user);
    setDemoMode(true);
  };

  const handleDemoAccess = () => {
    setDemoMode(true);
  };

  // Pantalla de carga
  if (loading && demoMode) {
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

  // Si hay usuario (autenticado o demo), mostrar la app
  if (meData?.user) {
    return (
      <div className={switching ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <AppShell
          users={usersData?.users ?? []}
          onSwitchUser={handleSwitchUser}
        />
      </div>
    );
  }

  // Sin sesión: mostrar pantalla de login
  return <LoginView onLogin={handleLogin} onDemoAccess={handleDemoAccess} />;
}
