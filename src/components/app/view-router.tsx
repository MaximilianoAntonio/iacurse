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
import { CourseBuilderView } from "@/components/views/course-builder-view";
import { FinalExamView } from "@/components/views/final-exam-view";

export function ViewRouter() {
  const view = useAppStore((s) => s.view);
  const navigate = useAppStore((s) => s.navigate);

  // Redirigir "tutor" al dashboard ya que el tutor ha sido removido
  useEffect(() => {
    if (view === "tutor") {
      navigate("dashboard");
    }
  }, [view, navigate]);

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
    case "course-builder":
      return <CourseBuilderView />;
    case "final-exam":
      return <FinalExamView />;
    case "about":
      return <AboutView />;
    default:
      return <DashboardView />;
  }
}
