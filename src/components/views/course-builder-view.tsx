"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON, patchJSON, deleteURL } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/app/page-header";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { Card, CardContent } from "@/components/ui/card";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Database,
  ListChecks,
  FileText,
  Save,
  Library,
  Award,
  Sparkles,
} from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseEditor } from "@/components/course-builder/course-editor";
import { CurriculumTab } from "@/components/course-builder/curriculum-tab";
import { CourseWizard } from "@/components/course-builder/course-wizard";
import { RubricsTab } from "@/components/course-builder/rubrics-tab";

// Types
interface Course {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  status: string;
  order: number;
  unitCount: number;
  authorId: string;
}

interface QuestionBank {
  id: string;
  name: string;
  description: string | null;
  category: string;
  questionCount: number;
}

interface Question {
  id: string;
  type: string;
  title: string;
  prompt: string;
  data: string;
  points: number;
  difficulty: string;
  tags: string | null;
  bankId: string | null;
}

interface DataResource {
  id: string;
  name: string;
  type: string;
  content: string;
  tags: string | null;
}

const typeLabels: Record<string, string> = {
  multiple_choice: "Selección múltiple",
  guided_problem: "Problema guiado",
  case_analysis: "Análisis de caso",
  progressive_exercise: "Ejercicio progresivo",
  self_assessment: "Autoevaluación",
};

const resourceTypes: { value: string; label: string }[] = [
  { value: "glossary", label: "Glosario" },
  { value: "formula", label: "Fórmula" },
  { value: "reference", label: "Referencia" },
  { value: "dataset", label: "Dataset" },
];

