"use client";

/* eslint-disable react-hooks/set-state-in-effect --
 * Flujo de autenticación con restricciones de SSR: el efecto de montaje lee
 * localStorage (inaccesible durante el server render, por lo que no puede
 * ser init perezoso ni ajuste en render sin mismatch de hidratación) y el
 * efecto de error reacciona al fallo async de /api/me evitando la condición
 * de carrera documentada más abajo. Son los patrones correctos aquí.
 */

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

  // Pedir /api/me solo cuando hay indicios de sesión (flag en localStorage;
  // la cookie sessionid es HttpOnly y no se puede leer desde JS).
  const meUrl = authState === "authenticated" ? "/api/me" : null;
  const { data: meData, error } = useFetch<{ user: User }>(meUrl, [authState]);

  // Al montar: comprobar si hay sesión previa para reanudarla.
  useEffect(() => {
    const hasSession =
      typeof window !== "undefined" &&
      localStorage.getItem("electromed-session") === "1";
    setAuthState(hasSession ? "authenticated" : "anonymous");
  }, []);

  // Cuando /api/me confirma el usuario, hidratar el store.
  useEffect(() => {
    if (meData?.user) {
      setUser(meData.user);
      useAppStore.getState().hydrateFromUrl();
    }
  }, [meData, setUser]);

  // Si la sesión ya no es válida (401/403 del backend), volver al login.
  // Se basa en `error` (no en !data) para evitar una condición de carrera
  // durante la transición authenticated→fetch, que causaba un bucle de login.
  useEffect(() => {
    if (authState === "authenticated" && error && !meData?.user) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("electromed-session");
      }
      setAuthState("anonymous");
    }
  }, [authState, error, meData]);

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

  // Estado inicial: resolve del flag de sesión.
  if (authState === "loading") {
    return <LoadingScreen />;
  }

  if (authState === "authenticated") {
    // Sesión confirmada: mostrar la app.
    if (meData?.user) {
      return <AppShell onLogout={handleLogout} />;
    }
    // Esperando /api/me (cargando) o sesión caducada (error → el efecto de
    // arriba pasará a anonymous). En ambos casos, mostrar loader para evitar
    // un flash del LoginView que reiniciaría el flujo.
    return <LoadingScreen />;
  }

  // authState === "anonymous"
  return <LoginView onLogin={handleLogin} />;
}

function LoadingScreen() {
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
