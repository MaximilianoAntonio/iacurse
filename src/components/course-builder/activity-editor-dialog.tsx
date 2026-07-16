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
import { Save, Plus, Trash2, ListChecks, AlertCircle } from "lucide-react";

export interface ActivityFormData {
  id?: string;
  type: string;
  title: string;
  prompt: string;
  data: string;
  points: number;
  difficulty: string;
  tags?: string;
}

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
}

/**
 * Editor visual de actividad/pregunta.
 * Tiene tres pestañas:
 *  - "General": tipo, título, enunciado, puntos, dificultad, tags
 *  - "Contenido": editor visual según el tipo (options/steps/case/levels/rubric)
 *  - "JSON": editor directo del JSON para usuarios avanzados
 */
export function ActivityEditorDialog({ open, onOpenChange, initial, onSave }: ActivityEditorDialogProps) {
  const [type, setType] = React.useState("multiple_choice");
  const [title, setTitle] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [dataStr, setDataStr] = React.useState(defaultDataTemplates.multiple_choice);
  const [points, setPoints] = React.useState(10);
  const [difficulty, setDifficulty] = React.useState("medium");
  const [tags, setTags] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sincronizar el formulario cuando cambia `initial` o se abre
  React.useEffect(() => {
    if (open) {
      if (initial) {
        setType(initial.type);
        setTitle(initial.title);
        setPrompt(initial.prompt);
        setDataStr(initial.data);
        setPoints(initial.points);
        setDifficulty(initial.difficulty);
        setTags(initial.tags || "");
      } else {
        setType("multiple_choice");
        setTitle("");
        setPrompt("");
        setDataStr(defaultDataTemplates.multiple_choice);
        setPoints(10);
        setDifficulty("medium");
        setTags("");
      }
      setError(null);
    }
  }, [open, initial]);

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
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
            <TabsTrigger value="content" className="text-xs">Contenido</TabsTrigger>
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
          <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-2.5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#003366] hover:bg-[#004488]">
            <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Guardando..." : initial ? "Guardar" : "Crear"}
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
                className="h-4 w-4 accent-[#003366]"
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
                className="h-7 w-7 p-0 text-rose-600"
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
              className="h-7 w-7 p-0 text-rose-600"
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
                  className="h-6 w-6 p-0 text-rose-600"
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
                  className="h-6 w-6 p-0 text-rose-600"
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
                  className="h-6 w-6 p-0 text-rose-600"
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
                className="h-7 w-7 p-0 text-rose-600"
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
