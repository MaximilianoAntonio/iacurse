"use client";

import * as React from "react";
import { useAppStore, type Tab } from "@/store/app-store";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { X, Trash2, Plus } from "lucide-react";

const quickNavItems: { view: import("@/lib/types").ViewKey; label: string; icon: string }[] = [
  { view: "units", label: "Unidades", icon: "BookOpen" },
  { view: "tutor", label: "Tutor IA", icon: "MessageSquare" },
  { view: "progress", label: "Progreso", icon: "BarChart3" },
  { view: "achievements", label: "Logros", icon: "Trophy" },
];

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const closeOtherTabs = useAppStore((s) => s.closeOtherTabs);
  const closeAllClosable = useAppStore((s) => s.closeAllClosable);
  const navigate = useAppStore((s) => s.navigate);
  const role = useAppStore((s) => s.role);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [menuTabId, setMenuTabId] = React.useState<string | null>(null);

  // Auto-scroll al tab activo cuando cambia
  React.useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeTabId, tabs.length]);

  const quickItems = quickNavItems.filter((i) => {
    if (i.view === "teacher") return role === "teacher";
    if (i.view === "tutor" || i.view === "progress" || i.view === "achievements") return role === "student";
    return true;
  });
  if (role === "teacher") {
    quickItems.push({ view: "teacher", label: "Panel docente", icon: "Users" });
  }

  const handleContextMenu = (tabId: string) => {
    setMenuTabId(tabId);
  };

  return (
    <div className="sticky top-16 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex items-center gap-1 px-2 lg:px-4">
        {/* Barra de pestañas scrollable */}
        <div
          ref={scrollRef}
          className="flex flex-1 items-end gap-0.5 overflow-x-auto py-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        >
          {tabs.map((tab) => (
            <TabChip
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              onClick={() => setActiveTab(tab.id)}
              onClose={() => closeTab(tab.id)}
              onContextMenu={() => handleContextMenu(tab.id)}
            />
          ))}
        </div>

        {/* Acciones rápidas: abrir nuevas pestañas */}
        <div className="flex shrink-0 items-center gap-0.5 border-l border-border pl-1.5">
          {quickItems.map((item) => (
            <Button
              key={item.view}
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate(item.view)}
              title={`Abrir ${item.label}`}
            >
              <Plus className="h-3 w-3" />
              <DynamicIcon name={item.icon} className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{item.label}</span>
            </Button>
          ))}
          {tabs.some((t) => t.closable) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={closeAllClosable}
              title="Cerrar todas las pestañas"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Menú contextual (cerrar otras) — se invoca vía clic derecho usando ContextMenu por tab */}
      {menuTabId && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <span className="sr-only" />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => closeTab(menuTabId)}>Cerrar pestaña</ContextMenuItem>
            <ContextMenuItem onClick={() => closeOtherTabs(menuTabId)}>
              Cerrar las demás
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={closeAllClosable}>Cerrar todas</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}

interface TabChipProps {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  onClose: () => void;
  onContextMenu: () => void;
}

function TabChip({ tab, active, onClick, onClose, onContextMenu }: TabChipProps) {
  const closeOtherTabs = useAppStore((s) => s.closeOtherTabs);
  const closeAllClosable = useAppStore((s) => s.closeAllClosable);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-tab-id={tab.id}
          onClick={onClick}
          onContextMenu={onContextMenu}
          className={cn(
            "group relative flex h-9 min-w-[120px] max-w-[200px] shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border-x border-t px-3 text-xs transition-all",
            active
              ? "border-border bg-background text-foreground shadow-[0_-1px_0_0_var(--background)]"
              : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
          )}
        >
          {/* Acento superior de color según estado */}
          <span
            className={cn(
              "absolute inset-x-0 top-0 h-0.5 rounded-t-full transition-colors",
              active ? "bg-gradient-to-r from-[#003366] to-[#0066AA]" : "bg-transparent group-hover:bg-border"
            )}
          />
          <DynamicIcon
            name={tab.icon}
            className={cn("h-3.5 w-3.5 shrink-0", active ? "text-[#003366]" : "text-muted-foreground")}
          />
          <span className="flex-1 truncate font-medium">{tab.title}</span>
          {tab.closable ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
                active
                  ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  : "text-transparent group-hover:text-muted-foreground group-hover:hover:bg-destructive/10 group-hover:hover:text-destructive"
              )}
              title="Cerrar pestaña"
              aria-label={`Cerrar ${tab.title}`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClose} disabled={!tab.closable}>
          Cerrar pestaña
        </ContextMenuItem>
        <ContextMenuItem onClick={() => closeOtherTabs(tab.id)}>Cerrar las demás</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={closeAllClosable}>Cerrar todas las pestañas</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
