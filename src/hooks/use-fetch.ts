"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Backend Django (lineamiento: Backend Python).
// Las URLs relativas /api/... se redirigen al backend Django configurado por
// NEXT_PUBLIC_API_URL (default http://localhost:8000). Si la URL ya es absoluta
// (http/https), se usa tal cual.
// ---------------------------------------------------------------------------
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function resolveUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
}

// Token CSRF: el backend Django lo requiere para POST/PATCH/DELETE con
// SessionAuthentication. Se obtiene de la cookie csrftoken (SameSite=Lax).
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Asegura que la cookie CSRF exista antes del primer POST (fetch GET a /api/auth/csrf).
// Re-valida si la cookie caduca (no se cachea indefinidamente).
// La promesa compartida evita races entre POSTs simultáneos.
let csrfPromise: Promise<void> | null = null;
async function ensureCsrf(): Promise<void> {
  // Si ya hay cookie válida, no hacer nada
  if (getCsrfToken()) return;
  // Si hay un ensure en vuelo, esperar a que termine (evita doble fetch)
  if (csrfPromise) {
    await csrfPromise;
    return;
  }
  csrfPromise = fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" })
    .then(() => undefined)
    .catch(() => {
      // silencioso: el backend podría no exigir CSRF en algunos modos
    })
    .finally(() => {
      csrfPromise = null;
    });
  await csrfPromise;
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFetch<T>(url: string | null, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Reset sincrónico cuando cambia la URL (patrón "ajustar estado durante el
  // render"): sin esto el efecto haría setState sincrónico en su cuerpo.
  // Nota: refetch() NO activa `loading` para no parpadear el skeleton sobre
  // los datos ya mostrados.
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setData(null);
    setError(null);
    setLoading(Boolean(url));
  }

  useEffect(() => {
    if (!url) return;
    let active = true;
    fetch(resolveUrl(url), { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (active) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message ?? "Error de carga");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [url, tick, ...deps]);

  return { data, loading, error, refetch };
}

// Hook para peticiones POST
export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  await ensureCsrf();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRFToken"] = csrf;
  const r = await fetch(resolveUrl(url), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    // DRF devuelve errores de serializer como {"campo": ["mensaje", ...]}:
    // propagar el primer mensaje para que la UI lo muestre al usuario.
    const firstField = Object.values(err).find(
      (v) => Array.isArray(v) && v.length > 0
    );
    const msg =
      err.error ??
      (firstField ? String((firstField as unknown[])[0]) : `Error ${r.status}`);
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}

export async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  await ensureCsrf();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRFToken"] = csrf;
  const r = await fetch(resolveUrl(url), {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json() as Promise<T>;
}

export async function deleteURL(url: string): Promise<void> {
  await ensureCsrf();
  const headers: Record<string, string> = {};
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRFToken"] = csrf;
  const r = await fetch(resolveUrl(url), {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
}

// Sube un archivo (multipart/form-data) al backend. No fija Content-Type:
// el navegador genera el boundary del FormData automáticamente.
export async function uploadFile(url: string, file: File): Promise<{ url: string }> {
  await ensureCsrf();
  const headers: Record<string, string> = {};
  const csrf = getCsrfToken();
  if (csrf) headers["X-CSRFToken"] = csrf;
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(resolveUrl(url), {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error ?? `Error ${r.status}`);
  }
  return r.json() as Promise<{ url: string }>;
}
