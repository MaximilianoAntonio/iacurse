"use client";

// Este hook realiza fetching de datos en efectos, lo que requiere llamar setState
// dentro del effect. Es el patrón estándar de fetching en React.
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (active) {
          setData(json);
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
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error ?? `Error ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json() as Promise<T>;
}
