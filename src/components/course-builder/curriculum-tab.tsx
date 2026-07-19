"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON, patchJSON, deleteURL } from "@/hooks/use-fetch";
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
  AlertTriangle,
  FileText,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonEditorDialog, type LessonFormData } from "./lesson-editor-dialog";
import { ActivityEditorDialog, type ActivityFormData } from "./activity-editor-dialog";
import { activityTypeMeta, difficultyMeta, getUnitColor } from "@/lib/course-utils";

interface CurriculumUnit {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  lessonCount: number;
  activityCount: number;
  sourceCourseId: string | null;
}

interface CurriculumUnitDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  objectives: { id: string; code: string; description: string; bloomLevel: string }[];
  lessons: {
    id: string;
    unitId: string;
    slug: string;
    title: string;
    description: string;
    content: string;
    durationMin: number;
    order: number;
    activities: {
      id: string;
      lessonId: string;
      type: string;
      title: string;
      prompt: string;
      data: string;
      points: number;
      difficulty: string;
      order: number;
      assessmentType: string;
      bloomLevel: string;
      maxAttempts: number;
      masteryThreshold: number;
      weight: number;
      timeLimitMin: number | null;
      rubricId: string | null;
    }[];
  }[];
}

const typeLabels: Record<string, string> = {
  multiple_choice: "Selección múltiple",
  guided_problem: "Problema guiado",
  case_analysis: "Análisis de caso",
  progressive_exercise: "Ejercicio progresivo",
  self_assessment: "Autoevaluación",
};

