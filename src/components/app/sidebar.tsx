"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { cn } from "@/lib/utils";
import type { Role, ViewKey } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, PanelLeftClose, PanelLeftOpen } from "lucide-react";

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
  const chatOpen = useAppStore((s) => s.chatOpen);
  const toggleChat = useAppStore((s) => s.toggleChat);
  const navCollapsed = useAppStore((s) => s.navCollapsed);
  const toggleNav = useAppStore((s) => s.toggleNav);

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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          !navCollapsed && "lg:translate-x-0"
        )}
      >
        {/* Logo / cabecera — Identidad UV */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
          <button
            onClick={() => {
              navigate("dashboard");
              setSidebarOpen(false);
            }}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-sidebar shadow-lg shadow-amber-500/20">
              <DynamicIcon name="HeartPulse" className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-sidebar-primary">ElectroMed IA</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                Universidad de Valparaíso
              </div>
            </div>
          </button>
          <div className="flex items-center gap-1">
            {/* Botón colapsar (desktop) */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 lg:flex"
              onClick={toggleNav}
              title="Contraer panel"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            {/* Botón cerrar (móvil) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-sidebar shadow"
                      : "bg-sidebar-accent/40 text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                  )}
                >
                  <DynamicIcon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block">{item.label}</span>
                  <span className="block text-[11px] font-normal text-sidebar-foreground/50">
                    {item.description}
                  </span>
                </span>
                {active && <DynamicIcon name="ChevronRight" className="h-4 w-4 text-amber-400" />}
              </button>
            );
          })}
        </nav>

        {/* Footer del sidebar: acceso al chat + info del piloto */}
        <div className="border-t border-sidebar-border space-y-3 p-4">
          {role === "student" && (
            <button
              onClick={() => {
                toggleChat();
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                chatOpen
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-sidebar-border bg-sidebar-accent/30 hover:border-amber-400/50 hover:bg-amber-400/5"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${chatOpen ? "bg-amber-500 text-sidebar" : "bg-amber-400/20 text-amber-400"}`}>
                <DynamicIcon name="MessageSquare" className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-sidebar-foreground">Tutor IA</span>
                <span className="block text-[11px] text-sidebar-foreground/50">
                  {chatOpen ? "Cerrar panel" : "Abrir asistente"}
                </span>
              </span>
              <DynamicIcon name={chatOpen ? "X" : "ChevronRight"} className="h-4 w-4 text-sidebar-foreground/50" />
            </button>
          )}
          <div className="rounded-xl bg-sidebar-accent/40 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <DynamicIcon name="GraduationCap" className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">
                Piloto UVA24991
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-sidebar-foreground/60">
              Facultad de Ingeniería · Universidad de Valparaíso
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
