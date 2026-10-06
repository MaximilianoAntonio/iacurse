"use client";

import * as React from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Aviso de cookies y almacenamiento local (transparencia Ley 21.719).
 *
 * La plataforma solo usa cookies estrictamente necesarias —`sessionid`
 * (sesión) y `csrftoken` (protección CSRF)— y localStorage para
 * preferencias del equipo (p. ej. tamaño de letra) y borradores; no hay
 * cookies de terceros, analítica ni publicidad. Al ser todas esenciales,
 * basta un aviso informativo con aceptación: no hay opción de rechazo
 * porque sin ellas el login no funciona.
 *
 * Se muestra una sola vez por equipo (se monta en `layout.tsx`, también en
 * la pantalla de login, donde ya se instalan cookies). La marca en
 * localStorage se conserva al cerrar sesión, igual que `electromed_reader_font`:
 * es preferencia del equipo, no de la persona.
 */

const STORAGE_KEY = "electromed_cookie_notice";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// "seen" oculta el aviso; null lo muestra
function getSnapshot(): "seen" | null {
  return window.localStorage.getItem(STORAGE_KEY) === "1" ? "seen" : null;
}

// SSR y primer render: oculto (hidrata sin mismatch ni flash del aviso)
function getServerSnapshot(): "seen" | null {
  return "seen";
}

export function CookieNotice() {
  const seen = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const accept = React.useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    // El snapshot no cambia solo con setItem en la misma pestaña; forzamos
    // el re-render notificando a los suscriptores del store.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  if (seen === "seen") return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="animate-fade-in-up fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl sm:left-6 sm:right-auto sm:mx-0"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Cookie className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold leading-tight">
            Uso de cookies
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Esta plataforma utiliza únicamente cookies técnicas esenciales
            para la sesión y la seguridad, y almacenamiento local para tus
            preferencias. No usamos cookies de publicidad ni de seguimiento
            de terceros (Ley N° 21.719).
          </p>
          <Button type="button" size="sm" className="w-full" onClick={accept}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}
