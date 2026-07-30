"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { ViewRouter } from "@/components/app/view-router";

interface AppShellProps {
  onLogout: () => void;
}

export function AppShell({ onLogout }: AppShellProps) {
  const view = useAppStore((s) => s.view);
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
      {/* El main se empuja según el sidebar: panel completo (w-72) o mini-rail (w-16) en desktop */}
      <div
        className={`flex min-h-screen flex-1 flex-col transition-[padding] duration-300 ease-out-expo ${
          navCollapsed ? "lg:pl-16" : "lg:pl-72"
        }`}
      >
        <Header onLogout={onLogout} />
        <main className="flex-1" key={view}>
          <div className="animate-fade-in-up">
            <ViewRouter />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
