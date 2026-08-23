"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "electromed_draft_";

/** Clave de almacenamiento local de un borrador: electromed_draft_<tipo>_<id>. */
function draftStorageKey(type: string, id: string): string {
  return `${PREFIX}${type}_${id}`;
}

/**
 * Elimina todos los borradores asociados a una actividad.
 * Se invoca tras un envío exitoso (handleSubmit) para no revivir
 * respuestas que el servidor ya registró.
 */
export function clearActivityDrafts(activityId: string): void {
  if (typeof window === "undefined") return;
  try {
    const suffix = `_${activityId}`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX) && key.endsWith(suffix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error("No se pudieron limpiar los borradores de la actividad", e);
  }
}

interface UseDraftGuardOptions<T> {
  /** Tipo de borrador (p.ej. "guided_problem"); compone la clave de storage. */
  type: string;
  /** Identificador único del recurso (p.ej. activity.id). */
  id: string;
  /** Valor inicial cuando no existe un borrador previo. */
  initialValue: T | (() => T);
  /** true si el valor se considera vacío (los valores vacíos no se persisten). */
  isEmpty: (value: T) => boolean;
  /** Valida un borrador restaurado; si falla, se descarta y se usa initialValue. */
  validate?: (value: T) => boolean;
  /** true tras enviar: deja de persistir y desactiva la advertencia de salida. */
  disabled?: boolean;
}

interface DraftGuardMeta {
  /** Hay contenido no vacío que queda persistido como borrador. */
  hasDraft: boolean;
  /** Elimina el borrador de storage. */
  clearDraft: () => void;
}

/**
 * Autoguardado de respuestas largas en localStorage (patrón
 * `electromed_draft_<tipo>_<id>`, como los drafts de unit-detail).
 *
 * Devuelve una tupla [valor, setValor, meta] análoga a useState:
 * - Restaura el borrador al montar (el renderer se remonta con key={resetKey},
 *   por lo que el borrador sobrevive a navegaciones dentro de la app).
 * - Persiste en cada cambio mientras el valor no esté vacío ni deshabilitado.
 * - Registra `beforeunload` para advertir al salir con contenido sin enviar.
 *
 * El borrador NO se limpia aquí: eso lo hace clearActivityDrafts() tras un
 * envío exitoso, para no perder la respuesta si el intento falla.
 */
export function useDraftGuard<T>({
  type,
  id,
  initialValue,
  isEmpty,
  validate,
  disabled = false,
}: UseDraftGuardOptions<T>): [T, React.Dispatch<React.SetStateAction<T>>, DraftGuardMeta] {
  const key = draftStorageKey(type, id);

  const [value, setValue] = useState<T>(() => {
    const base =
      typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue;
    if (typeof window === "undefined") return base;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        const valid = validate ? validate(parsed) : true;
        if (valid && !isEmpty(parsed)) return parsed;
      }
    } catch (e) {
      console.error("No se pudo restaurar el borrador", e);
    }
    return base;
  });

  // El indicador se deriva: hay borrador mientras el valor no esté vacío
  const hasDraft = !isEmpty(value);

  // Persistir en cada cambio (mientras no esté vacío ni deshabilitado)
  useEffect(() => {
    if (disabled) return;
    try {
      if (isEmpty(value)) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.error("No se pudo guardar el borrador", e);
    }
    // isEmpty llega inline desde el caller; solo value/key/disabled gatillan escritura
  }, [key, value, disabled]);

  // Advertir al cerrar/recargar la pestaña con contenido sin enviar
  useEffect(() => {
    if (disabled || !hasDraft) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [disabled, hasDraft]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("No se pudo eliminar el borrador", e);
    }
  }, [key]);

  return [value, setValue, { hasDraft, clearDraft }];
}
