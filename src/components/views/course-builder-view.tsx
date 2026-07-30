"use client";

import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { CurriculumTab } from "@/components/course-builder/curriculum-tab";

export function CourseBuilderView() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Currículo Educativo"
        description="Administra las unidades, lecciones y actividades de la plataforma."
        icon="BookOpen"
        iconGradient="from-primary to-primary/70"
      />

      <CurriculumTab />
    </div>
  );
}
