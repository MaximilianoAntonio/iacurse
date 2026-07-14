"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { DashboardView } from "@/components/views/dashboard-view";
import { UnitsView } from "@/components/views/units-view";
import { UnitDetailView } from "@/components/views/unit-detail-view";
import { LessonView } from "@/components/views/lesson-view";
import { ActivityView } from "@/components/views/activity-view";
import { ProgressView } from "@/components/views/progress-view";
import { AchievementsView } from "@/components/views/achievements-view";
import { TeacherView } from "@/components/views/teacher-view";
import { AboutView } from "@/components/views/about-view";

export function ViewRouter() {
  const view = useAppStore((s) => s.view);
  const navigate = useAppStore((s) => s.navigate);
  const toggleChat = useAppStore((s) => s.toggleChat);

  // "tutor" ya no es una vista (es un panel lateral). Si llega, abrir el chat e ir al dashboard.
  useEffect(() => {
    if (view === "tutor") {
      toggleChat();
      navigate("dashboard");
    }
  }, [view, toggleChat, navigate]);

  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "units":
      return <UnitsView />;
    case "unit-detail":
      return <UnitDetailView />;
    case "lesson":
      return <LessonView />;
    case "activity":
      return <ActivityView />;
    case "progress":
      return <ProgressView />;
    case "achievements":
      return <AchievementsView />;
    case "teacher":
      return <TeacherView />;
    case "about":
      return <AboutView />;
    default:
      return <DashboardView />;
  }
}
