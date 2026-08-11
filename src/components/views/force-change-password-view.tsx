"use client";

/**
 * Cambio de contraseña obligatorio — primer login o tras reset del docente.
 *
 * Pantalla completa (sin AppShell) con la misma estética del login: panel de
 * marca en tinta azul y formulario sobre porcelana. El estudiante no puede
 * usar la app hasta establecer una contraseña personal; al éxito se invoca
 * ``onPasswordChanged`` y el gate de ``page.tsx`` deja pasar a la app.
 */

import { useState } from "react";
import { HeartPulse, KeyRound, Loader2, XCircle } from "lucide-react";
import { postJSON } from "@/hooks/use-fetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ForceChangePasswordViewProps {
  onPasswordChanged: () => void;
}

export function ForceChangePasswordView({
  onPasswordChanged,
}: ForceChangePasswordViewProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validación cliente mínima (el backend aplica los validadores de Django)
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await postJSON("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      onPasswordChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cambiar la contraseña."
      );
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
          <div className="h-1 w-12 rounded-full bg-brand-gold" />
          <h1 className="max-w-md font-display text-4xl font-bold leading-[1.1] tracking-tight text-balance xl:text-5xl">
            Protege tu cuenta antes de continuar
          </h1>
          <p className="max-w-md text-base leading-relaxed text-sidebar-foreground/75">
            Tu contraseña actual es temporal. Por seguridad debes establecer
            una contraseña personal antes de continuar: solo tú la conocerás
            y nadie más podrá entrar con tu código.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">
          Piloto de Innovación Docente · Universidad de Valparaíso
        </p>
      </aside>

      {/* ---------- Panel del formulario (porcelana) ---------- */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
          {/* Marca compacta para móvil */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold text-brand-ink shadow-sm">
              <HeartPulse className="h-4.5 w-4.5" strokeWidth={2.25} />
            </div>
            <span className="font-display text-base font-bold tracking-tight">
              ElectroMed IA
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="font-display text-title font-semibold">
              Establece tu contraseña personal
            </h2>
            <p className="text-sm text-muted-foreground">
              Por seguridad debes establecer una contraseña personal antes de
              continuar. Mínimo 8 caracteres.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="stagger-children space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm font-medium">
                Contraseña actual (temporal)
              </label>
              <Input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                Nueva contraseña
              </label>
              <Input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirmar nueva contraseña
              </label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

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
                  Guardando contraseña…
                </>
              ) : (
                "Guardar y continuar"
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
