"use client";

/**
 * Pestaña "Evaluaciones" del Course Builder.
 *
 * Configura las dos evaluaciones globales del curso (singleton CourseConfig):
 * - Diagnóstico general: preguntas abiertas obligatorias al primer uso; sus
 *   respuestas alimentan la personalización por IA de cada unidad. Al guardar
 *   se borran las respuestas existentes (los estudiantes lo repiten).
 * - Prueba de cierre: examen de alternativas desbloqueado al completar todas
 *   las unidades, con puntaje mínimo e intentos máximos configurables.
 */

import * as React from "react";
import { useFetch, patchJSON, putJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Brain, GraduationCap, Plus, Save, Trash2 } from "lucide-react";

interface ExamQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

interface FinalExamConfig {
  questions: ExamQuestion[];
  passScore: number;
  maxAttempts: number;
}

export function EvaluationsTab() {
  return (
    <div className="space-y-6">
      <DiagnosticEditor />
      <FinalExamEditor />
    </div>
  );
}

// ============ Diagnóstico general ============

function DiagnosticEditor() {
  const { data, loading, refetch } = useFetch<{ questions: string[] }>(
    "/api/admin/course/diagnostic",
    []
  );
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loadedFor, setLoadedFor] = React.useState<string[] | null>(null);

  // Llenar el textarea al cargar (patrón "ajustar estado durante el render").
  const questions = data?.questions ?? null;
  if (questions !== null && questions !== loadedFor) {
    setLoadedFor(questions);
    setText(questions.join("\n"));
  }

  const handleSave = async () => {
    const list = text.split("\n").map((q) => q.trim()).filter((q) => q.length > 0);
    setSaving(true);
    try {
      await patchJSON("/api/admin/course/diagnostic", { questions: list });
      refetch();
      toast({
        title: "Diagnóstico actualizado",
        description: "Los estudiantes repetirán el diagnóstico con la nueva pauta.",
      });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="skeleton h-48 w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Diagnóstico general del curso</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Preguntas abiertas obligatorias para estudiantes al primer uso. Sus respuestas
          describen el perfil de cada estudiante y alimentan la personalización por IA
          de todas las unidades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-brand-gold/40 bg-accent/40 p-3 text-xs text-accent-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-brand-gold" />
            <p>
              Al guardar se <strong>borran todas las respuestas existentes</strong>: cada
              estudiante repetirá el diagnóstico la próxima vez que entre a la plataforma.
            </p>
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold">Preguntas (una por línea)</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"¿Qué experiencia previa tienes con equipos biomédicos?\n¿Cómo evalúas tu dominio de electrónica básica?\n¿Qué esperas aprender en este curso?"}
            className="mt-1 min-h-[140px]"
            disabled={saving}
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary transition-colors hover:bg-primary/90">
            <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar diagnóstico"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Prueba de cierre ============

function newQuestion(): ExamQuestion {
  return { question: "", options: ["", ""], correctIndex: 0 };
}

function FinalExamEditor() {
  const { data, loading, refetch } = useFetch<FinalExamConfig>(
    "/api/admin/course/final-exam",
    []
  );
  const { toast } = useToast();
  const [questions, setQuestions] = React.useState<ExamQuestion[]>([]);
  const [passScore, setPassScore] = React.useState(70);
  const [maxAttempts, setMaxAttempts] = React.useState(3);
  const [saving, setSaving] = React.useState(false);
  const [loadedFor, setLoadedFor] = React.useState<FinalExamConfig | null>(null);

  if (data !== null && data !== loadedFor) {
    setLoadedFor(data);
    setQuestions(data.questions);
    setPassScore(data.passScore);
    setMaxAttempts(data.maxAttempts);
  }

  const updateQuestion = (idx: number, patch: Partial<ExamQuestion>) => {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(
      questions.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) }
          : q
      )
    );
  };

  const handleSave = async () => {
    // Validación cliente básica (el backend aplica la validación completa).
    for (const q of questions) {
      if (!q.question.trim()) {
        toast({ title: "Error", description: "Todas las preguntas deben tener enunciado", variant: "destructive" });
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        toast({ title: "Error", description: "Las opciones no pueden estar vacías", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      await putJSON("/api/admin/course/final-exam", {
        questions: questions.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()),
          correctIndex: q.correctIndex,
        })),
        passScore,
        maxAttempts,
      });
      refetch();
      toast({ title: "Prueba de cierre actualizada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="skeleton h-48 w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Prueba de cierre</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Examen de alternativas que el estudiante desbloquea al completar todas las
          unidades. La corrección es automática (server-side): marca la opción correcta
          de cada pregunta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            Sin preguntas configuradas: la prueba de cierre estará deshabilitada para los estudiantes.
          </p>
        )}

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div className="flex items-start gap-2">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {qIdx + 1}
              </span>
              <Textarea
                value={q.question}
                onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
                placeholder="Enunciado de la pregunta"
                className="min-h-[50px] flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0 text-destructive"
                onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}
                aria-label={`Eliminar pregunta ${qIdx + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <RadioGroup
              value={String(q.correctIndex)}
              onValueChange={(val) => updateQuestion(qIdx, { correctIndex: Number(val) })}
              className="space-y-2 pl-8"
            >
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <RadioGroupItem value={String(oIdx)} id={`exam-q${qIdx}-o${oIdx}`} />
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                    placeholder={`Opción ${oIdx + 1}`}
                    className="h-8 flex-1 text-sm"
                  />
                  {q.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const newOptions = q.options.filter((_, j) => j !== oIdx);
                        updateQuestion(qIdx, {
                          options: newOptions,
                          correctIndex:
                            q.correctIndex === oIdx
                              ? 0
                              : q.correctIndex > oIdx
                                ? q.correctIndex - 1
                                : q.correctIndex,
                        });
                      }}
                      aria-label={`Eliminar opción ${oIdx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </RadioGroup>
            <div className="flex items-center justify-between pl-8">
              <p className="text-[11px] text-muted-foreground">
                El radio marca la opción correcta.
              </p>
              {q.options.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => updateQuestion(qIdx, { options: [...q.options, ""] })}
                >
                  <Plus className="mr-1 h-3 w-3" /> Opción
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setQuestions([...questions, newQuestion()])}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar pregunta
        </Button>

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <Label className="text-xs font-semibold">Puntaje mínimo de aprobación (%)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={passScore}
              onChange={(e) => setPassScore(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Intentos máximos</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary transition-colors hover:bg-primary/90">
            <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar prueba de cierre"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
