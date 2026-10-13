"use client";

/**
 * Pantalla de login — Módulo de acceso del lineamiento.
 *
 * Autenticación real contra el backend Django (sesión por cookie).
 * No hay modo demo ni registro público: el docente crea las cuentas de
 * estudiantes (anonimizadas, por código) y resetea sus contraseñas.
 * El login exige un captcha autoalojado (operación matemática, un solo uso,
 * `GET /api/captcha/refresh/`) y el backend aplica rate limit por IP.
 *
 * Rediseño 2026 ("instrumento de precisión"): layout dividido con panel de
 * marca en tinta azul (retícula técnica + señal ámbar) y formulario sobre
 * porcelana. La entrada es una sola secuencia: el panel aparece y el
 * formulario entra en cascada.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, MailCheck, RotateCcw, XCircle } from "lucide-react";
import { API_BASE, postJSON } from "@/hooks/use-fetch";
import { LogoMark } from "@/components/app/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";

interface LoginViewProps {
  onLogin: (user: User) => void;
}

interface CaptchaChallenge {
  key: string;
  image_url: string;
}

interface LoginResponse {
  user?: User;
  mfaRequired?: boolean;
  challengeId?: string;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaValue, setCaptchaValue] = useState("");
  const [captchaError, setCaptchaError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // MFA docente (hallazgo 2.9): tras validar la contraseña, el backend envía
  // un código de un solo uso al email institucional del docente.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaNotice, setMfaNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // El captcha es de un solo uso: se pide uno nuevo al montar la vista y tras
  // cada intento de login (éxito o fallo). Requiere el header X-Requested-With.
  const loadCaptcha = useCallback(() => {
    fetch(`${API_BASE}/api/captcha/refresh/`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((json: CaptchaChallenge) => {
        setCaptcha(json);
        setCaptchaValue("");
        setCaptchaError(false);
      })
      .catch(() => {
        setCaptcha(null);
        setCaptchaError(true);
      });
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  // Cooldown del botón de reenvío del código MFA (60 s entre envíos).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await postJSON<LoginResponse>("/api/auth/login", {
        identifier: identifier.trim(),
        password,
        captchaKey: captcha?.key ?? "",
        captchaValue: captchaValue.trim(),
      });
      if (data.mfaRequired && data.challengeId) {
        // Docente: la contraseña es correcta; falta el código enviado al email.
        setMfaChallenge(data.challengeId);
        setMfaNotice(null);
        setResendCooldown(60);
        return;
      }
      if (data.user) onLogin(data.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      // Distinguir errores de red (backend caído) de errores de la API
      if (/fetch|network|failed to/i.test(msg)) {
        setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.");
      } else if (/429|throttl/i.test(msg)) {
        setError("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
      } else if (/captcha/i.test(msg)) {
        setError(msg);
      } else {
        setError("Credenciales inválidas. Verifica tu código o correo y contraseña.");
      }
      // El captcha quedó consumido por el intento: pedir uno nuevo
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setError(null);
    setMfaNotice(null);
    setLoading(true);
    try {
      const data = await postJSON<{ user: User }>("/api/auth/login/mfa", {
        challengeId: mfaChallenge,
        code: mfaCode.trim(),
      });
      onLogin(data.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al verificar el código";
      if (/fetch|network|failed to/i.test(msg)) {
        setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.");
      } else if (/429|throttl/i.test(msg)) {
        setError("Demasiados intentos. Espera un minuto e inténtalo de nuevo.");
      } else {
        setError(msg || "Código incorrecto o expirado.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaResend = async () => {
    if (!mfaChallenge || resendCooldown > 0) return;
    setError(null);
    setMfaNotice(null);
    try {
      await postJSON("/api/auth/login/mfa", {
        challengeId: mfaChallenge,
        resend: true,
      });
      setMfaNotice("Te enviamos un código nuevo a tu correo institucional.");
      setResendCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo reenviar el código";
      setError(msg);
    }
  };

  const handleMfaBack = () => {
    setMfaChallenge(null);
    setMfaCode("");
    setMfaNotice(null);
    setError(null);
    loadCaptcha();
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
          <LogoMark className="h-10 w-10 shadow-sm" />
          <span className="font-display text-lg font-bold tracking-tight">
            CAAMI
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
            <LogoMark className="h-9 w-9 shadow-sm" />
            <span className="font-display text-base font-bold tracking-tight">
              CAAMI
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-title font-semibold">
              Acceso a la plataforma
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu código de estudiante o correo docente para
              continuar tu progreso.
            </p>
          </div>

          {mfaChallenge ? (
            /* ---- Segundo paso: código MFA enviado al email docente ---- */
            <form
              onSubmit={handleMfaSubmit}
              className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-in-up"
            >
              <div className="flex items-start gap-3 rounded-md bg-primary/5 px-3 py-2.5 text-sm">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Enviamos un código de verificación de 6 dígitos a tu correo
                  institucional. Vence en 10 minutos.
                </span>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mfa-code" className="text-sm font-medium">
                  Código de verificación
                </label>
                <Input
                  id="mfa-code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="font-mono text-lg tracking-[0.5em]"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>

              {mfaNotice && (
                <p role="status" className="text-xs text-muted-foreground">
                  {mfaNotice}
                </p>
              )}

              {error && (
                <div
                  id="login-error"
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
                disabled={loading || mfaCode.length !== 6}
                className="w-full font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando código…
                  </>
                ) : (
                  "Verificar e ingresar"
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleMfaBack}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleMfaResend}
                  disabled={resendCooldown > 0}
                  className="text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Reenviar código (${resendCooldown}s)`
                    : "Reenviar código"}
                </button>
              </div>
            </form>
          ) : (
          <form
            onSubmit={handleSubmit}
            className="stagger-children space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-sm font-medium">
                Código de estudiante o correo docente
              </label>
              <Input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Tu código o nombre@uv.cl"
                autoComplete="username"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
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
                autoComplete="current-password"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>

            {/* Captcha anti fuerza bruta (operación matemática autoalojada) */}
            <div className="space-y-1.5">
              <label htmlFor="captcha" className="text-sm font-medium">
                Verificación humana
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-16 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                  {captcha ? (
                    <img
                      src={`${API_BASE}${captcha.image_url}`}
                      alt="Captcha: resuelve la operación matemática"
                      className="max-h-full w-auto"
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-muted-foreground">
                      {captchaError
                        ? "No se pudo cargar el captcha"
                        : "Cargando captcha…"}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={loadCaptcha}
                  title="Generar otro captcha"
                  aria-label="Generar otro captcha"
                  className="h-10 w-10 shrink-0"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <Input
                id="captcha"
                type="text"
                required
                inputMode="numeric"
                autoComplete="off"
                value={captchaValue}
                onChange={(e) => setCaptchaValue(e.target.value)}
                placeholder="Resultado de la operación"
              />
              <p className="text-xs text-muted-foreground">
                Resuelve la operación de la imagen para confirmar que no eres
                un robot.
              </p>
            </div>

            {error && (
              <div
                id="login-error"
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
                  Verificando credenciales…
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            ¿Olvidaste tu contraseña? Solicita al docente que la reinicie.
          </p>
        </div>
      </main>
    </div>
  );
}
