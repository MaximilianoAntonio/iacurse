"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User, ViewKey } from "@/lib/types";

export interface Tab {
  id: string; // determinist: "s:<view>" | "u:<unitId>" | "l:<lessonId>" | "a:<activityId>"
  kind: "singleton" | "unit" | "lesson" | "activity";
  view: ViewKey;
  title: string;
  icon: string;
  unitId?: string;
  lessonId?: string;
  activityId?: string;
  closable: boolean;
  createdAt: number;
}

interface OpenTabInput {
  kind: Tab["kind"];
  view: ViewKey;
  title: string;
  icon: string;
  unitId?: string;
  lessonId?: string;
  activityId?: string;
  closable?: boolean;
}

interface AppState {
  // Auth
  currentUserId: string | null;
  currentUser: User | null;
  role: Role;
  setUser: (user: User | null) => void;
  switchUser: (userId: string) => void;
  setRole: (role: Role) => void;

  // Tabs (sistema de pestañas tipo navegador)
  tabs: Tab[];
  activeTabId: string;
  openTab: (input: OpenTabInput) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllClosable: () => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, patch: Partial<Pick<Tab, "title" | "icon">>) => void;

  // Derived from active tab (for backwards-compat with views)
  view: ViewKey;
  currentUnitId: string | null;
  currentLessonId: string | null;
  currentActivityId: string | null;
  tutorContextUnit: string | null;
  setTutorContext: (unitTitle: string | null) => void;

  // Navigation helpers (route through openTab)
  navigate: (view: ViewKey) => void;
  openUnit: (unitId: string) => void;
  openLesson: (lessonId: string) => void;
  openActivity: (activityId: string) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  resetNav: () => void;
}

// Metadata para tabs singleton (vistas globales)
const singletonTabMeta: Record<string, { title: string; icon: string; closable: boolean }> = {
  dashboard: { title: "Inicio", icon: "LayoutDashboard", closable: false },
  units: { title: "Unidades", icon: "BookOpen", closable: true },
  tutor: { title: "Tutor IA", icon: "MessageSquare", closable: true },
  progress: { title: "Mi progreso", icon: "BarChart3", closable: true },
  achievements: { title: "Logros", icon: "Trophy", closable: true },
  teacher: { title: "Panel docente", icon: "Users", closable: true },
  about: { title: "Acerca de", icon: "Info", closable: true },
};

function makeHomeTab(): Tab {
  return {
    id: "s:dashboard",
    kind: "singleton",
    view: "dashboard",
    title: "Inicio",
    icon: "LayoutDashboard",
    closable: false,
    createdAt: Date.now(),
  };
}

