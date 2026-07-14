"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { cn } from "@/lib/utils";
import type { Role, ViewKey } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: string;
  roles: Role[];
  description: string;
}

const navItems: NavItem[] = [
  { key: "dashboard", label: "Inicio", icon: "LayoutDashboard", roles: ["student", "teacher"], description: "Resumen general" },
  { key: "units", label: "Unidades", icon: "BookOpen", roles: ["student", "teacher"], description: "Contenido del curso" },
  { key: "tutor", label: "Tutor IA", icon: "MessageSquare", roles: ["student"], description: "Asistente conversacional" },
  { key: "progress", label: "Mi progreso", icon: "BarChart3", roles: ["student"], description: "Analítica de aprendizaje" },
  { key: "achievements", label: "Logros", icon: "Trophy", roles: ["student"], description: "Insignias y ranking" },
  { key: "teacher", label: "Panel docente", icon: "Users", roles: ["teacher"], description: "Seguimiento de estudiantes" },
  { key: "about", label: "Acerca del piloto", icon: "Info", roles: ["student", "teacher"], description: "Sobre el proyecto" },
];

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const role = useAppStore((s) => s.role);
  const navigate = useAppStore((s) => s.navigate);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  const items = navItems.filter((i) => i.roles.includes(role));

  return (
    <>
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / cabecera */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <button
            onClick={() => {
              navigate("dashboard");
              setSidebarOpen(false);
            }}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/20">
              <DynamicIcon name="HeartPulse" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">ElectroMed IA</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Aprendizaje adaptativo
              </div>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Navegación
          </div>
          {items.map((item) => {
            const active = view === item.key || (item.key === "units" && (view === "unit-detail" || view === "lesson" || view === "activity"));
            return (
              <button
                key={item.key}
                onClick={() => {
                  navigate(item.key);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    active
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow"
                      : "bg-sidebar-accent/40 text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <DynamicIcon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block">{item.label}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                {active && <DynamicIcon name="ChevronRight" className="h-4 w-4 text-emerald-600" />}
              </button>
            );
          })}
        </nav>

        {/* Footer del sidebar: info del piloto */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-3 dark:from-emerald-950/40 dark:to-teal-950/40">
            <div className="mb-1.5 flex items-center gap-2">
              <DynamicIcon name="GraduationCap" className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Piloto UVA24991
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Innovación docente · Facultad de Ingeniería, Universidad de Valparaíso
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
