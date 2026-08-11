"use client";

import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { CurriculumTab } from "@/components/course-builder/curriculum-tab";
import { EvaluationsTab } from "@/components/course-builder/evaluations-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CourseBuilderView() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Currículo Educativo"
        description="Administra las unidades, lecciones, actividades y evaluaciones de la plataforma."
        icon="BookOpen"
        iconGradient="from-primary to-primary/70"
      />

      <Tabs defaultValue="curriculum">
        <TabsList>
          <TabsTrigger value="curriculum">Currículo</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum" className="mt-4">
          <CurriculumTab />
        </TabsContent>
        <TabsContent value="evaluations" className="mt-4">
          <EvaluationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
