"use client";

/**
 * Pantalla de login — Módulo de acceso del lineamiento.
 *
 * Autenticación real contra el backend Django (sesión por cookie).
 * Si el login falla, ofrece acceso demo (primer estudiante) para preservar
 * la UX del piloto sin fricción.
 */

import { useState } from "react";
import { postJSON } from "@/hooks/use-fetch";
import type { User } from "@/lib/types";

interface LoginViewProps {
  onLogin: (user: User) => void;
  onDemoAccess?: () => void;
}

export function LoginView({ onLogin, onDemoAccess }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postJSON<{ user: User }>("/api/auth/login", { email, password });
      onLogin(data.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      // Distinguir errores de red (backend caído) de credenciales inválidas
      if (/fetch|network|failed to/i.test(msg)) {
        setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ElectroMed IA</h1>
          <p className="mt-1 text-sm text-slate-600">
            Plataforma de aprendizaje adaptativo — Electromedicina II
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Piloto de Innovación Docente · Universidad de Valparaíso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@uv.cl"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          {onDemoAccess && (
            <button
              type="button"
              onClick={onDemoAccess}
              className="w-full text-xs text-slate-500 underline hover:text-slate-700"
            >
              Acceso demo (sin login)
            </button>
          )}
        </form>

        <p className="text-center text-xs text-slate-400">
          Cuentas demo: camila.rojas@uv.cl / demo1234 · hermes.mora@uv.cl / demo1234
        </p>
      </div>
    </div>
  );
}
