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

  // Navigation
  view: ViewKey;
  currentUnitId: string | null;
  currentLessonId: string | null;
  currentActivityId: string | null;
  // Tutor context
  tutorContextUnit: string | null;
  navigate: (view: ViewKey) => void;
  openUnit: (unitId: string) => void;
  openLesson: (lessonId: string) => void;
  openActivity: (activityId: string) => void;
  setTutorContext: (unitTitle: string | null) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  resetNav: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: null,
      currentUser: null,
      role: "student",
      setUser: (user) => {
        const newRole = (user?.role as Role) ?? "student";
        set((state) => ({
          currentUser: user,
          currentUserId: user?.id ?? null,
          role: newRole,
          // Si el rol cambia, volver al dashboard si la vista actual no aplica
          view:
            state.role !== newRole
              ? "dashboard"
              : state.view,
          currentUnitId: state.role !== newRole ? null : state.currentUnitId,
          currentLessonId: state.role !== newRole ? null : state.currentLessonId,
          currentActivityId: state.role !== newRole ? null : state.currentActivityId,
        }));
      },
      switchUser: (userId) => set({ currentUserId: userId }),
      setRole: (role) => set({ role }),

      view: "dashboard",
      currentUnitId: null,
      currentLessonId: null,
      currentActivityId: null,
      tutorContextUnit: null,
      navigate: (view) => {
        set({ view });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      openUnit: (unitId) =>
        set({ currentUnitId: unitId, currentLessonId: null, currentActivityId: null, view: "unit-detail" }),
      openLesson: (lessonId) =>
        set({ currentLessonId: lessonId, currentActivityId: null, view: "lesson" }),
      openActivity: (activityId) => set({ currentActivityId: activityId, view: "activity" }),
      setTutorContext: (unitTitle) => set({ tutorContextUnit: unitTitle }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      resetNav: () =>
        set({
          view: "dashboard",
          currentUnitId: null,
          currentLessonId: null,
          currentActivityId: null,
        }),
    }),
    {
      name: "electromed-store",
      partialize: (state) => ({ currentUserId: state.currentUserId }),
    }
  )
);