function syncDerived(tab: Tab) {
  return {
    view: tab.view,
    currentUnitId: tab.unitId ?? null,
    currentLessonId: tab.lessonId ?? null,
    currentActivityId: tab.activityId ?? null,
  };
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
          // Si el rol cambia, resetear tabs al home
          if (state.role !== newRole) {
            const home = makeHomeTab();
            return {
              currentUser: user,
              currentUserId: user?.id ?? null,
              role: newRole,
              tabs: [home],
              activeTabId: home.id,
              ...syncDerived(home),
              currentUnitId: null,
              currentLessonId: null,
              currentActivityId: null,
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

      tabs: [makeHomeTab()],
      activeTabId: "s:dashboard",
      view: "dashboard",
      currentUnitId: null,
      currentLessonId: null,
      currentActivityId: null,
      tutorContextUnit: null,

      openTab: (input) => {
        const id =
          input.kind === "singleton"
            ? `s:${input.view}`
            : input.kind === "unit"
            ? `u:${input.unitId}`
            : input.kind === "lesson"
            ? `l:${input.lessonId}`
            : `a:${input.activityId}`;
        set((state) => {
          const existing = state.tabs.find((t) => t.id === id);
          if (existing) {
            // Actualizar título/icono/lessonId si cambiaron, y activar
            const updatedTabs = state.tabs.map((t) =>
              t.id === id
                ? {
                    ...t,
                    title: input.title !== t.title && input.title ? input.title : t.title,
                    lessonId: input.lessonId ?? t.lessonId,
                    unitId: input.unitId ?? t.unitId,
                  }
                : t
            );
            return {
              tabs: updatedTabs,
              activeTabId: id,
              ...syncDerived({ ...existing, lessonId: input.lessonId ?? existing.lessonId, unitId: input.unitId ?? existing.unitId }),
            };
          }
          const newTab: Tab = {
            id,
            kind: input.kind,
            view: input.view,
            title: input.title,
            icon: input.icon,
            unitId: input.unitId,
            lessonId: input.lessonId,
            activityId: input.activityId,
            closable: input.closable ?? true,
            createdAt: Date.now(),
          };
          return {
            tabs: [...state.tabs, newTab],
            activeTabId: id,
            ...syncDerived(newTab),
          };
        });
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },

      closeTab: (tabId) => {
        set((state) => {
          const idx = state.tabs.findIndex((t) => t.id === tabId);
          if (idx === -1) return state;
          const tab = state.tabs[idx];
          if (!tab.closable) return state;
          const newTabs = state.tabs.filter((t) => t.id !== tabId);
          if (newTabs.length === 0) {
            const home = makeHomeTab();
            return { tabs: [home], activeTabId: home.id, ...syncDerived(home) };
          }
          let newActive = state.activeTabId;
          if (state.activeTabId === tabId) {
            const next = newTabs[Math.min(idx, newTabs.length - 1)];
            newActive = next.id;
            const activeTab = next;
            return { tabs: newTabs, activeTabId: newActive, ...syncDerived(activeTab) };
          }
          return { tabs: newTabs };
        });
      },

      closeOtherTabs: (tabId) => {
        set((state) => {
          const keep = state.tabs.filter((t) => t.id === tabId || !t.closable);
          const active = keep.find((t) => t.id === tabId) ?? keep[0];
          return { tabs: keep, activeTabId: active.id, ...syncDerived(active) };
        });
      },

      closeAllClosable: () => {
        set((state) => {
          const keep = state.tabs.filter((t) => !t.closable);
          if (keep.length === 0) {
            const home = makeHomeTab();
            return { tabs: [home], activeTabId: home.id, ...syncDerived(home) };
          }
          const active = keep[0];
          return { tabs: keep, activeTabId: active.id, ...syncDerived(active) };
        });
      },

      setActiveTab: (tabId) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === tabId);
          if (!tab) return state;
          return { activeTabId: tabId, ...syncDerived(tab) };
        });
      },

      updateTab: (tabId, patch) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)),
        }));
      },

      setTutorContext: (unitTitle) => set({ tutorContextUnit: unitTitle }),

      navigate: (view) => {
        const meta = singletonTabMeta[view] ?? singletonTabMeta.dashboard;
        get().openTab({
          kind: "singleton",
          view,
          title: meta.title,
          icon: meta.icon,
          closable: meta.closable,
        });
      },
      openUnit: (unitId) => {
        get().openTab({
          kind: "unit",
          view: "unit-detail",
          title: "Unidad",
          icon: "BookOpen",
          unitId,
        });
      },
      openLesson: (lessonId) => {
        get().openTab({
          kind: "lesson",
          view: "lesson",
          title: "Lección",
          icon: "BookOpen",
          lessonId,
        });
      },
      openActivity: (activityId) => {
        // Conservar el lessonId del tab activo actual para poder cargar la actividad
        const currentLessonId = get().currentLessonId;
        get().openTab({
          kind: "activity",
          view: "activity",
          title: "Actividad",
          icon: "ListChecks",
          activityId,
          lessonId: currentLessonId ?? undefined,
        });
      },

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      resetNav: () => {
        const home = makeHomeTab();
        set({ tabs: [home], activeTabId: home.id, ...syncDerived(home) });
      },
    }),
    {
      name: "electromed-store",
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);
