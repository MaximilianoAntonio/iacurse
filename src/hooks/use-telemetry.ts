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
 * Inicia una sesión al montar, envía heartbeats cada 30s mientras la pestaña
 * está visible, y la finaliza al desmontar o al cerrar la pestaña
 * (beforeunload/visibilitychange=hidden).
 *
 * @param unitId  ID de la unidad en la que está el usuario (opcional)
 * @param enabled Si false, no hace nada (default true)
 */
export function useStudySessionTracker(unitId?: string, enabled = true): void {
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    endedRef.current = false;

    const startHeartbeat = () => {
      if (heartbeatRef.current) return;
      heartbeatRef.current = setInterval(() => {
        const sid = sessionIdRef.current;
        if (!sid || endedRef.current) return;
        postJSON("/api/telemetry/session/heartbeat", { sessionId: sid }).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    // Iniciar sesión al montar
    postJSON<{ sessionId: string }>("/api/telemetry/session/start", unitId ? { unitId } : {})
      .then((r) => {
        if (active) sessionIdRef.current = r.sessionId;
      })
      .catch(() => {
        // silencioso
      });

    startHeartbeat();

    // Finalizar sesión (con sendBeacon para sobrevivir al unload).
    // Usa API_BASE del módulo use-fetch para consistencia.
    const endSession = () => {
      const sid = sessionIdRef.current;
      if (!sid || endedRef.current) return;
      endedRef.current = true;
      stopHeartbeat();
      const payload = JSON.stringify({ sessionId: sid });
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      try {
        // sendBeacon no permite headers, pero el backend exenta esta ruta de CSRF
        navigator.sendBeacon?.(
          `${apiBase}/api/telemetry/session/end`,
          new Blob([payload], { type: "application/json" })
        );
      } catch {
        // fallback silencioso
      }
    };

    // Manejar cambios de visibilidad: pausar heartbeat al ocultar,
    // reanudar al volver visible (sin cerrar la sesión si es breve).
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopHeartbeat();
      } else if (document.visibilityState === "visible") {
        // Reabrir sesión si se cerró, o solo reanudar heartbeat
        if (endedRef.current && active) {
          endedRef.current = false;
          postJSON<{ sessionId: string }>(
            "/api/telemetry/session/start",
            unitId ? { unitId } : {}
          )
            .then((r) => {
              if (active) {
                sessionIdRef.current = r.sessionId;
                startHeartbeat();
              }
            })
            .catch(() => {});
        } else {
          startHeartbeat();
        }
      }
    };

    window.addEventListener("beforeunload", endSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      stopHeartbeat();
      endSession();
      window.removeEventListener("beforeunload", endSession);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [unitId, enabled]);
}
