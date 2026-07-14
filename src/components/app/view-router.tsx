"use client";

import { useAppStore } from "@/store/app-store";
import { DashboardView } from "@/components/views/dashboard-view";
import { UnitsView } from "@/components/views/units-view";
import { UnitDetailView } from "@/components/views/unit-detail-view";
import { LessonView } from "@/components/views/lesson-view";
import { ActivityView } from "@/components/views/activity-view";
import { TutorView } from "@/components/views/tutor-view";
import { ProgressView } from "@/components/views/progress-view";
import { AchievementsView } from "@/components/views/achievements-view";
import { TeacherView } from "@/components/views/teacher-view";
import { AboutView } from "@/components/views/about-view";

export function ViewRouter() {
  const view = useAppStore((s) => s.view);

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
    case "tutor":
      return <TutorView />;
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