export function CurriculumTab() {
  const { data, loading, refetch } = useFetch<{ units: CurriculumUnit[] }>("/api/admin/units", []);
  const { toast } = useToast();
  const [editingUnitId, setEditingUnitId] = React.useState<string | null>(null);
  const [createUnitOpen, setCreateUnitOpen] = React.useState(false);
  const [unitForm, setUnitForm] = React.useState({
    title: "",
    summary: "",
    description: "",
    color: "sky",
    icon: "BookOpen",
  });

  const units = data?.units ?? [];

  const handleCreateUnit = async () => {
    if (!unitForm.title.trim()) {
      toast({ title: "Error", description: "El título es obligatorio", variant: "destructive" });
      return;
    }
    try {
      await postJSON("/api/admin/units", unitForm);
      setCreateUnitOpen(false);
      setUnitForm({ title: "", summary: "", description: "", color: "sky", icon: "BookOpen" });
      refetch();
      toast({ title: "Unidad creada", description: "La unidad se agregó al currículo" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteUnit = async (unitId: string, title: string) => {
    if (!confirm(`¿Eliminar la unidad "${title}" y TODAS sus lecciones y actividades? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteURL(`/api/admin/units?unitId=${unitId}`);
      refetch();
      toast({ title: "Unidad eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (editingUnitId) {
    return <CurriculumUnitEditor unitId={editingUnitId} onBack={() => { setEditingUnitId(null); refetch(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Currículo existente</h3>
          <p className="text-xs text-muted-foreground">
            {units.length} unidad{units.length !== 1 ? "es" : ""} · Edita el contenido que ven los estudiantes
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateUnitOpen(true)} className="bg-primary hover:bg-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva Unidad
        </Button>
      </div>

      <div className="rounded-md border border-gold/30 bg-gold-soft p-3 text-xs text-gold-foreground">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Zona de edición directa del currículo</p>
            <p className="mt-0.5">Los cambios que hagas aquí se reflejan inmediatamente en la vista de los estudiantes. Procede con precaución.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Sin unidades en el currículo</p>
            <p className="text-xs text-muted-foreground">Crea una unidad para empezar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {units.map((u, idx) => {
            const color = getUnitColor(u.color);
            return (
              <Card key={u.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", color.gradient)}>
                    <DynamicIcon name={u.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground">#{u.order + 1}</span>
                      <h3 className="truncate text-sm font-bold">{u.title}</h3>
                      {u.sourceCourseId && (
                        <Badge variant="outline" className="text-xs border-primary/30 bg-primary/5 text-primary">
                          Sandbox
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.summary || "Sin resumen"} · {u.lessonCount} lecciones · {u.activityCount} actividades
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs bg-primary hover:bg-primary"
                      onClick={() => setEditingUnitId(u.id)}
                    >
                      <Edit2 className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                      onClick={() => handleDeleteUnit(u.id, u.title)}
                      aria-label={`Eliminar unidad ${u.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog crear unidad */}
      <Dialog open={createUnitOpen} onOpenChange={setCreateUnitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva unidad del currículo</DialogTitle>
            <DialogDescription>
              Crea una nueva unidad que será visible para los estudiantes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input value={unitForm.title} onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })} placeholder="Ej: Biomateriales y biocompatibilidad" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Resumen (1 línea)</Label>
              <Input value={unitForm.summary} onChange={(e) => setUnitForm({ ...unitForm, summary: e.target.value })} placeholder="Aparece en la tarjeta de la unidad" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción larga</Label>
              <Textarea value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} placeholder="Descripción que se muestra al abrir la unidad" className="mt-1 min-h-[70px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Color</Label>
                <select
                  value={unitForm.color}
                  onChange={(e) => setUnitForm({ ...unitForm, color: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="emerald">Azul UV (emerald)</option>
                  <option value="sky">Azul claro (sky)</option>
                  <option value="violet">Azul oscuro (violet)</option>
                  <option value="amber">Dorado (amber)</option>
                  <option value="rose">Rosado (rose)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Icono</Label>
                <Input value={unitForm.icon} onChange={(e) => setUnitForm({ ...unitForm, icon: e.target.value })} placeholder="BookOpen, HeartPulse..." className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateUnitOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateUnit} className="bg-primary hover:bg-primary">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ UNIT EDITOR ============

function CurriculumUnitEditor({ unitId, onBack }: { unitId: string; onBack: () => void }) {
  const { data, loading, refetch } = useFetch<{ unit: CurriculumUnitDetail }>(
    `/api/admin/units/${unitId}`,
    [unitId]
  );
  const { toast } = useToast();
  const [editUnitOpen, setEditUnitOpen] = React.useState(false);
  const [lessonDialog, setLessonDialog] = React.useState<{ open: boolean; initial: LessonFormData | null }>({ open: false, initial: null });
  const [activityDialog, setActivityDialog] = React.useState<{ open: boolean; lessonId: string | null; initial: ActivityFormData | null }>({ open: false, lessonId: null, initial: null });
  const [expandedLessons, setExpandedLessons] = React.useState<Set<string>>(new Set());
  const [unitForm, setUnitForm] = React.useState({ title: "", summary: "", description: "", icon: "BookOpen", color: "sky" });
  const [newObjOpen, setNewObjOpen] = React.useState(false);
  const [objForm, setObjForm] = React.useState({ code: "", description: "", bloomLevel: "apply" });

  const unit = data?.unit;

  React.useEffect(() => {
    if (unit) {
      setUnitForm({
        title: unit.title,
        summary: unit.summary,
        description: unit.description,
        icon: unit.icon,
        color: unit.color,
      });
    }
  }, [unit?.id]);

  const toggleLesson = (id: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateUnit = async () => {
    try {
      await patchJSON("/api/admin/units", { unitId, ...unitForm });
      setEditUnitOpen(false);
      refetch();
      toast({ title: "Unidad actualizada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleCreateLesson = async (formData: LessonFormData) => {
    try {
      await postJSON("/api/admin/lessons", {
        unitId,
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
      await patchJSON("/api/admin/lessons", {
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
    if (!confirm(`¿Eliminar la lección "${title}" y todas sus actividades?`)) return;
    try {
      await deleteURL(`/api/admin/lessons?lessonId=${lessonId}`);
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
        await patchJSON("/api/admin/activities", {
          activityId: formData.id,
          type: formData.type,
          title: formData.title,
          prompt: formData.prompt,
          data: formData.data,
          points: formData.points,
          difficulty: formData.difficulty,
          assessmentType: formData.assessmentType,
          bloomLevel: formData.bloomLevel,
          maxAttempts: formData.maxAttempts,
          masteryThreshold: formData.masteryThreshold,
          weight: formData.weight,
          timeLimitMin: formData.timeLimitMin,
          rubricId: formData.rubricId,
          objectiveIds: formData.objectiveIds,
        });
        toast({ title: "Actividad actualizada" });
      } else {
        await postJSON("/api/admin/activities", {
          lessonId: activityDialog.lessonId,
          type: formData.type,
          title: formData.title,
          prompt: formData.prompt,
          data: formData.data,
          points: formData.points,
          difficulty: formData.difficulty,
          assessmentType: formData.assessmentType,
          bloomLevel: formData.bloomLevel,
          maxAttempts: formData.maxAttempts,
          masteryThreshold: formData.masteryThreshold,
          weight: formData.weight,
          timeLimitMin: formData.timeLimitMin,
          rubricId: formData.rubricId,
          objectiveIds: formData.objectiveIds,
        });
        toast({ title: "Actividad creada" });
      }
      refetch();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteActivity = async (activityId: string, title: string) => {
    if (!confirm(`¿Eliminar la actividad "${title}"?`)) return;
    try {
      await deleteURL(`/api/admin/activities?activityId=${activityId}`);
      refetch();
      toast({ title: "Actividad eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  // === Objetivos de aprendizaje ===
  const handleCreateObjective = async () => {
    if (!objForm.description.trim()) {
      toast({ title: "Error", description: "La descripción es obligatoria", variant: "destructive" });
      return;
    }
    try {
      await postJSON("/api/admin/objectives", {
        unitId,
        code: objForm.code || undefined,
        description: objForm.description,
        bloomLevel: objForm.bloomLevel,
      });
      setObjForm({ code: "", description: "", bloomLevel: "apply" });
      setNewObjOpen(false);
      refetch();
      toast({ title: "Objetivo creado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteObjective = async (objectiveId: string) => {
    if (!confirm("¿Eliminar este objetivo de aprendizaje?")) return;
    try {
      await deleteURL(`/api/admin/objectives?objectiveId=${objectiveId}`);
      refetch();
      toast({ title: "Objetivo eliminado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (loading || !unit) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>;
  }

  const color = getUnitColor(unit.color);
  const totalActivities = unit.lessons.reduce((a, l) => a + l.activities.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <X className="mr-1.5 h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white", color.gradient)}>
            <DynamicIcon name={unit.icon} className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{unit.title}</h2>
            <p className="text-xs text-muted-foreground">
              {unit.lessons.length} lecciones · {totalActivities} actividades · Orden #{unit.order + 1}
            </p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditUnitOpen(true)}>
            <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Editar unidad
          </Button>
          <Button size="sm" onClick={() => setLessonDialog({ open: true, initial: null })} className="bg-primary hover:bg-primary">
            <Plus className="mr-1.5 h-4 w-4" /> Nueva Lección
          </Button>
        </div>
      </div>

      {/* Objetivos de aprendizaje de la unidad */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Objetivos de aprendizaje</CardTitle>
              <Badge variant="outline" className="text-xs">{unit.objectives.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNewObjOpen(true)}>
              <Plus className="mr-1 h-3 w-3" /> Nuevo objetivo
            </Button>
          </div>
          <CardDescription className="text-xs">
            Define qué debe poder hacer el estudiante al terminar esta unidad. Las actividades se vinculan a estos objetivos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unit.objectives.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Sin objetivos definidos. Crea al menos uno para alinear la evaluación.
            </p>
          ) : (
            <div className="space-y-1.5">
              {unit.objectives.map((o) => (
                <div key={o.id} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5">
                  <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{o.code}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">{o.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">Bloom: {o.bloomLevel}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-rose-600 shrink-0"
                    onClick={() => handleDeleteObjective(o.id)}
                    aria-label="Eliminar objetivo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de lecciones */}
      {unit.lessons.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Sin lecciones</p>
            <p className="text-xs text-muted-foreground">Crea lecciones para organizar el contenido de la unidad</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {unit.lessons.map((lesson, li) => {
            const expanded = expandedLessons.has(lesson.id);
            return (
              <Card key={lesson.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleLesson(lesson.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{li + 1}</span>
                      <CardTitle className="text-base truncate">{lesson.title}</CardTitle>
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActivityDialog({ open: true, lessonId: lesson.id, initial: null })}>
                        <Plus className="mr-1 h-3 w-3" /> Actividad
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLessonDialog({ open: true, initial: { id: lesson.id, title: lesson.title, description: lesson.description, content: lesson.content, durationMin: lesson.durationMin } })}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => handleDeleteLesson(lesson.id, lesson.title)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {lesson.durationMin} min
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3 w-3" /> {lesson.activities.length} actividades
                    </span>
                    {lesson.description && (
                      <span className="truncate">· {lesson.description}</span>
                    )}
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="border-t border-border bg-muted/20 pt-3 space-y-2">
                    {lesson.activities.length === 0 ? (
                      <p className="py-2 text-center text-xs text-muted-foreground">Sin actividades en esta lección</p>
                    ) : (
                      lesson.activities.map((act, ai) => {
                        const meta = activityTypeMeta[act.type as keyof typeof activityTypeMeta];
                        const diff = difficultyMeta[act.difficulty as keyof typeof difficultyMeta];
                        const assessLabel: Record<string, string> = {
                          diagnostic: "Diagnóstica",
                          formative: "Formativa",
                          summative: "Sumativa",
                          self_reflection: "Auto-reflexión",
                        };
                        const assessColor: Record<string, string> = {
                          diagnostic: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
                          formative: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          summative: "border-gold/30 bg-gold-soft text-gold-foreground",
                          self_reflection: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
                        };
                        return (
                          <div key={act.id} className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
                            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-medium", diff.bg, diff.color)}>
                              {ai + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium truncate">{act.title}</p>
                                <Badge variant="outline" className="text-xs">
                                  {meta?.label ?? act.type}
                                </Badge>
                                <Badge variant="outline" className={cn("text-xs", assessColor[act.assessmentType] || "")} title="Tipo de evaluación">
                                  {assessLabel[act.assessmentType] ?? act.assessmentType}
                                </Badge>
                                <Badge variant="outline" className={cn("text-xs", diff.bg, diff.color)}>
                                  {diff.label}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">{act.points} pts</Badge>
                                <Badge variant="outline" className="text-xs capitalize" title="Nivel de Bloom">{act.bloomLevel}</Badge>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{act.prompt}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Intentos: {act.maxAttempts === 0 ? "∞" : act.maxAttempts} · Umbral: {act.masteryThreshold}% · Peso: {act.weight}x
                              </p>
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
                                    id: act.id,
                                    type: act.type,
                                    title: act.title,
                                    prompt: act.prompt,
                                    data: act.data,
                                    points: act.points,
                                    difficulty: act.difficulty,
                                    assessmentType: act.assessmentType,
                                    bloomLevel: act.bloomLevel,
                                    maxAttempts: act.maxAttempts,
                                    masteryThreshold: act.masteryThreshold,
                                    weight: act.weight,
                                    timeLimitMin: act.timeLimitMin,
                                    rubricId: act.rubricId,
                                  }
                                })}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-rose-600"
                                onClick={() => handleDeleteActivity(act.id, act.title)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => setActivityDialog({ open: true, lessonId: lesson.id, initial: null })}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Agregar actividad
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog editar unidad */}
      <Dialog open={editUnitOpen} onOpenChange={setEditUnitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar unidad</DialogTitle>
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
              <Textarea value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} className="mt-1 min-h-[70px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Color</Label>
                <select
                  value={unitForm.color}
                  onChange={(e) => setUnitForm({ ...unitForm, color: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="emerald">Azul UV (emerald)</option>
                  <option value="sky">Azul claro (sky)</option>
                  <option value="violet">Azul oscuro (violet)</option>
                  <option value="amber">Dorado (amber)</option>
                  <option value="rose">Rosado (rose)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Icono</Label>
                <Input value={unitForm.icon} onChange={(e) => setUnitForm({ ...unitForm, icon: e.target.value })} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditUnitOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleUpdateUnit} className="bg-primary hover:bg-primary">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson editor dialog */}
      <LessonEditorDialog
        open={lessonDialog.open}
        onOpenChange={(o) => setLessonDialog({ open: o, initial: lessonDialog.initial })}
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
        unitId={unitId}
      />

      {/* Dialog nuevo objetivo */}
      <Dialog open={newObjOpen} onOpenChange={setNewObjOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo objetivo de aprendizaje</DialogTitle>
            <DialogDescription>
              Define qué debe poder hacer el estudiante. Usa verbos medibles (ej: "calcular", "identificar", "analizar").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Código (opcional)</Label>
                <Input value={objForm.code} onChange={(e) => setObjForm({ ...objForm, code: e.target.value })} placeholder="O1, U1-O1..." className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Nivel de Bloom</Label>
                <select
                  value={objForm.bloomLevel}
                  onChange={(e) => setObjForm({ ...objForm, bloomLevel: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="remember">Recordar</option>
                  <option value="understand">Comprender</option>
                  <option value="apply">Aplicar</option>
                  <option value="analyze">Analizar</option>
                  <option value="evaluate">Evaluar</option>
                  <option value="create">Crear</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción del objetivo</Label>
              <Textarea
                value={objForm.description}
                onChange={(e) => setObjForm({ ...objForm, description: e.target.value })}
                placeholder="Ej: Calcular la impedancia de un electrodo Ag/AgCl a partir de su modelo eléctrico equivalente."
                className="mt-1 min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewObjOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateObjective} className="bg-primary hover:bg-primary">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Crear objetivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
