"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { ChatSidebar } from "@/components/app/chat-sidebar";
import { ViewRouter } from "@/components/app/view-router";
import type { User } from "@/lib/types";

interface AppShellProps {
  users: User[];
  onSwitchUser: (userId: string) => void;
}

export function AppShell({ users, onSwitchUser }: AppShellProps) {
  const chatOpen = useAppStore((s) => s.chatOpen);
  const navCollapsed = useAppStore((s) => s.navCollapsed);
  const hydrateFromUrl = useAppStore((s) => s.hydrateFromUrl);
  const setNavFromUrl = useAppStore((s) => s.setNavFromUrl);

  // Al montar: hidratar el estado de navegación desde la URL
  useEffect(() => {
    hydrateFromUrl();
    // Escuchar popstate (back/forward del navegador)
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const view = (params.get("view") as import("@/lib/types").ViewKey) || "dashboard";
      setNavFromUrl({
        view,
        currentUnitId: params.get("u"),
        currentLessonId: params.get("l"),
        currentActivityId: params.get("a"),
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hydrateFromUrl, setNavFromUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Sidebar />
      {/* El main se empuja a la izquierda por el sidebar (solo en desktop si no está colapsado)
          y a la derecha cuando el chat está abierto en desktop */}
      <div
        className={`flex min-h-screen flex-1 flex-col transition-[padding] duration-300 ${
          navCollapsed ? "lg:pl-0" : "lg:pl-72"
        } ${chatOpen ? "lg:pr-[380px]" : ""}`}
      >
        <Header users={users} onSwitchUser={onSwitchUser} />
        <main className="flex-1">
          <ViewRouter />
        </main>
        <Footer />
      </div>
      <ChatSidebar />
    </div>
  );
}
