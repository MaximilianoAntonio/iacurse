"use client";

import { useAppStore } from "@/store/app-store";
import { DashboardView } from "@/components/views/dashboard-view";
import { UnitsView } from "@/components/views/units-view";
import { UnitDetailView } from "@/components/views/unit-detail-view";
import { LessonView } from "@/components/views/lesson-view";
import { ActivityView } from "@/components/views/activity-view";
import { ProgressView } from "@/components/views/progress-view";
import { AchievementsView } from "@/components/views/achievements-view";
import { BookmarksView } from "@/components/views/bookmarks-view";
import { TeacherView } from "@/components/views/teacher-view";
import { AboutView } from "@/components/views/about-view";
import { CourseBuilderView } from "@/components/views/course-builder-view";
import { CourseDiagnosticView } from "@/components/views/course-diagnostic-view";
import { FinalExamView } from "@/components/views/final-exam-view";
import type { ViewKey } from "@/lib/types";

interface ViewRouterProps {
  /** Vista forzada (p. ej. diagnóstico obligatorio pendiente): tiene
   * precedencia sobre la vista del store. */
  forceView?: ViewKey;
  /** Callback para que la vista de diagnóstico avise un envío exitoso. */
  onDiagnosticSubmitted?: () => void;
}

export function ViewRouter({ forceView, onDiagnosticSubmitted }: ViewRouterProps) {
  const storeView = useAppStore((s) => s.view);
  const view = forceView ?? storeView;

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
    case "bookmarks":
      return <BookmarksView />;
    case "teacher":
      return <TeacherView />;
    case "course-builder":
      return <CourseBuilderView />;
    case "course-diagnostic":
      return <CourseDiagnosticView onSubmitted={onDiagnosticSubmitted} />;
    case "final-exam":
      return <FinalExamView />;
    case "about":
      return <AboutView />;
    default:
      return <DashboardView />;
  }
}
