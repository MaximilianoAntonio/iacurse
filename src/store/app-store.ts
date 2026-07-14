"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User, ViewKey } from "@/lib/types";

interface AppState {
  // Auth
  currentUserId: string | null;
  currentUser: User | null;
  role: Role;
  setUser: (user: User | null) => void;
  switchUser: (userId: string) => void;
  setRole: (role: Role) => void;

  // Navigation (sincronizado con la URL)
  view: ViewKey;
  currentUnitId: string | null;
  currentLessonId: string | null;
  currentActivityId: string | null;
  tutorContextUnit: string | null;
  navigate: (view: ViewKey) => void;
  openUnit: (unitId: string) => void;
  openLesson: (lessonId: string) => void;
  openActivity: (activityId: string) => void;
  setTutorContext: (unitTitle: string | null) => void;
  hydrateFromUrl: () => void;
  setNavFromUrl: (nav: Partial<Pick<AppState, "view" | "currentUnitId" | "currentLessonId" | "currentActivityId" | "tutorContextUnit">>) => void;

  // Panel de chat (barra lateral derecha)
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  resetNav: () => void;
}

// Vistas permitidas por rol
const STUDENT_VIEWS: ViewKey[] = ["dashboard", "units", "unit-detail", "lesson", "activity", "progress", "achievements", "about"];
const TEACHER_VIEWS: ViewKey[] = ["dashboard", "units", "unit-detail", "lesson", "activity", "teacher", "about"];

function isViewAllowed(view: ViewKey, role: Role): boolean {
  return role === "teacher" ? TEACHER_VIEWS.includes(view) : STUDENT_VIEWS.includes(view);
}

// Construye la URL a partir del estado de navegación
function buildUrl(view: ViewKey, unitId?: string | null, lessonId?: string | null, activityId?: string | null): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (unitId) params.set("u", unitId);
  if (lessonId) params.set("l", lessonId);
  if (activityId) params.set("a", activityId);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

// Lee el estado de navegación desde la URL actual
function parseUrl(): {
  view: ViewKey;
  unitId: string | null;
  lessonId: string | null;
  activityId: string | null;
} {
  if (typeof window === "undefined") {
    return { view: "dashboard", unitId: null, lessonId: null, activityId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const view = (params.get("view") as ViewKey) || "dashboard";
  const unitId = params.get("u");
  const lessonId = params.get("l");
  const activityId = params.get("a");
  let resolvedView: ViewKey = view;
  if (unitId && view === "dashboard") resolvedView = "unit-detail";
  if (lessonId && view === "dashboard") resolvedView = "lesson";
  if (activityId && view === "dashboard") resolvedView = "activity";
  return { view: resolvedView, unitId, lessonId, activityId };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      currentUser: null,
      role: "student",
      setUser: (user) => {
        const newRole = (user?.role as Role) ?? "student";
        set((state) => {
          if (state.role !== newRole) {
            // Al cambiar de rol, determinar la vista destino:
            // - Si la URL tiene una vista válida para el nuevo rol, usarla.
            // - Si no, ir al dashboard.
            let targetView: ViewKey = "dashboard";
            let targetUnitId: string | null = null;
            let targetLessonId: string | null = null;
            let targetActivityId: string | null = null;
            if (typeof window !== "undefined") {
              const parsed = parseUrl();
              if (parsed.view && isViewAllowed(parsed.view, newRole)) {
                targetView = parsed.view;
                targetUnitId = parsed.unitId;
                targetLessonId = parsed.lessonId;
                targetActivityId = parsed.activityId;
              }
            }
            return {
              currentUser: user,
              currentUserId: user?.id ?? null,
              role: newRole,
              view: targetView,
              currentUnitId: targetUnitId,
              currentLessonId: targetLessonId,
              currentActivityId: targetActivityId,
              tutorContextUnit: null,
            };
          }
          return {
            currentUser: user,
            currentUserId: user?.id ?? null,
            role: newRole,
          };
        });
      },
      switchUser: (userId) => set({ currentUserId: userId }),
      setRole: (role) => set({ role }),

      view: "dashboard",
      currentUnitId: null,
      currentLessonId: null,
      currentActivityId: null,
      tutorContextUnit: null,

      navigate: (view) => {
        set({ view, currentUnitId: null, currentLessonId: null, currentActivityId: null });
        if (typeof window !== "undefined") {
          const url = buildUrl(view);
          window.history.pushState({ view }, "", url);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      openUnit: (unitId) => {
        set({ currentUnitId: unitId, currentLessonId: null, currentActivityId: null, view: "unit-detail" });
        if (typeof window !== "undefined") {
          const url = buildUrl("unit-detail", unitId);
          window.history.pushState({ view: "unit-detail", unitId }, "", url);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      openLesson: (lessonId) => {
        set({ currentLessonId: lessonId, currentActivityId: null, view: "lesson" });
        if (typeof window !== "undefined") {
          const url = buildUrl("lesson", undefined, lessonId);
          window.history.pushState({ view: "lesson", lessonId }, "", url);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      openActivity: (activityId) => {
        const lessonId = get().currentLessonId;
        set({ currentActivityId: activityId, view: "activity" });
        if (typeof window !== "undefined") {
          const url = buildUrl("activity", undefined, lessonId, activityId);
          window.history.pushState({ view: "activity", activityId, lessonId }, "", url);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      setTutorContext: (unitTitle) => set({ tutorContextUnit: unitTitle }),

      hydrateFromUrl: () => {
        const parsed = parseUrl();
        const currentRole = get().role;
        // Validar que la vista de la URL esté permitida para el rol actual
        const view = parsed.view && isViewAllowed(parsed.view, currentRole) ? parsed.view : "dashboard";
        set({
          view,
          currentUnitId: view === "dashboard" ? null : parsed.unitId,
          currentLessonId: view === "dashboard" ? null : parsed.lessonId,
          currentActivityId: view === "dashboard" ? null : parsed.activityId,
        });
      },
      setNavFromUrl: (nav) => set(nav),

      chatOpen: false,
      setChatOpen: (open) => set({ chatOpen: open }),
      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      resetNav: () => {
        set({ view: "dashboard", currentUnitId: null, currentLessonId: null, currentActivityId: null });
        if (typeof window !== "undefined") {
          window.history.pushState({ view: "dashboard" }, "", "/");
        }
      },
    }),
    {
      name: "electromed-store",
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        chatOpen: state.chatOpen,
      }),
    }
  )
);
