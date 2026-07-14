"use client";

import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { Footer } from "@/components/app/footer";
import { TabBar } from "@/components/app/tab-bar";
import { ViewRouter } from "@/components/app/view-router";
import { useAppStore } from "@/store/app-store";
import type { User } from "@/lib/types";

interface AppShellProps {
  users: User[];
  onSwitchUser: (userId: string) => void;
}

export function AppShell({ users, onSwitchUser }: AppShellProps) {
  const tabsCount = useAppStore((s) => s.tabs.length);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <Header users={users} onSwitchUser={onSwitchUser} />
        {tabsCount > 0 && <TabBar />}
        <main className="flex-1">
          <ViewRouter />
        </main>
        <Footer />
      </div>
    </div>
  );
}
