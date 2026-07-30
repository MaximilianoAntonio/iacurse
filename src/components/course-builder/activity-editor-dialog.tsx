"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownPreview } from "./markdown-preview";
import { Save, Plus, Trash2, ListChecks, AlertCircle, Target, Award, GraduationCap, Loader2 } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";

export interface ActivityFormData {
  id?: string;
  type: string;
  title: string;
  prompt: string;
  data: string;
  points: number;
  difficulty: string;
  tags?: string;
  // Metadatos de evaluación
  assessmentType?: string;
  bloomLevel?: string;
  maxAttempts?: number;
  masteryThreshold?: number;
  weight?: number;
  timeLimitMin?: number | null;
  rubricId?: string | null;
  objectiveIds?: string[];
}

// Metadatos de tipos de evaluación
const assessmentTypes: { value: string; label: string; description: string; color: string }[] = [
  { value: "diagnostic", label: "Diagnóstica", description: "Detecta conocimientos previos. No cuenta para la nota.", color: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  { value: "formative", label: "Formativa", description: "Práctica con retroalimentación. Intentos ilimitados, pistas activadas.", color: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  { value: "summative", label: "Sumativa", description: "Evaluación calificada. Intentos limitados, sin pistas.", color: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "self_reflection", label: "Auto-reflexión", description: "El estudiante reflexiona y se auto-evalúa con rúbrica.", color: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300" },
];

const bloomLevels: { value: string; label: string; color: string }[] = [
  { value: "remember", label: "Recordar", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  { value: "understand", label: "Comprender", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { value: "apply", label: "Aplicar", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { value: "analyze", label: "Analizar", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { value: "evaluate", label: "Evaluar", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { value: "create", label: "Crear", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
];

const typeLabels: Record<string, string> = {
  multiple_choice: "Selección múltiple",
  guided_problem: "Problema guiado",
  case_analysis: "Análisis de caso",
  progressive_exercise: "Ejercicio progresivo",
  self_assessment: "Autoevaluación",
};

const defaultDataTemplates: Record<string, string> = {
  multiple_choice: JSON.stringify(
    {
      question: "",
      options: ["Opción A", "Opción B", "Opción C", "Opción D"],
      correctIndex: 0,
      explanation: "",
      hints: [],
    },
    null,
    2
  ),
  guided_problem: JSON.stringify(
    {
      scenario: "",
      steps: [
        { prompt: "", answer: "", hint: "" },
      ],
      finalAnswer: "",
      explanation: "",
    },
    null,
    2
  ),
  case_analysis: JSON.stringify(
    {
      case: "",
      questions: [{ prompt: "", answer: "", explanation: "" }],
    },
    null,
    2
  ),
  progressive_exercise: JSON.stringify(
    {
      levels: [{ prompt: "", answer: "", explanation: "" }],
    },
    null,
    2
  ),
  self_assessment: JSON.stringify(
    {
      prompt: "",
      rubric: ["Criterio 1", "Criterio 2"],
      autoGradeKeywords: [],
    },
    null,
    2
  ),
};

interface ActivityEditorDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ActivityFormData | null;
  onSave: (data: ActivityFormData) => Promise<void>;
  unitId?: string;
  authorId?: string;
}

/**
 * Editor visual de actividad/pregunta.
 * Tiene CUATRO pestañas:
 *  - "General": tipo, título, enunciado, puntos, dificultad, tags
 *  - "Contenido": editor visual según el tipo (options/steps/case/levels/rubric)
 *  - "Evaluación": tipo de evaluación, Bloom, intentos, umbral de dominio, peso, rúbrica, objetivos
 *  - "JSON": editor directo del JSON para usuarios avanzados
 */
export function ActivityEditorDialog({ open, onOpenChange, initial, onSave, unitId, authorId }: ActivityEditorDialogProps) {
  const [type, setType] = React.useState("multiple_choice");
  const [title, setTitle] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [dataStr, setDataStr] = React.useState(defaultDataTemplates.multiple_choice);
  const [points, setPoints] = React.useState(10);
  const [difficulty, setDifficulty] = React.useState("medium");
  const [tags, setTags] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Metadatos de evaluación
  const [assessmentType, setAssessmentType] = React.useState("formative");
  const [bloomLevel, setBloomLevel] = React.useState("apply");
  const [maxAttempts, setMaxAttempts] = React.useState(3);
  const [masteryThreshold, setMasteryThreshold] = React.useState(70);
  const [weight, setWeight] = React.useState(1);
  const [timeLimitMin, setTimeLimitMin] = React.useState<number | null>(null);
  const [rubricId, setRubricId] = React.useState<string | null>(null);
  const [objectiveIds, setObjectiveIds] = React.useState<string[]>([]);

  // Cargar objetivos de la unidad (para vincular) y rúbricas del docente
  const { data: objData } = useFetch<{ objectives: { id: string; code: string; description: string; bloomLevel: string }[] }>(
    unitId ? `/api/admin/objectives?unitId=${unitId}` : null,
    [unitId, open]
  );
  const { data: rubricData } = useFetch<{ rubrics: { id: string; name: string; description: string | null }[] }>(
    authorId ? `/api/admin/rubrics?authorId=${authorId}` : null,
    [authorId, open]
  );

  // Sincronizar el formulario cuando cambia `initial` o se abre el diálogo
  // (patrón "ajustar estado durante el render").
  const [prevSync, setPrevSync] = React.useState<{ open: boolean; initial: typeof initial }>({ open: false, initial: null });
  if (open !== prevSync.open || initial !== prevSync.initial) {
    setPrevSync({ open, initial });
    if (open) {
      if (initial) {
        setType(initial.type);
        setTitle(initial.title);
        setPrompt(initial.prompt);
        setDataStr(initial.data);
        setPoints(initial.points);
        setDifficulty(initial.difficulty);
        setTags(initial.tags || "");
        setAssessmentType(initial.assessmentType || "formative");
        setBloomLevel(initial.bloomLevel || "apply");
        setMaxAttempts(initial.maxAttempts ?? 3);
        setMasteryThreshold(initial.masteryThreshold ?? 70);
        setWeight(initial.weight ?? 1);
        setTimeLimitMin(initial.timeLimitMin ?? null);
        setRubricId(initial.rubricId ?? null);
        setObjectiveIds(initial.objectiveIds || []);
      } else {
        setType("multiple_choice");
        setTitle("");
        setPrompt("");
        setDataStr(defaultDataTemplates.multiple_choice);
        setPoints(10);
        setDifficulty("medium");
        setTags("");
        setAssessmentType("formative");
        setBloomLevel("apply");
        setMaxAttempts(3);
        setMasteryThreshold(70);
        setWeight(1);
        setTimeLimitMin(null);
        setRubricId(null);
        setObjectiveIds([]);
      }
      setError(null);
    }
  }

  const handleTypeChange = (newType: string) => {
    setType(newType);
    // Solo reemplazar la plantilla si el data actual no parsea o está vacío
    try {
      const parsed = JSON.parse(dataStr);
      if (!parsed || Object.keys(parsed).length === 0) {
        setDataStr(defaultDataTemplates[newType]);
      }
    } catch {
      setDataStr(defaultDataTemplates[newType]);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (!prompt.trim()) {
      setError("El enunciado es obligatorio");
      return;
    }
    // Validar JSON
    try {
      JSON.parse(dataStr);
    } catch (e) {
      setError(`JSON inválido: ${(e as Error).message}`);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        type,
        title: title.trim(),
        prompt: prompt.trim(),
        data: dataStr,
        points: Number(points) || 10,
        difficulty,
        tags: tags.trim(),
        assessmentType,
        bloomLevel,
        maxAttempts: Number(maxAttempts) || 0,
        masteryThreshold: Number(masteryThreshold) || 70,
        weight: Number(weight) || 1,
        timeLimitMin: timeLimitMin ? Number(timeLimitMin) : null,
        rubricId,
        objectiveIds,
      });
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Parsear el data para mostrar el editor visual
  let parsedData: any = null;
  try {
    parsedData = JSON.parse(dataStr);
  } catch {
    // JSON inválido — el usuario verá el error al guardar
  }

  const updateData = (newData: any) => {
    setDataStr(JSON.stringify(newData, null, 2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar actividad" : "Crear actividad"}</DialogTitle>
          <DialogDescription>
            Configura el tipo, enunciado y contenido de la actividad. Los estudiantes interactuarán con esta actividad.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-10">
            <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
            <TabsTrigger value="content" className="text-xs">Contenido</TabsTrigger>
            <TabsTrigger value="assessment" className="text-xs gap-1"><Award className="h-3 w-3" /> Evaluación</TabsTrigger>
            <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de actividad</Label>
                <select
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(typeLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Dificultad</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="easy">Básico</option>
                  <option value="medium">Intermedio</option>
                  <option value="hard">Avanzado</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cálculo de impedancia de electrodo"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Enunciado / Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe la actividad o pregunta que verá el estudiante..."
                className="mt-1 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Puntos</Label>
                <Input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Tags (opcional)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ecg, electrodos, cardio"
                  className="mt-1"
                />
              </div>
            </div>
          </TabsContent>

          {/* CONTENT — editor visual según tipo */}
          <TabsContent value="content" className="space-y-3 mt-3">
            {!parsedData && (
              <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                JSON inválido. Cambia a la pestaña JSON para corregirlo.
              </div>
            )}
            {parsedData && type === "multiple_choice" && (
              <MultipleChoiceEditor data={parsedData} onChange={updateData} />
            )}
            {parsedData && type === "guided_problem" && (
              <GuidedProblemEditor data={parsedData} onChange={updateData} />
            )}
            {parsedData && type === "case_analysis" && (
              <CaseAnalysisEditor data={parsedData} onChange={updateData} />
            )}
            {parsedData && type === "progressive_exercise" && (
              <ProgressiveExerciseEditor data={parsedData} onChange={updateData} />
            )}
            {parsedData && type === "self_assessment" && (
              <SelfAssessmentEditor data={parsedData} onChange={updateData} />
            )}
          </TabsContent>

          {/* ASSESSMENT — configuración pedagógica de la evaluación */}
          <TabsContent value="assessment" className="space-y-4 mt-3">
            {/* Tipo de evaluación */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5" /> Tipo de evaluación
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Define cómo esta actividad contribuye a la evaluación del estudiante.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {assessmentTypes.map((at) => (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => {
                      setAssessmentType(at.value);
                      // Auto-configurar políticas según tipo
                      if (at.value === "formative") {
                        setMaxAttempts(0); // ilimitado
                      } else if (at.value === "summative") {
                        setMaxAttempts(1);
                      } else if (at.value === "diagnostic") {
                        setMaxAttempts(1);
                      }
                    }}
                    className={`rounded-lg border-2 p-2.5 text-left transition-all ${
                      assessmentType === at.value
                        ? at.color + " ring-2 ring-offset-1"
                        : "border-border bg-background hover:bg-accent/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{at.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{at.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Nivel de Bloom */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Nivel cognitivo (Taxonomía de Bloom)
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ¿Qué proceso cognitivo requiere esta actividad?
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bloomLevels.map((bl) => (
                  <button
                    key={bl.value}
                    type="button"
                    onClick={() => setBloomLevel(bl.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      bloomLevel === bl.value
                        ? bl.color + " ring-2 ring-offset-1"
                        : "border border-border bg-background hover:bg-accent/40 text-muted-foreground"
                    }`}
                  >
                    {bl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Políticas de intentos y dominio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Intentos máximos</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">0 = ilimitados</p>
                <Input
                  type="number"
                  min={0}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Umbral de dominio (%)</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">% mínimo para aprobar</p>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={masteryThreshold}
                  onChange={(e) => setMasteryThreshold(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Peso en la nota</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Peso relativo en la unidad</p>
                <Input
                  type="number"
                  min={1}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Tiempo límite (min)</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Vacío = sin límite</p>
                <Input
                  type="number"
                  min={1}
                  value={timeLimitMin ?? ""}
                  onChange={(e) => setTimeLimitMin(e.target.value ? Number(e.target.value) : null)}
                  className="mt-1"
                  placeholder="—"
                />
              </div>
            </div>

            {/* Rúbrica (para respuestas abiertas) */}
            <div>
              <Label className="text-xs font-semibold">Rúbrica de evaluación (opcional)</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Para respuestas abiertas (casos, autoevaluación). La IA usará la rúbrica al generar la retroalimentación.
              </p>
              <select
                value={rubricId || ""}
                onChange={(e) => setRubricId(e.target.value || null)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sin rúbrica (evaluación automática)</option>
                {(rubricData?.rubrics ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {(rubricData?.rubrics ?? []).length === 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  No has creado rúbricas. Créalas en la pestaña "Biblioteca".
                </p>
              )}
            </div>

            {/* Objetivos de aprendizaje */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Objetivos de aprendizaje evaluados
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vincula esta actividad a los objetivos de la unidad para trazabilidad pedagógica.
              </p>
              <div className="mt-2 space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {(objData?.objectives ?? []).length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                    Esta unidad no tiene objetivos definidos. Créalos en el editor de unidad.
                  </p>
                ) : (
                  (objData?.objectives ?? []).map((o) => (
                    <label
                      key={o.id}
                      className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer transition-all ${
                        objectiveIds.includes(o.id)
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:bg-accent/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={objectiveIds.includes(o.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setObjectiveIds([...objectiveIds, o.id]);
                          } else {
                            setObjectiveIds(objectiveIds.filter((x) => x !== o.id));
                          }
                        }}
                        className="mt-0.5 h-4 w-4 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">{o.code}</Badge>
                          <span className="text-xs text-muted-foreground capitalize">{o.bloomLevel}</span>
                        </div>
                        <p className="mt-0.5 text-xs">{o.description}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Resumen de política */}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="font-semibold mb-1">Resumen de la política de evaluación:</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• Tipo: <span className="font-medium text-foreground">{assessmentTypes.find((a) => a.value === assessmentType)?.label}</span></li>
                <li>• Nivel Bloom: <span className="font-medium text-foreground capitalize">{bloomLevel}</span></li>
                <li>• Intentos: <span className="font-medium text-foreground">{maxAttempts === 0 ? "Ilimitados" : maxAttempts}</span></li>
                <li>• Umbral aprobación: <span className="font-medium text-foreground">{masteryThreshold}%</span></li>
                <li>• Peso: <span className="font-medium text-foreground">{weight}x</span>{timeLimitMin ? ` · Límite: ${timeLimitMin}min` : ""}</li>
                <li>• Objetivos vinculados: <span className="font-medium text-foreground">{objectiveIds.length}</span></li>
              </ul>
            </div>
          </TabsContent>

          {/* JSON */}
          <TabsContent value="json" className="space-y-2 mt-3">
            <Label className="text-xs font-semibold">Datos (JSON)</Label>
            <Textarea
              value={dataStr}
              onChange={(e) => setDataStr(e.target.value)}
              className="min-h-[300px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Estructura según tipo: MC=options/correctIndex, Guiado=steps/answer, Caso=case/questions, etc.
            </p>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex animate-fade-in items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary transition-colors hover:bg-primary/90">
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {saving ? "Guardando…" : initial ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ EDITORES POR TIPO ============

function MultipleChoiceEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const update = (patch: any) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-semibold">Pregunta</Label>
        <Textarea
          value={data.question || ""}
          onChange={(e) => update({ question: e.target.value })}
          className="mt-1 min-h-[60px]"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Opciones</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => update({ options: [...(data.options || []), "Nueva opción"] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar
          </Button>
        </div>
        <div className="mt-1 space-y-1.5">
          {(data.options || []).map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                checked={data.correctIndex === i}
                onChange={() => update({ correctIndex: i })}
                className="h-4 w-4 accent-primary"
                aria-label={`Marcar como correcta: ${opt}`}
              />
              <Input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...data.options];
                  newOpts[i] = e.target.value;
                  update({ options: newOpts });
                }}
                className="text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                onClick={() => {
                  const newOpts = data.options.filter((_: string, j: number) => j !== i);
                  const newCorrect = data.correctIndex >= newOpts.length ? 0 : data.correctIndex > i ? data.correctIndex - 1 : data.correctIndex;
                  update({ options: newOpts, correctIndex: newCorrect });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Marca el círculo para indicar la opción correcta.
        </p>
      </div>
      <div>
        <Label className="text-xs font-semibold">Explicación</Label>
        <Textarea
          value={data.explanation || ""}
          onChange={(e) => update({ explanation: e.target.value })}
          className="mt-1 min-h-[60px]"
        />
      </div>
      <HintsEditor hints={data.hints || []} onChange={(hints) => update({ hints })} />
    </div>
  );
}

function HintsEditor({ hints, onChange }: { hints: string[]; onChange: (h: string[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Pistas (máx. 2 visibles para el estudiante)</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange([...hints, ""])}
        >
          <Plus className="mr-1 h-3 w-3" /> Agregar pista
        </Button>
      </div>
      <div className="mt-1 space-y-1.5">
        {hints.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{i + 1}</Badge>
            <Input
              value={h}
              onChange={(e) => {
                const newHints = [...hints];
                newHints[i] = e.target.value;
                onChange(newHints);
              }}
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive"
              onClick={() => onChange(hints.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuidedProblemEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const update = (patch: any) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-semibold">Escenario</Label>
        <Textarea
          value={data.scenario || ""}
          onChange={(e) => update({ scenario: e.target.value })}
          className="mt-1 min-h-[60px]"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Pasos guiados</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => update({ steps: [...(data.steps || []), { prompt: "", answer: "", hint: "" }] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar paso
          </Button>
        </div>
        <div className="mt-1 space-y-2">
          {(data.steps || []).map((step: any, i: number) => (
            <div key={i} className="rounded-md border border-border p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Paso {i + 1}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => update({ steps: data.steps.filter((_: any, j: number) => j !== i) })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={step.prompt || ""}
                onChange={(e) => {
                  const newSteps = [...data.steps];
                  newSteps[i] = { ...step, prompt: e.target.value };
                  update({ steps: newSteps });
                }}
                placeholder="Pregunta del paso"
                className="text-sm"
              />
              <Input
                value={step.answer || ""}
                onChange={(e) => {
                  const newSteps = [...data.steps];
                  newSteps[i] = { ...step, answer: e.target.value };
                  update({ steps: newSteps });
                }}
                placeholder="Respuesta esperada"
                className="text-sm"
              />
              <Input
                value={step.hint || ""}
                onChange={(e) => {
                  const newSteps = [...data.steps];
                  newSteps[i] = { ...step, hint: e.target.value };
                  update({ steps: newSteps });
                }}
                placeholder="Pista (opcional)"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Respuesta final</Label>
        <Input
          value={data.finalAnswer || ""}
          onChange={(e) => update({ finalAnswer: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold">Explicación</Label>
        <Textarea
          value={data.explanation || ""}
          onChange={(e) => update({ explanation: e.target.value })}
          className="mt-1 min-h-[60px]"
        />
      </div>
    </div>
  );
}

function CaseAnalysisEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const update = (patch: any) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-semibold">Caso clínico / escenario</Label>
        <Textarea
          value={data.case || ""}
          onChange={(e) => update({ case: e.target.value })}
          className="mt-1 min-h-[100px]"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Preguntas del caso</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => update({ questions: [...(data.questions || []), { prompt: "", answer: "", explanation: "" }] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar pregunta
          </Button>
        </div>
        <div className="mt-1 space-y-2">
          {(data.questions || []).map((q: any, i: number) => (
            <div key={i} className="rounded-md border border-border p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Pregunta {i + 1}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => update({ questions: data.questions.filter((_: any, j: number) => j !== i) })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea
                value={q.prompt || ""}
                onChange={(e) => {
                  const newQs = [...data.questions];
                  newQs[i] = { ...q, prompt: e.target.value };
                  update({ questions: newQs });
                }}
                placeholder="Pregunta"
                className="text-sm min-h-[50px]"
              />
              <Input
                value={q.answer || ""}
                onChange={(e) => {
                  const newQs = [...data.questions];
                  newQs[i] = { ...q, answer: e.target.value };
                  update({ questions: newQs });
                }}
                placeholder="Respuesta esperada"
                className="text-sm"
              />
              <Input
                value={q.explanation || ""}
                onChange={(e) => {
                  const newQs = [...data.questions];
                  newQs[i] = { ...q, explanation: e.target.value };
                  update({ questions: newQs });
                }}
                placeholder="Explicación"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressiveExerciseEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const update = (patch: any) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Niveles (de menor a mayor dificultad)</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => update({ levels: [...(data.levels || []), { prompt: "", answer: "", explanation: "" }] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar nivel
          </Button>
        </div>
        <div className="mt-1 space-y-2">
          {(data.levels || []).map((lvl: any, i: number) => (
            <div key={i} className="rounded-md border border-border p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Nivel {i + 1}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => update({ levels: data.levels.filter((_: any, j: number) => j !== i) })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea
                value={lvl.prompt || ""}
                onChange={(e) => {
                  const newLvls = [...data.levels];
                  newLvls[i] = { ...lvl, prompt: e.target.value };
                  update({ levels: newLvls });
                }}
                placeholder="Enunciado del nivel"
                className="text-sm min-h-[50px]"
              />
              <Input
                value={lvl.answer || ""}
                onChange={(e) => {
                  const newLvls = [...data.levels];
                  newLvls[i] = { ...lvl, answer: e.target.value };
                  update({ levels: newLvls });
                }}
                placeholder="Respuesta esperada"
                className="text-sm"
              />
              <Input
                value={lvl.explanation || ""}
                onChange={(e) => {
                  const newLvls = [...data.levels];
                  newLvls[i] = { ...lvl, explanation: e.target.value };
                  update({ levels: newLvls });
                }}
                placeholder="Explicación"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelfAssessmentEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const update = (patch: any) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-semibold">Prompt de autoevaluación</Label>
        <Textarea
          value={data.prompt || ""}
          onChange={(e) => update({ prompt: e.target.value })}
          className="mt-1 min-h-[80px]"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Rúbrica (criterios)</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => update({ rubric: [...(data.rubric || []), "Nuevo criterio"] })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar
          </Button>
        </div>
        <div className="mt-1 space-y-1.5">
          {(data.rubric || []).map((r: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{i + 1}</Badge>
              <Input
                value={r}
                onChange={(e) => {
                  const newR = [...data.rubric];
                  newR[i] = e.target.value;
                  update({ rubric: newR });
                }}
                className="text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                onClick={() => update({ rubric: data.rubric.filter((_: string, j: number) => j !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Palabras clave para auto-calificación (separadas por coma)</Label>
        <Input
          value={(data.autoGradeKeywords || []).join(", ")}
          onChange={(e) => update({ autoGradeKeywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          className="mt-1"
          placeholder="ecg, einthoven, derivación"
        />
      </div>
    </div>
  );
}
