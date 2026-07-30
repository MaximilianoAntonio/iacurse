"use client";

/**
 * Pantalla de login — Módulo de acceso del lineamiento.
 *
 * Autenticación real contra el backend Django (sesión por cookie).
 * No hay modo demo: el acceso requiere credenciales válidas.
 *
 * Rediseño 2026 ("instrumento de precisión"): layout dividido con panel de
 * marca en tinta azul (retícula técnica + señal ámbar) y formulario sobre
 * porcelana. La entrada es una sola secuencia: el panel aparece y el
 * formulario entra en cascada.
 */

import { useState } from "react";
import { HeartPulse, Loader2, XCircle } from "lucide-react";
import { postJSON } from "@/hooks/use-fetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isRegister && password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        const data = await postJSON<{ user: User }>("/api/auth/register", {
          name: name.trim() || email.split("@")[0],
          email,
          password,
          password2,
        });
        onLogin(data.user);
      } else {
        const data = await postJSON<{ user: User }>("/api/auth/login", { email, password });
        onLogin(data.user);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      // Distinguir errores de red (backend caído) de errores de la API
      if (/fetch|network|failed to/i.test(msg)) {
        setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.");
      } else if (isRegister) {
        setError(msg);
      } else {
        setError("Credenciales inválidas. Verifica tu correo y contraseña.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---------- Panel de marca (tinta azul, solo ≥ lg) ---------- */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-ink p-12 text-sidebar-foreground animate-fade-in lg:flex xl:p-16">
        {/* Retícula técnica del panel de instrumento */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(241 245 250 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(241 245 250 / 0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold text-brand-ink shadow-sm">
            <HeartPulse className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            ElectroMed IA
          </span>
        </div>

        <div className="relative space-y-6">
          {/* Señal ámbar: única marca de acento del panel */}
          <div className="h-1 w-12 rounded-full bg-brand-gold" />
          <h1 className="max-w-md font-display text-4xl font-bold leading-[1.1] tracking-tight text-balance xl:text-5xl">
            Instrumento de precisión para tu aprendizaje
          </h1>
          <p className="max-w-md text-base leading-relaxed text-sidebar-foreground/75">
            Plataforma de aprendizaje adaptativo para Electromedicina II:
            contenido que se ajusta a tu nivel tras un diagnóstico inicial,
            actividades con retroalimentación inmediata y telemetría de tu
            progreso.
          </p>
          {/* Ficha de datos del piloto (mono = códigos e identificadores) */}
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-sidebar-foreground/15 pt-6 font-mono text-xs text-sidebar-foreground/60">
            <div>
              <dt className="sr-only">Asignatura</dt>
              <dd>Electromedicina II</dd>
            </div>
            <div>
              <dt className="sr-only">Código del proyecto</dt>
              <dd>UVA24991</dd>
            </div>
            <div>
              <dt className="sr-only">Unidad académica</dt>
              <dd>Facultad de Ingeniería</dd>
            </div>
          </dl>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">
          Piloto de Innovación Docente · Universidad de Valparaíso
        </p>
      </aside>

      {/* ---------- Panel del formulario (porcelana) ---------- */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
          {/* Marca compacta para móvil (el panel lateral está oculto) */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold text-brand-ink shadow-sm">
              <HeartPulse className="h-4.5 w-4.5" strokeWidth={2.25} />
            </div>
            <span className="font-display text-base font-bold tracking-tight">
              ElectroMed IA
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-title font-semibold">
              {isRegister ? "Crear cuenta" : "Acceso a la plataforma"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isRegister
                ? "Regístrate con tu correo institucional para empezar."
                : "Ingresa con tu correo institucional para continuar tu progreso."}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="stagger-children space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            {isRegister && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Nombre completo
                </label>
                <Input
                  id="name"
                  type="text"
                  required={isRegister}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre Apellido"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@uv.cl"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <label htmlFor="password2" className="text-sm font-medium">
                  Confirmar contraseña
                </label>
                <Input
                  id="password2"
                  type="password"
                  required={isRegister}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRegister ? "Creando cuenta…" : "Verificando credenciales…"}
                </>
              ) : (
                isRegister ? "Crear cuenta" : "Ingresar"
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode(isRegister ? "login" : "register");
                setError(null);
              }}
              className="w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-brand dark:hover:text-brand-gold"
            >
              {isRegister
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </form>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Cuentas demo — estudiante:{" "}
            <span className="font-mono">camila.rojas@uv.cl</span> · docente:{" "}
            <span className="font-mono">hermes.mora@uv.cl</span> · clave:{" "}
            <span className="font-mono">demo1234</span>
          </p>
        </div>
      </main>
    </div>
  );
}
