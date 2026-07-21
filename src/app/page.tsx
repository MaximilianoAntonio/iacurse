"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/use-fetch";
import { LoginView } from "@/components/views/login-view";
import type { User } from "@/lib/types";

type AuthState = "loading" | "authenticated" | "anonymous";

export default function Home() {
  const setUser = useAppStore((s) => s.setUser);
  const [authState, setAuthState] = useState<AuthState>("loading");

  // Cargar usuario actual desde el backend vía cookie de sesión.
  // Solo se pide cuando hay indicios de sesión abierta.
  const meUrl = authState === "authenticated" ? "/api/me" : null;
  const { data: meData, loading } = useFetch<{ user: User }>(meUrl, [authState]);

  // Al montar: comprobar si hay sesión previa (flag en localStorage; la cookie
  // sessionid es HttpOnly y no se puede leer desde JS).
  useEffect(() => {
    const hasSession =
      typeof window !== "undefined" &&
      localStorage.getItem("electromed-session") === "1";
    setAuthState(hasSession ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    if (meData?.user) {
      setUser(meData.user);
      useAppStore.getState().hydrateFromUrl();
    } else if (authState === "authenticated" && !loading && !meData?.user) {
      // La sesión ya no es válida (cookie expirada / logout en otro lado).
      if (typeof window !== "undefined") {
        localStorage.removeItem("electromed-session");
      }
      setAuthState("anonymous");
    }
  }, [meData, loading, authState, setUser]);

  const handleLogin = (user: User) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("electromed-session", "1");
    }
    setUser(user);
    setAuthState("authenticated");
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("electromed-session");
    }
    setUser(null);
    setAuthState("anonymous");
  };

  // Pantalla de carga mientras se resuelve la sesión
  if ((authState === "loading" || authState === "authenticated") && loading) {
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

  // Sesión válida: mostrar la app
  if (meData?.user) {
    return <AppShell onLogout={handleLogout} />;
  }

  // Sin sesión: mostrar pantalla de login
  return <LoginView onLogin={handleLogin} />;
}
