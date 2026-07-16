"use client";

import * as React from "react";
import { useFetch, postJSON, patchJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Clock,
  Upload,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonEditorDialog, type LessonFormData } from "./lesson-editor-dialog";
import { ActivityEditorDialog, type ActivityFormData } from "./activity-editor-dialog";
import { QuestionBankImportDialog } from "./question-bank-import-dialog";
import { activityTypeMeta, difficultyMeta } from "@/lib/course-utils";

interface SandboxQuestion {
  id: string;
  type: string;
  title: string;
  prompt: string;
  data: string;
  points: number;
  difficulty: string;
  tags: string | null;
}

interface CourseUnitDetail {
  id: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  lessons: {
    id: string;
    title: string;
    description: string;
    content: string;
    durationMin: number;
    order: number;
    questionCount: number;
    questions: SandboxQuestion[];
  }[];
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  status: string;
  authorId: string;
  units: CourseUnitDetail[];
}

export function CourseEditor({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const { data, loading, refetch } = useFetch<{ course: CourseDetail }>(
    `/api/courses/${courseId}`,
    [courseId]
  );
  const { toast } = useToast();
  const [newUnitOpen, setNewUnitOpen] = React.useState(false);
  const [editUnitFor, setEditUnitFor] = React.useState<string | null>(null);
  const [lessonDialog, setLessonDialog] = React.useState<{ open: boolean; unitId: string | null; initial: LessonFormData | null }>({ open: false, unitId: null, initial: null });
  const [activityDialog, setActivityDialog] = React.useState<{ open: boolean; lessonId: string | null; initial: ActivityFormData | null }>({ open: false, lessonId: null, initial: null });
  const [importDialog, setImportDialog] = React.useState<{ open: boolean; lessonId: string | null }>({ open: false, lessonId: null });
  const [expandedLessons, setExpandedLessons] = React.useState<Set<string>>(new Set());
  const [unitForm, setUnitForm] = React.useState({ title: "", summary: "", description: "", icon: "BookOpen", color: "sky" });
  const [publishing, setPublishing] = React.useState(false);

  const course = data?.course;

  const toggleLesson = (id: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateUnit = async () => {
    if (!unitForm.title.trim()) return;
    try {
      await postJSON(`/api/courses/${courseId}`, unitForm);
      setUnitForm({ title: "", summary: "", description: "", icon: "BookOpen", color: "sky" });
      setNewUnitOpen(false);
      refetch();
      toast({ title: "Unidad creada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleUpdateUnit = async () => {
    if (!editUnitFor) return;
    try {
      await patchJSON(`/api/courses/${courseId}`, {
        action: "updateUnit",
        unitId: editUnitFor,
        title: unitForm.title,
        summary: unitForm.summary,
        description: unitForm.description,
        icon: unitForm.icon,
        color: unitForm.color,
      });
      setEditUnitFor(null);
      refetch();
      toast({ title: "Unidad actualizada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleCreateLesson = async (formData: LessonFormData) => {
    if (!lessonDialog.unitId) return;
    try {
      await patchJSON(`/api/courses/${courseId}`, {
        action: "createLesson",
        unitId: lessonDialog.unitId,
        title: formData.title,
        description: formData.description,
        content: formData.content,
        durationMin: formData.durationMin,
      });
      refetch();
      toast({ title: "Lección creada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleUpdateLesson = async (formData: LessonFormData) => {
    if (!formData.id) return;
    try {
      await patchJSON(`/api/courses/${courseId}`, {
        action: "updateLesson",
        lessonId: formData.id,
        title: formData.title,
        description: formData.description,
        content: formData.content,
        durationMin: formData.durationMin,
      });
      refetch();
      toast({ title: "Lección actualizada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!confirm(`¿Eliminar la lección "${title}" y todas sus preguntas?`)) return;
    try {
      await patchJSON(`/api/courses/${courseId}`, { action: "deleteLesson", lessonId });
      refetch();
      toast({ title: "Lección eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSaveActivity = async (formData: ActivityFormData) => {
    if (!activityDialog.lessonId) return;
    try {
      if (formData.id) {
        await patchJSON(`/api/courses/${courseId}`, {
          action: "updateQuestion",
          questionId: formData.id,
          type: formData.type,
          title: formData.title,
          prompt: formData.prompt,
          data: formData.data,
          points: formData.points,
          difficulty: formData.difficulty,
          tags: formData.tags,
        });
        toast({ title: "Actividad actualizada" });
      } else {
        await patchJSON(`/api/courses/${courseId}`, {
          action: "createQuestionInLesson",
          lessonId: activityDialog.lessonId,
          type: formData.type,
          title: formData.title,
          prompt: formData.prompt,
          data: formData.data,
          points: formData.points,
          difficulty: formData.difficulty,
        });
        toast({ title: "Actividad creada" });
      }
      refetch();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteActivity = async (questionId: string, title: string) => {
    if (!confirm(`¿Eliminar la actividad "${title}"?`)) return;
    try {
      await patchJSON(`/api/courses/${courseId}`, { action: "deleteQuestion", questionId });
      refetch();
      toast({ title: "Actividad eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("¿Eliminar esta unidad y todas sus lecciones?")) return;
    try {
      await patchJSON(`/api/courses/${courseId}`, { action: "deleteUnit", unitId });
      refetch();
      toast({ title: "Unidad eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePublishToCurriculum = async () => {
    if (!course) return;
    if (!confirm(`¿Publicar "${course.title}" al currículo? Se crearán unidades reales que los estudiantes verán. Si ya estaba publicado, se actualizará.`)) return;
    setPublishing(true);
    try {
      const res = await patchJSON<{ ok: boolean; publishedUnits: number; publishedLessons: number; publishedActivities: number }>(
        `/api/courses/${courseId}`,
        { action: "publishToCurriculum" }
      );
      toast({
        title: "Curso publicado",
        description: `${res.publishedUnits} unidades, ${res.publishedLessons} lecciones, ${res.publishedActivities} actividades creadas en el currículo.`
      });
      refetch();
    } catch (e) {
      toast({ title: "Error al publicar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !course) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-[#003366]" /></div>;
  }

  const totalLessons = course.units.reduce((a, u) => a + u.lessons.length, 0);
  const totalActivities = course.units.reduce((a, u) => a + u.lessons.reduce((b, l) => b + l.questions.length, 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <X className="mr-1.5 h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-[#0066AA] text-white">
            <DynamicIcon name={course.icon} className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{course.title}</h2>
            <p className="text-xs text-muted-foreground">
              {course.units.length} unidad{course.units.length !== 1 ? "es" : ""} · {totalLessons} leccione{totalLessons !== 1 ? "s" : ""} · {totalActivities} actividades ·{" "}
              <Badge variant="outline" className={cn(
                "text-xs ml-1",
                course.status === "published"
                  ? "border-[#003366]/30 bg-[#003366]/5 text-[#003366]"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
              )}>
                {course.status === "published" ? "Publicado" : "Borrador"}
              </Badge>
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handlePublishToCurriculum}
            disabled={publishing || course.units.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            title={course.units.length === 0 ? "Crea al menos una unidad primero" : "Publicar al currículo para que los estudiantes lo vean"}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {publishing ? "Publicando..." : "Publicar al currículo"}
          </Button>
          <Button size="sm" onClick={() => setNewUnitOpen(true)} className="bg-[#003366] hover:bg-[#004488]">
            <Plus className="mr-1.5 h-4 w-4" /> Nueva Unidad
          </Button>
        </div>
      </div>

      {course.units.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#003366]/5">
              <BookOpen className="h-5 w-5 text-[#003366]" />
            </div>
            <p className="text-sm font-medium">Sin unidades</p>
            <p className="text-xs text-muted-foreground">Crea unidades para organizar las lecciones del curso</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {course.units.map((unit, ui) => (
            <Card key={unit.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#003366]/10 text-xs font-bold text-[#003366]">{ui + 1}</span>
                    <CardTitle className="text-base truncate">{unit.title}</CardTitle>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditUnitFor(unit.id);
                        setUnitForm({
                          title: unit.title,
                          summary: unit.summary,
                          description: unit.description,
                          icon: unit.icon,
                          color: unit.color,
                        });
                      }}
                    >
                      <Edit2 className="mr-1 h-3 w-3" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLessonDialog({ open: true, unitId: unit.id, initial: null })}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Lección
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-rose-600"
                      onClick={() => handleDeleteUnit(unit.id)}
                      aria-label="Eliminar unidad"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {unit.summary && <CardDescription>{unit.summary}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-2">
                {unit.lessons.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Sin lecciones en esta unidad</p>
                ) : (
                  unit.lessons.map((lesson, li) => {
                    const expanded = expandedLessons.has(lesson.id);
                    return (
                      <div key={lesson.id} className="rounded-lg border border-border overflow-hidden">
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => toggleLesson(lesson.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">{li + 1}</span>
                            <p className="truncate text-sm font-medium">{lesson.title}</p>
                            {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          </button>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {lesson.durationMin}min</span>
                            <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {lesson.questions.length}</span>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLessonDialog({ open: true, unitId: unit.id, initial: { id: lesson.id, title: lesson.title, description: lesson.description, content: lesson.content, durationMin: lesson.durationMin } })}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => handleDeleteLesson(lesson.id, lesson.title)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                            {lesson.questions.length === 0 ? (
                              <p className="py-2 text-center text-xs text-muted-foreground">Sin actividades en esta lección</p>
                            ) : (
                              lesson.questions.map((qst, qi) => {
                                const meta = activityTypeMeta[qst.type as keyof typeof activityTypeMeta];
                                const diff = difficultyMeta[qst.difficulty as keyof typeof difficultyMeta];
                                return (
                                  <div key={qst.id} className="flex items-start gap-3 rounded-md border border-border bg-background p-2.5">
                                    <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium", diff.bg, diff.color)}>
                                      {qi + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium truncate">{qst.title}</p>
                                        <Badge variant="outline" className="text-xs">{meta?.label ?? qst.type}</Badge>
                                        <Badge variant="outline" className={cn("text-xs", diff.bg, diff.color)}>{diff.label}</Badge>
                                        <Badge variant="secondary" className="text-xs">{qst.points} pts</Badge>
                                      </div>
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{qst.prompt}</p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => setActivityDialog({
                                          open: true,
                                          lessonId: lesson.id,
                                          initial: {
                                            id: qst.id,
                                            type: qst.type,
                                            title: qst.title,
                                            prompt: qst.prompt,
                                            data: qst.data,
                                            points: qst.points,
                                            difficulty: qst.difficulty,
                                            tags: qst.tags || "",
                                          }
                                        })}
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-rose-600"
                                        onClick={() => handleDeleteActivity(qst.id, qst.title)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-dashed"
                                onClick={() => setActivityDialog({ open: true, lessonId: lesson.id, initial: null })}
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Nueva actividad
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-dashed"
                                onClick={() => setImportDialog({ open: true, lessonId: lesson.id })}
                              >
                                <Upload className="mr-1 h-3.5 w-3.5" /> Importar del banco
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Inline new lesson button */}
                {unit.lessons.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => setLessonDialog({ open: true, unitId: unit.id, initial: null })}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Crear primera lección
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog nueva/editar unidad */}
      <Dialog open={newUnitOpen || editUnitFor !== null} onOpenChange={(o) => { if (!o) { setNewUnitOpen(false); setEditUnitFor(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUnitFor ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
            <DialogDescription>
              {editUnitFor ? "Modifica los metadatos de la unidad" : "Crea una unidad para agrupar lecciones"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input value={unitForm.title} onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Resumen</Label>
              <Input value={unitForm.summary} onChange={(e) => setUnitForm({ ...unitForm, summary: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción</Label>
              <Textarea value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} className="mt-1 min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Color</Label>
                <select
                  value={unitForm.color}
                  onChange={(e) => setUnitForm({ ...unitForm, color: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="emerald">Azul UV</option>
                  <option value="sky">Azul claro</option>
                  <option value="violet">Azul oscuro</option>
                  <option value="amber">Dorado</option>
                  <option value="rose">Rosado</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Icono</Label>
                <Input value={unitForm.icon} onChange={(e) => setUnitForm({ ...unitForm, icon: e.target.value })} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setNewUnitOpen(false); setEditUnitFor(null); }}>Cancelar</Button>
            <Button size="sm" onClick={editUnitFor ? handleUpdateUnit : handleCreateUnit} className="bg-[#003366] hover:bg-[#004488]">
              <Save className="mr-1.5 h-3.5 w-3.5" /> {editUnitFor ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson editor dialog */}
      <LessonEditorDialog
        open={lessonDialog.open}
        onOpenChange={(o) => setLessonDialog({ open: o, unitId: lessonDialog.unitId, initial: lessonDialog.initial })}
        initial={lessonDialog.initial}
        onSave={async (data) => {
          if (lessonDialog.initial?.id) {
            await handleUpdateLesson(data);
          } else {
            await handleCreateLesson(data);
          }
        }}
      />

      {/* Activity editor dialog */}
      <ActivityEditorDialog
        open={activityDialog.open}
        onOpenChange={(o) => setActivityDialog({ open: o, lessonId: activityDialog.lessonId, initial: activityDialog.initial })}
        initial={activityDialog.initial}
        onSave={handleSaveActivity}
      />

      {/* Question bank import dialog */}
      <QuestionBankImportDialog
        open={importDialog.open}
        onOpenChange={(o) => setImportDialog({ open: o, lessonId: importDialog.lessonId })}
        lessonId={importDialog.lessonId}
        courseId={courseId}
        authorId={course.authorId}
        onImported={refetch}
      />
    </div>
  );
}