export function CourseBuilderView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;
  const authorId = currentUser?.id ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Gestión de Contenidos"
        description="Crea cursos completos, edita el currículo existente, administra el banco de preguntas y los recursos de datos."
        icon="BookOpen"
        iconGradient="from-primary to-primary/70"
      />

      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList className="flex w-fit flex-wrap h-11 p-1 gap-1">
          <TabsTrigger value="courses" className="gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" /> Mis Cursos
          </TabsTrigger>
          <TabsTrigger value="curriculum" className="gap-2 text-sm font-medium">
            <Library className="h-4 w-4" /> Currículo Institucional
          </TabsTrigger>
          <TabsTrigger value="rubrics" className="gap-2 text-sm font-medium">
            <Award className="h-4 w-4" /> Rúbricas
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4" /> Banco de Preguntas
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2 text-sm font-medium">
            <Database className="h-4 w-4" /> Recursos de Datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <CoursesTab authorId={authorId} />
        </TabsContent>
        <TabsContent value="curriculum">
          <CurriculumTab />
        </TabsContent>
        <TabsContent value="rubrics">
          <RubricsTab authorId={authorId} />
        </TabsContent>
        <TabsContent value="questions">
          <QuestionsTab authorId={authorId} />
        </TabsContent>
        <TabsContent value="data">
          <DataTab authorId={authorId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ COURSES TAB ============

function CoursesTab({ authorId }: { authorId: string }) {
  const { data, loading, refetch } = useFetch<{ courses: Course[] }>(
    authorId ? `/api/courses?authorId=${authorId}` : null,
    [authorId]
  );
  const { toast } = useToast();
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [editCourse, setEditCourse] = React.useState<Course | null>(null);
  const [editingCourseId, setEditingCourseId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: "", description: "", color: "sky", icon: "BookOpen" });

  const handleDelete = async (courseId: string) => {
    if (!confirm("¿Eliminar este curso y todo su contenido?")) return;
    try {
      await deleteURL(`/api/courses?courseId=${courseId}`);
      refetch();
      toast({ title: "Curso eliminado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handlePublish = async (course: Course) => {
    try {
      await patchJSON("/api/courses", {
        courseId: course.id,
        status: course.status === "draft" ? "published" : "draft",
      });
      refetch();
      toast({ title: course.status === "draft" ? "Curso marcado como publicado" : "Curso en borrador" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const courses = data?.courses ?? [];

  if (editingCourseId) {
    return <CourseEditor courseId={editingCourseId} onBack={() => { setEditingCourseId(null); refetch(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {courses.length} curso{courses.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crea cursos completos con el asistente. Edita contenido, agrega actividades con evaluación y publica al currículo institucional.
          </p>
        </div>
        <Button size="sm" onClick={() => setWizardOpen(true)} className="bg-primary hover:bg-primary/90">
          <Sparkles className="mr-1.5 h-4 w-4" /> Nuevo Curso
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Sin cursos sandbox</p>
            <p className="text-xs text-muted-foreground">Crea tu primer curso para empezar a agregar contenido</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <Card key={c.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-md">
                  <DynamicIcon name={c.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="truncate text-sm font-bold">{c.title}</h3>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "published"
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : "border-gold/30 bg-gold-soft text-gold-foreground"
                      }
                    >
                      {c.status === "published" ? "Publicado" : "Borrador"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.description || "Sin descripción"} · {c.unitCount} unidad{c.unitCount !== 1 ? "es" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs bg-primary hover:bg-primary/90"
                    onClick={() => setEditingCourseId(c.id)}
                  >
                    <BookOpen className="mr-1 h-3.5 w-3.5" /> Editar contenido
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handlePublish(c)}
                  >
                    {c.status === "draft" ? "Marcar publicado" : "Despublicar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => { setEditCourse(c); setForm({ title: c.title, description: c.description, color: c.color, icon: c.icon }); }}
                    aria-label="Editar metadatos del curso"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Eliminar curso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Wizard de creación */}
      <CourseWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(courseId) => {
          setWizardOpen(false);
          setEditingCourseId(courseId);
          refetch();
        }}
      />

      {/* Dialog editar metadatos del curso */}
      <Dialog open={editCourse !== null} onOpenChange={(o) => { if (!o) setEditCourse(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar curso</DialogTitle>
            <DialogDescription>
              Modifica los metadatos del curso. El contenido se edita dentro del curso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Introducción a la Electrónica Médica" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descripción del curso" className="mt-1 min-h-[70px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Color</Label>
                <select
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
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
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="BookOpen, HeartPulse..." className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditCourse(null)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={async () => {
                if (editCourse) {
                  try {
                    await patchJSON("/api/courses", { courseId: editCourse.id, ...form });
                    refetch();
                    setEditCourse(null);
                    toast({ title: "Curso actualizado" });
                  } catch (e) {
                    toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
                  }
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ QUESTIONS TAB ============

function QuestionsTab({ authorId }: { authorId: string }) {
  const { data: banksData, refetch: refetchBanks } = useFetch<{ banks: QuestionBank[] }>(
    authorId ? `/api/question-banks?authorId=${authorId}` : null,
    [authorId]
  );
  const { data: questionsData, refetch: refetchQuestions } = useFetch<{ questions: Question[] }>(
    authorId ? `/api/question-banks/questions?authorId=${authorId}` : null,
    [authorId]
  );
  const { toast } = useToast();
  const [createBankOpen, setCreateBankOpen] = React.useState(false);
  const [bankForm, setBankForm] = React.useState({ name: "", description: "", category: "general" });
  const [editQ, setEditQ] = React.useState<Question | null>(null);
  const [form, setForm] = React.useState({
    bankId: "",
    type: "multiple_choice",
    title: "",
    prompt: "",
    data: '{"question":"","options":["A)","B)","C)","D)"],"correctIndex":0,"explanation":"","hints":[]}',
    points: 10,
    difficulty: "medium",
    tags: "",
  });
  const [createOpen, setCreateOpen] = React.useState(false);

  const banks = banksData?.banks ?? [];
  const questions = questionsData?.questions ?? [];

  const handleSave = async () => {
    if (!form.title.trim() || !form.prompt.trim()) {
      toast({ title: "Error", description: "Título y enunciado son obligatorios", variant: "destructive" });
      return;
    }
    try {
      if (editQ) {
        await patchJSON("/api/question-banks/questions", {
          questionId: editQ.id,
          type: form.type,
          title: form.title,
          prompt: form.prompt,
          data: form.data,
          points: Number(form.points),
          difficulty: form.difficulty,
          tags: form.tags,
        });
        toast({ title: "Pregunta actualizada" });
      } else {
        await postJSON("/api/question-banks/questions", {
          bankId: form.bankId || undefined,
          type: form.type,
          title: form.title,
          prompt: form.prompt,
          data: form.data,
          points: Number(form.points),
          difficulty: form.difficulty,
          tags: form.tags,
        });
        toast({ title: "Pregunta creada" });
      }
      setCreateOpen(false);
      setEditQ(null);
      setForm({
        bankId: "",
        type: "multiple_choice",
        title: "",
        prompt: "",
        data: '{"question":"","options":["A)","B)","C)","D)"],"correctIndex":0,"explanation":"","hints":[]}',
        points: 10,
        difficulty: "medium",
        tags: "",
      });
      refetchQuestions();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm("¿Eliminar esta pregunta del banco?")) return;
    try {
      await deleteURL(`/api/question-banks/questions?questionId=${questionId}`);
      refetchQuestions();
      toast({ title: "Pregunta eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleCreateBank = async () => {
    if (!bankForm.name.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    try {
      await postJSON("/api/question-banks", { authorId, ...bankForm });
      setCreateBankOpen(false);
      setBankForm({ name: "", description: "", category: "general" });
      refetchBanks();
      toast({ title: "Banco creado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Bancos de preguntas */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Bancos de Preguntas</h3>
          <p className="text-xs text-muted-foreground">{banks.length} banco{banks.length !== 1 ? "s" : ""} · {questions.length} pregunta{questions.length !== 1 ? "s" : ""} total</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreateBankOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo Banco
        </Button>
      </div>

      {banks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {banks.map((b) => (
            <Badge key={b.id} variant="secondary" className="gap-1.5 py-1.5">
              <FileText className="h-3 w-3" />
              {b.name}
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{b.questionCount}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Botón crear pregunta */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditQ(null); setCreateOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva Pregunta
        </Button>
      </div>

      {/* Lista de preguntas */}
      {questions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Sin preguntas</p>
            <p className="text-xs text-muted-foreground">Crea preguntas para reutilizarlas en tus cursos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {questions.map((q) => (
            <Card key={q.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-start gap-3 p-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                  <DynamicIcon name="ListChecks" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-medium">{q.title}</p>
                    <Badge variant="outline" className="text-xs">{typeLabels[q.type] ?? q.type}</Badge>
                    <Badge variant="secondary" className="text-xs">{q.difficulty}</Badge>
                    <Badge variant="outline" className="text-xs">{q.points} pts</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{q.prompt}</p>
                  {q.tags && <p className="mt-0.5 text-xs text-muted-foreground">Tags: {q.tags}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                    setEditQ(q);
                    setForm({
                      bankId: q.bankId || "",
                      type: q.type,
                      title: q.title,
                      prompt: q.prompt,
                      data: q.data,
                      points: q.points,
                      difficulty: q.difficulty,
                      tags: q.tags || "",
                    });
                    setCreateOpen(true);
                  }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar banco */}
      <Dialog open={createBankOpen} onOpenChange={setCreateBankOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo banco de preguntas</DialogTitle>
            <DialogDescription>Organiza preguntas por categoría para reutilizarlas</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Nombre</Label>
              <Input value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} placeholder="Ej: ECG y derivaciones" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción</Label>
              <Input value={bankForm.description} onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Categoría</Label>
              <select
                value={bankForm.category}
                onChange={(e) => setBankForm({ ...bankForm, category: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="general">General</option>
                <option value="mc">Selección múltiple</option>
                <option value="guided">Problemas guiados</option>
                <option value="case">Casos clínicos</option>
                <option value="self">Autoevaluación</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateBankOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateBank} className="bg-primary hover:bg-primary/90">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog crear/editar pregunta */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditQ(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editQ ? "Editar pregunta" : "Crear pregunta"}</DialogTitle>
            <DialogDescription>
              Define el tipo, enunciado y datos de la pregunta. El campo "data" es JSON con la estructura según el tipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(typeLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Banco (opcional)</Label>
                <select
                  value={form.bankId}
                  onChange={(e) => setForm({ ...form, bankId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sin banco</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Cálculo de impedancia de electrodo" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Enunciado / Prompt</Label>
              <Textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Enunciado de la pregunta..." className="mt-1 min-h-[60px]" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Datos (JSON)</Label>
              <Textarea
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="mt-1 min-h-[120px] font-mono text-xs"
                placeholder='{"question":"","options":["A)","B)","C)","D)"],"correctIndex":0,"explanation":"","hints":[]}'
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Estructura según tipo: MC=options/correctIndex, Guiado=steps/answer, Caso=case/questions, etc.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Puntos</Label>
                <Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Dificultad</Label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="easy">Básico</option>
                  <option value="medium">Intermedio</option>
                  <option value="hard">Avanzado</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Tags</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ecg, electrodos" className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); setEditQ(null); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90">
              <Save className="mr-1.5 h-3.5 w-3.5" /> {editQ ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ DATA RESOURCES TAB ============

function DataTab({ authorId }: { authorId: string }) {
  const { data, loading, refetch } = useFetch<{ resources: DataResource[] }>(
    authorId ? `/api/data-resources?authorId=${authorId}` : null,
    [authorId]
  );
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editR, setEditR] = React.useState<DataResource | null>(null);
  const [form, setForm] = React.useState({ name: "", type: "glossary", content: "", tags: "" });

  const resources = data?.resources ?? [];

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast({ title: "Error", description: "Nombre y contenido son obligatorios", variant: "destructive" });
      return;
    }
    try {
      if (editR) {
        await patchJSON("/api/data-resources", { resourceId: editR.id, ...form });
        toast({ title: "Recurso actualizado" });
      } else {
        await postJSON("/api/data-resources", { authorId, ...form });
        toast({ title: "Recurso creado" });
      }
      setCreateOpen(false);
      setEditR(null);
      setForm({ name: "", type: "glossary", content: "", tags: "" });
      refetch();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!confirm("¿Eliminar este recurso de datos?")) return;
    try {
      await deleteURL(`/api/data-resources?resourceId=${resourceId}`);
      refetch();
      toast({ title: "Recurso eliminado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const resourceIcons: Record<string, string> = {
    glossary: "BookOpen",
    formula: "Calculator",
    reference: "FileText",
    dataset: "Database",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {resources.length} recurso{resources.length !== 1 ? "s" : ""} de datos
        </p>
        <Button size="sm" onClick={() => { setEditR(null); setCreateOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo Recurso
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : resources.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Sin recursos de datos</p>
            <p className="text-xs text-muted-foreground">Crea glosarios, fórmulas, referencias o datasets</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map((r) => (
            <Card key={r.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                      <DynamicIcon name={resourceIcons[r.type] || "FileText"} className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <Badge variant="outline" className="text-xs capitalize">{r.type}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                      setEditR(r);
                      setForm({ name: r.name, type: r.type, content: r.content, tags: r.tags || "" });
                      setCreateOpen(true);
                    }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{r.content}</p>
                {r.tags && <p className="mt-1 text-xs text-muted-foreground">Tags: {r.tags}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar recurso */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditR(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editR ? "Editar recurso" : "Crear recurso de datos"}</DialogTitle>
            <DialogDescription>
              Glosarios, fórmulas, referencias o datasets para alimentar el contenido del curso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Glosario de ECG" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Tipo</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {resourceTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Contenido (Markdown o JSON)</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="mt-1 min-h-[150px] font-mono text-xs"
                placeholder="## Glosario&#10;&#10;**ECG**: Electrocardiograma..."
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Tags</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ecg, glosario, cardio" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); setEditR(null); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary/90">
              <Save className="mr-1.5 h-3.5 w-3.5" /> {editR ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
