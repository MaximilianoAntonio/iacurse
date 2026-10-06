"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { GlobalSearch } from "@/components/app/global-search";
import { NotificationBell } from "@/components/app/notification-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Flame, Sparkles, Sun, Moon, LogOut, UserCog, Search, ShieldOff } from "lucide-react";
import { useTheme } from "next-themes";
import { initials } from "@/lib/course-utils";
import { postJSON, useFetch } from "@/hooks/use-fetch";
import { RevokeConsentDialog } from "@/components/app/revoke-consent-dialog";
import type { CourseStatus } from "@/lib/types";

interface HeaderProps {
  onLogout: () => void;
}

export function Header({ onLogout }: HeaderProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const role = useAppStore((s) => s.role);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [revokeOpen, setRevokeOpen] = React.useState(false);

  // Estado del consentimiento informado (solo estudiantes): alimenta la opción
  // "Revocar mi autorización" del menú de usuario, visible mientras la
  // autorización esté vigente y dentro del plazo de retiro.
  const { data: courseStatus, refetch: refetchStatus } = useFetch<CourseStatus>(
    role === "student" ? "/api/course/status" : null,
    [role]
  );
  const consent = courseStatus?.consent;
  const today = new Date().toISOString().slice(0, 10);
  const showRevoke =
    role === "student" &&
    !!consent?.completed &&
    consent.authorized &&
    (!consent.revokeDeadline || today <= consent.revokeDeadline);

  // Atajo de teclado: Ctrl/Cmd + K abre la búsqueda global
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const navigate = useAppStore((s) => s.navigate);
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Botón menú móvil: abre el drawer con overlay */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebarOpen(true)}
        title="Abrir menú de navegación"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden items-center gap-2 md:flex">
        <Badge variant="secondary" className="gap-1.5 bg-brand/10 text-brand dark:bg-brand/30 dark:text-brand-gold">
          <DynamicIcon name="BookOpen" className="h-3 w-3" />
          Electromedicina II
        </Badge>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">Ingeniería Civil Biomédica · Universidad de Valparaíso</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Búsqueda global */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground"
          title="Buscar (Ctrl+K)"
          aria-label="Abrir búsqueda global"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Buscar...</span>
          <kbd className="hidden rounded bg-muted px-1 py-0.5 font-mono text-xs md:inline">⌘K</kbd>
        </button>

        {/* Racha */}
        {role === "student" && currentUser && (
          <div className="hidden items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground sm:flex">
            <Flame className="h-3.5 w-3.5" />
            {currentUser.streak} días
          </div>
        )}
        {/* Puntos */}
        {role === "student" && currentUser && (
          <div className="hidden items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand dark:bg-primary/15 dark:text-primary sm:flex">
            <Sparkles className="h-3.5 w-3.5" />
            {currentUser.points} pts
          </div>
        )}

        {/* Toggle tema */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Cambiar tema"
          suppressHydrationWarning
        >
          <Sun className="hidden h-4 w-4 dark:block" suppressHydrationWarning />
          <Moon className="block h-4 w-4 dark:hidden" suppressHydrationWarning />
        </Button>

        {/* Notificaciones */}
        <NotificationBell />

        {/* Menú de usuario */}
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-left shadow-xs transition hover:bg-accent" aria-label="Menú de usuario">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-brand text-xs font-bold text-primary-foreground dark:bg-primary dark:text-primary-foreground">
                    {initials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden leading-tight sm:block">
                  <div className="text-xs font-semibold">{currentUser.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {role === "teacher" ? "Docente" : "Estudiante"}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{currentUser.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{currentUser.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("about")} className="gap-2 text-xs">
                <UserCog className="h-3.5 w-3.5" />
                Acerca del piloto
              </DropdownMenuItem>
              {showRevoke && (
                <DropdownMenuItem
                  onClick={() => setRevokeOpen(true)}
                  className="gap-2 text-xs"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Revocar mi autorización para el uso científico de datos
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await postJSON("/api/auth/logout", {});
                  } catch {
                    // silencioso: cerramos sesión en el cliente igual
                  }
                  onLogout();
                }}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      {showRevoke && (
        <RevokeConsentDialog
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
          onRevoked={() => refetchStatus()}
        />
      )}
    </header>
  );
}
