"use client";

/**
 * Hooks de telemetría para el frontend React.
 *
 * Cumplen el lineamiento (Sección 12):
 * - Tiempo de interacción → useStudySessionTracker (heartbeat cada 30s)
 * - Frecuencia de uso → derivada de las sesiones registradas
 * - Eventos de analítica → useTrackEvent (endpoint genérico)
 *
 * El backend Django registra StudySession real en producción (no solo seed).
 */

import { useEffect, useRef } from "react";
import { postJSON } from "./use-fetch";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 segundos

/**
 * Registra un evento genérico de telemetría en el backend.
 *
 * Ejemplos: page_view, open_lesson, request_hint, open_chat, submit_attempt.
 */
export async function trackEvent(
  eventType: string,
  metadata: Record<string, unknown> = {},
  context?: { unitId?: string; lessonId?: string; activityId?: string }
): Promise<void> {
  try {
    await postJSON("/api/telemetry/event", {
      eventType,
      metadata,
      ...(context?.unitId ? { unitId: context.unitId } : {}),
      ...(context?.lessonId ? { lessonId: context.lessonId } : {}),
      ...(context?.activityId ? { activityId: context.activityId } : {}),
    });
  } catch {
    // La telemetría nunca debe romper la UX
  }
}

/**
 * Hook para trackear el tiempo de interacción real del estudiante.
 *
 * Inicia una sesión al montar, envía heartbeats cada 30s, y la finaliza
 * al desmontar o al cerrar la pestaña (beforeunload/visibilitychange).
 *
 * @param unitId  ID de la unidad en la que está el usuario (opcional)
 * @param enabled Si false, no hace nada (default true)
 */
export function useStudySessionTracker(unitId?: string, enabled = true): void {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    // Iniciar sesión al montar
    postJSON<{ sessionId: string }>("/api/telemetry/session/start", unitId ? { unitId } : {})
      .then((r) => {
        if (active) sessionIdRef.current = r.sessionId;
      })
      .catch(() => {
        // silencioso
      });

    // Heartbeat cada 30s
    const heartbeatInterval = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      postJSON("/api/telemetry/session/heartbeat", { sessionId: sid }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    // Finalizar sesión al desmontar o cerrar pestaña
    const endSession = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      // sendBeacon para que funcione aunque la pestaña se esté cerrando
      const payload = JSON.stringify({ sessionId: sid });
      try {
        navigator.sendBeacon?.(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/telemetry/session/end`,
          new Blob([payload], { type: "application/json" })
        );
      } catch {
        // fallback silencioso
      }
    };

    window.addEventListener("beforeunload", endSession);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") endSession();
    });

    return () => {
      active = false;
      clearInterval(heartbeatInterval);
      endSession();
      window.removeEventListener("beforeunload", endSession);
    };
  }, [unitId, enabled]);
}
