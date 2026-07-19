"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { LoginView } from "@/components/views/login-view";
import type { User } from "@/lib/types";

type AuthState = "loading" | "authenticated" | "demo" | "anonymous";

export default function Home() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setUser = useAppStore((s) => s.setUser);
  const switchUser = useAppStore((s) => s.switchUser);
  const [switching, setSwitching] = useState(false);
  // Estado de autenticación: distingue sesión real (Django) de demo (sin login)
  const [authState, setAuthState] = useState<AuthState>("loading");

  // Cargar lista de usuarios (para el selector del header)
  const { data: usersData } = useFetch<{ users: User[] }>("/api/users", []);

  // Cargar usuario actual desde el backend.
  // - authState="authenticated": /api/me (sin query) — el backend usa la sesión.
  // - authState="demo": /api/me?demo=1[&userId=...] — primer estudiante o switcher.
  // - authState="loading"/"anonymous": null (no pide nada).
  const meUrl =
    authState === "authenticated"
      ? "/api/me"
      : authState === "demo"
        ? `/api/me?demo=1${currentUserId ? `&userId=${currentUserId}` : ""}`
        : null;
  const { data: meData, loading } = useFetch<{ user: User }>(meUrl, [currentUserId, authState]);

  // Al montar: comprobar si hay cookie de sesión (para reanudar sesión real)
  useEffect(() => {
    // sessionid es HttpOnly, no accesible. Usamos un flag en localStorage
    // que se setea tras login exitoso y se borra tras logout.
    const hasSession = typeof window !== "undefined" && localStorage.getItem("electromed-session") === "1";
    setAuthState(hasSession ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    if (meData?.user) {
      setUser(meData.user);
      useAppStore.getState().hydrateFromUrl();
    }
  }, [meData, setUser]);

  const handleSwitchUser = (userId: string) => {
    setSwitching(true);
    switchUser(userId);
    setTimeout(() => setSwitching(false), 400);
  };

  const handleLogin = (user: User) => {
    // Login real vía backend Django: marcar flag de sesión y recargar usuario.
    if (typeof window !== "undefined") {
      localStorage.setItem("electromed-session", "1");
    }
    setUser(user);
    setAuthState("authenticated");
  };

  const handleDemoAccess = () => {
    setAuthState("demo");
  };

  // Pantalla de carga mientras se resuelve la sesión (autenticada o demo)
  if ((authState === "loading" || authState === "authenticated" || authState === "demo") && loading) {
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
