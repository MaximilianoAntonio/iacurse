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
import { Menu, Flame, Sparkles, Sun, Moon, Users, UserCog, MessageSquare, X, Search, PanelLeftOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { initials } from "@/lib/course-utils";
import type { User } from "@/lib/types";

interface HeaderProps {
  users: User[];
  onSwitchUser: (userId: string) => void;
}

export function Header({ users, onSwitchUser }: HeaderProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const role = useAppStore((s) => s.role);
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Keyboard shortcut: Ctrl/Cmd + K to open search
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
  const chatOpen = useAppStore((s) => s.chatOpen);
  const toggleChat = useAppStore((s) => s.toggleChat);
  const navCollapsed = useAppStore((s) => s.navCollapsed);
  const toggleNav = useAppStore((s) => s.toggleNav);
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Botón menú móvil */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {/* Botón mostrar panel (desktop, cuando está colapsado) */}
      {navCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 lg:flex"
          onClick={toggleNav}
          title="Mostrar panel de navegación"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      )}

      <div className="hidden items-center gap-2 md:flex">
        <Badge variant="secondary" className="gap-1.5 bg-[#003366]/10 text-[#003366] dark:bg-[#0066AA]/20 dark:text-amber-400">
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
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Buscar (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Buscar...</span>
          <kbd className="hidden rounded bg-muted px-1 py-0.5 text-xs font-medium md:inline">⌘K</kbd>
        </button>

        {/* Racha */}
        {role === "student" && currentUser && (
          <div className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 sm:flex">
            <Flame className="h-3.5 w-3.5" />
            {currentUser.streak} días
          </div>
        )}
        {/* Puntos */}
        {role === "student" && currentUser && (
          <div className="hidden items-center gap-1.5 rounded-full bg-[#003366]/10 px-3 py-1.5 text-xs font-semibold text-[#003366] dark:bg-[#0066AA]/20 dark:text-amber-400 sm:flex">
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

        {/* Toggle chat del tutor (barra lateral derecha) */}
        {role === "student" && (
          <Button
            variant={chatOpen ? "default" : "ghost"}
            size="sm"
            className={`gap-1.5 ${chatOpen ? "bg-[#003366] text-amber-400 hover:bg-[#004488]" : "text-[#003366] hover:bg-[#003366]/10 dark:text-amber-400 dark:hover:bg-amber-400/10"}`}
            onClick={toggleChat}
            aria-label="Abrir tutor IA"
          >
            {chatOpen ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            <span className="hidden sm:inline">Tutor IA</span>
          </Button>
        )}

        {/* Selector de usuario (piloto) */}
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-left transition hover:bg-accent">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-gradient-to-br from-[#003366] to-[#0066AA] text-xs font-bold text-white">
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
              <DropdownMenuLabel className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Cambiar de cuenta (piloto)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {users.map((u) => (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => onSwitchUser(u.id)}
                  className="flex items-center gap-2 py-2"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-gradient-to-br from-[#003366] to-[#0066AA] text-xs font-bold text-white">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 leading-tight">
                    <div className="text-xs font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.role === "teacher" ? "Docente" : `${u.points} pts · ${u.streak}d racha`}
                    </div>
                  </div>
                  {u.id === currentUser.id && (
                    <span className="h-2 w-2 rounded-full bg-[#003366]" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("about")} className="gap-2 text-xs">
                <UserCog className="h-3.5 w-3.5" />
                Acerca del piloto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
