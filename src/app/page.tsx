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
import { ForceChangePasswordView } from "@/components/views/force-change-password-view";
import { CourseDiagnosticView } from "@/components/views/course-diagnostic-view";
import type { CourseStatus, User } from "@/lib/types";

type AuthState = "loading" | "authenticated" | "anonymous";

/**
 * Borra los datos locales de la sesión al cerrarla (privacidad en equipos
 * compartidos, p. ej. laboratorios): flag de sesión, store persistido con el
 * perfil del usuario, borradores de respuestas y del editor docente, e
 * historial de búsqueda. Se conserva la preferencia de tamaño de letra
 * (`electromed_reader_font`), que es del equipo y no de la persona.
 */
function clearLocalSessionData() {
  if (typeof window === "undefined") return;
  const exact = ["electromed-session", "electromed-store", "electromed-search-history"];
  const prefixes = [
    "electromed_draft_",
    "electromed_checkpoint_draft_",
    "electromed_lesson_editor_draft_",
  ];
  const toDelete: string[] = [...exact];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && prefixes.some((p) => key.startsWith(p))) toDelete.push(key);
  }
  toDelete.forEach((k) => localStorage.removeItem(k));
}

export default function Home() {
  const setUser = useAppStore((s) => s.setUser);
  const [authState, setAuthState] = useState<AuthState>("loading");
  // Gate de cambio de contraseña obligatorio: true una vez completado en esta sesión
  const [passwordChanged, setPasswordChanged] = useState(false);
  // Gate del diagnóstico general del curso: true una vez enviado en esta sesión
  const [diagnosticDone, setDiagnosticDone] = useState(false);

  // Pedir /api/me solo cuando hay indicios de sesión (flag en localStorage;
  // la cookie sessionid es HttpOnly y no se puede leer desde JS).
  const meUrl = authState === "authenticated" ? "/api/me" : null;
  const { data: meData, error } = useFetch<{ user: User }>(meUrl, [authState]);

  // Estado del curso (diagnóstico general): solo para estudiantes autenticados.
  // Los docentes saltan este gate.
  const isStudent = meData?.user?.role === "student";
  const statusUrl =
    authState === "authenticated" && isStudent ? "/api/course/status" : null;
  const { data: courseStatus, loading: statusLoading } = useFetch<CourseStatus>(
    statusUrl,
    [authState, isStudent]
  );

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
      clearLocalSessionData();
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
    clearLocalSessionData();
    setUser(null);
    setPasswordChanged(false);
    setDiagnosticDone(false);
    setAuthState("anonymous");
  };

  // Estado inicial: resolve del flag de sesión.
  if (authState === "loading") {
    return <LoadingScreen />;
  }

  if (authState === "authenticated") {
    // Sesión confirmada: mostrar la app.
    if (meData?.user) {
      // Cambio de contraseña obligatorio (primer login o reset del docente):
      // bloquea la app hasta completarlo, tanto en login fresco como en
      // sesión reanudada (ambos flujos pasan por /api/me).
      if (meData.user.mustChangePassword && !passwordChanged) {
        return (
          <ForceChangePasswordView
            onPasswordChanged={() => {
              setUser({ ...meData.user, mustChangePassword: false });
              setPasswordChanged(true);
            }}
          />
        );
      }
      // Diagnóstico general del curso (obligatorio, sin opción de saltar):
      // solo estudiantes, después del cambio de contraseña y antes de la app.
      // Si /api/course/status falla no se bloquea el acceso (fail-open).
      if (meData.user.role === "student" && !diagnosticDone) {
        if (courseStatus && !courseStatus.diagnosticCompleted) {
          return (
            <CourseDiagnosticView
              questions={courseStatus.diagnosticQuestions ?? []}
              onCompleted={() => setDiagnosticDone(true)}
            />
          );
        }
        if (!courseStatus && statusLoading) {
          return <LoadingScreen />;
        }
      }
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
