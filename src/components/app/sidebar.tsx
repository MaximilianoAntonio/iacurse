"use client";

import { useAppStore } from "@/store/app-store";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { cn } from "@/lib/utils";
import type { Role, ViewKey } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X, PanelLeftClose, PanelLeftOpen, GraduationCap, HeartPulse } from "lucide-react";

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
  { key: "final-exam", label: "Prueba de cierre", icon: "GraduationCap", roles: ["student"], description: "Examen final del curso" },
  { key: "teacher", label: "Panel docente", icon: "Users", roles: ["teacher"], description: "Seguimiento de estudiantes" },
  { key: "course-builder", label: "Currículo Educativo", icon: "BookOpen", roles: ["teacher"], description: "Unidades, lecciones y actividades" },
  { key: "about", label: "Acerca del piloto", icon: "Info", roles: ["student", "teacher"], description: "Sobre el proyecto" },
];

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const role = useAppStore((s) => s.role);
  const navigate = useAppStore((s) => s.navigate);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const navCollapsed = useAppStore((s) => s.navCollapsed);
  const toggleNav = useAppStore((s) => s.toggleNav);

  const items = navItems.filter((i) => i.roles.includes(role));

  // `navCollapsed` solo aplica en desktop (lg+): en móvil el drawer siempre
  // muestra el panel completo (las clases de colapso llevan prefijo lg:).
  return (
    <>
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-brand-ink/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-[transform,width] duration-300 ease-out-expo",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          // En desktop el panel nunca desaparece: colapsa a un mini-rail de iconos
          "lg:translate-x-0",
          navCollapsed && "lg:w-16"
        )}
      >
        {/* Logo / cabecera — pieza de marca: tinta azul + señal dorada */}
        <div
          className={cn(
            "flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4",
            navCollapsed && "lg:justify-center lg:px-0"
          )}
        >
          <button
            onClick={() => {
              navigate("dashboard");
              setSidebarOpen(false);
            }}
            className="flex min-w-0 items-center gap-3 text-left"
            title="Ir al inicio"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-brand-ink shadow-sm">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className={cn("min-w-0 leading-tight", navCollapsed && "lg:hidden")}>
              <span className="block truncate font-display text-base font-bold tracking-tight text-sidebar-foreground">
                ElectroMed IA
              </span>
              <span className="block truncate text-xs text-sidebar-foreground/55">
                Universidad de Valparaíso
              </span>
            </span>
          </button>
          {/* Botón cerrar (móvil) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú de navegación"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto p-3">
          <div
            className={cn(
              "px-3 pb-2 pt-1 text-xs font-medium text-sidebar-foreground/45",
              navCollapsed && "lg:hidden"
            )}
          >
            Navegación
          </div>
          <div className="stagger-children space-y-1">
            {items.map((item) => {
              const active =
                view === item.key ||
                (item.key === "units" &&
                  (view === "unit-detail" || view === "lesson" || view === "activity"));
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    navigate(item.key);
                    setSidebarOpen(false);
                  }}
                  title={navCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200",
                    navCollapsed && "lg:justify-center lg:px-0",
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-xs"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
                      active
                        ? "bg-brand-gold text-brand-ink"
                        : "bg-sidebar-accent/50 text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                    )}
                  >
                    <DynamicIcon name={item.icon} className="h-4 w-4" />
                  </span>
                  <span className={cn("min-w-0 flex-1", navCollapsed && "lg:hidden")}>
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs font-normal text-sidebar-foreground/50">
                      {item.description}
                    </span>
                  </span>
                  {active && (
                    <DynamicIcon
                      name="ChevronRight"
                      className={cn("h-4 w-4 shrink-0 text-brand-gold", navCollapsed && "lg:hidden")}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer del sidebar: info del piloto + toggle de colapso (desktop) */}
        <div className="space-y-2 border-t border-sidebar-border p-3">
          {/* Tarjeta del piloto (panel expandido) */}
          <div
            className={cn(
              "rounded-lg bg-sidebar-accent/40 p-3",
              navCollapsed && "lg:hidden"
            )}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-brand-gold" />
              <span className="text-xs font-semibold text-brand-gold">
                Piloto UVA24991
              </span>
            </div>
            <p className="text-xs leading-relaxed text-sidebar-foreground/60">
              Facultad de Ingeniería · Universidad de Valparaíso
            </p>
          </div>
          {/* Ícono del piloto (mini-rail colapsado, solo desktop) */}
          {navCollapsed && (
            <div className="hidden justify-center lg:flex">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent/40 text-brand-gold"
                title="Piloto UVA24991 · Facultad de Ingeniería, Universidad de Valparaíso"
              >
                <GraduationCap className="h-4 w-4" />
              </span>
            </div>
          )}
          {/* Toggle de colapso: camino siempre visible para expandir/contraer en desktop */}
          <button
            onClick={toggleNav}
            title={navCollapsed ? "Expandir panel de navegación" : "Contraer panel"}
            aria-label={navCollapsed ? "Expandir panel de navegación" : "Contraer panel"}
            className={cn(
              "hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/60 transition-colors duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground lg:flex",
              navCollapsed && "lg:justify-center lg:px-0"
            )}
          >
            {navCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>Contraer panel</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
