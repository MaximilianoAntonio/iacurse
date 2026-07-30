"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/course-utils";
import type { ViewKey } from "@/lib/types";

interface AppNotification {
  id: string;
  type: "badge" | "report" | "info";
  title: string;
  description: string;
  icon: string;
  createdAt: string;
  actionView?: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export function NotificationBell() {
  const navigate = useAppStore((s) => s.navigate);

  const { data } = useFetch<NotificationsResponse>(
    `/api/notifications`,
    []
  );

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  const handleClick = (n: AppNotification) => {
    if (n.actionView) {
      navigate(n.actionView as ViewKey);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notificaciones"
        >
          {hasUnread ? (
            <BellRing className="h-4 w-4 text-brand-gold" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {hasUnread && (
            <Badge className="bg-destructive/10 text-destructive">
              {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium">Sin notificaciones</p>
            <p className="text-xs text-muted-foreground">Estás al día</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => {
              const isRecent = new Date(n.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000);
              const typeColor = {
                badge: "bg-accent text-accent-foreground",
                report: "bg-destructive/10 text-destructive",
                info: "bg-primary/10 text-primary",
              }[n.type];
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="flex items-start gap-2.5 py-2.5"
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeColor)}>
                    <DynamicIcon name={n.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{n.title}</p>
                      {isRecent && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
