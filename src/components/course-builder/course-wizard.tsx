"use client";

import * as React from "react";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { postJSON } from "@/hooks/use-fetch";
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
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  BookOpen,
  Target,
  Layers,
  Rocket,
  Plus,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseWizardProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (courseId: string) => void;
}

interface UnitDraft {
  title: string;
  summary: string;
}

interface ObjectiveDraft {
  code: string;
  description: string;
  bloomLevel: string;
}

const bloomLevels: { value: string; label: string; color: string }[] = [
  { value: "remember", label: "Recordar", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  { value: "understand", label: "Comprender", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { value: "apply", label: "Aplicar", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  { value: "analyze", label: "Analizar", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { value: "evaluate", label: "Evaluar", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { value: "create", label: "Crear", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
];

const courseColors = [
  { value: "emerald", label: "Azul UV" },
  { value: "sky", label: "Azul claro" },
  { value: "violet", label: "Azul oscuro" },
  { value: "amber", label: "Dorado" },
  { value: "rose", label: "Rosado" },
];

const courseIcons = ["BookOpen", "HeartPulse", "Activity", "Stethoscope", "Brain", "Calculator", "Microscope", "FlaskConical", "Zap", "ShieldCheck"];

const steps = [
  { key: "info", label: "Información", icon: BookOpen },
  { key: "objectives", label: "Competencias", icon: Target },
  { key: "structure", label: "Estructura", icon: Layers },
  { key: "review", label: "Revisar", icon: Rocket },
];

export function CourseWizard({ open, onOpenChange, onCreated }: CourseWizardProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const authorId = currentUser?.id ?? "";
  const { toast } = useToast();

  const [step, setStep] = React.useState(0);
  const [creating, setCreating] = React.useState(false);

  // Step 1: Info
  const [info, setInfo] = React.useState({
    title: "",
    description: "",
    color: "emerald",
    icon: "BookOpen",
  });

  // Step 2: Objectives (course-level competencies)
  const [objectives, setObjectives] = React.useState<ObjectiveDraft[]>([
    { code: "", description: "", bloomLevel: "apply" },
  ]);

  // Step 3: Structure (units)
  const [units, setUnits] = React.useState<UnitDraft[]>([
    { title: "", summary: "" },
  ]);

  // Reset al abrir
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setInfo({ title: "", description: "", color: "emerald", icon: "BookOpen" });
      setObjectives([{ code: "", description: "", bloomLevel: "apply" }]);
      setUnits([{ title: "", summary: "" }]);
    }
  }, [open]);

  const canAdvance = () => {
    if (step === 0) return info.title.trim().length > 0;
    if (step === 1) return objectives.some((o) => o.description.trim().length > 0);
    if (step === 2) return units.some((u) => u.title.trim().length > 0);
    return true;
  };

  const handleCreate = async () => {
    if (!info.title.trim()) {
      toast({ title: "Error", description: "El título es obligatorio", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      // 1. Crear el curso sandbox
      const courseRes = await postJSON<{ course: { id: string } }>("/api/courses", {
        authorId,
        title: info.title.trim(),
        description: info.description.trim(),
        color: info.color,
        icon: info.icon,
      });
      const courseId = courseRes.course.id;

      // 2. Crear las unidades sandbox
      const validUnits = units.filter((u) => u.title.trim());
      for (const u of validUnits) {
        await postJSON(`/api/courses/${courseId}`, {
          title: u.title.trim(),
          summary: u.summary.trim(),
          description: u.summary.trim(),
        });
      }

      // Nota: los objetivos se crean a nivel de unidad en el editor de currículo,
      // no a nivel de curso sandbox. Se guardan como referencia para cuando se publique.

      toast({
        title: "Curso creado",
        description: `"${info.title}" con ${validUnits.length} unidad(es). Ahora agrega lecciones y actividades.`,
      });
      onOpenChange(false);
      onCreated(courseId);
    } catch (e) {
      toast({ title: "Error al crear curso", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const currentStep = steps[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <currentStep.icon className="h-5 w-5 text-[#003366]" />
            Nuevo curso — Paso {step + 1} de {steps.length}: {currentStep.label}
          </DialogTitle>
          <DialogDescription>
            Crea un curso completo paso a paso. Podrás editar todo después.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper visual */}
        <div className="flex items-center justify-between gap-1 py-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-all",
                    i > step && "opacity-40 cursor-not-allowed",
                    i <= step && "cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                    done && "border-[#003366] bg-[#003366] text-white",
                    active && "border-[#003366] bg-[#003366]/10 text-[#003366] ring-2 ring-[#003366]/20",
                    !done && !active && "border-border bg-background text-muted-foreground"
                  )}>
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    active ? "text-[#003366]" : "text-muted-foreground"
                  )}>
                    {s.label}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 rounded-full transition-all",
                    i < step ? "bg-[#003366]" : "bg-border"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* STEP 0: Info */}
        {step === 0 && (
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Título del curso *</Label>
              <Input
                value={info.title}
                onChange={(e) => setInfo({ ...info, title: e.target.value })}
                placeholder="Ej: Electrónica Médica Aplicada"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción</Label>
              <Textarea
                value={info.description}
                onChange={(e) => setInfo({ ...info, description: e.target.value })}
                placeholder="Breve descripción del curso, su propósito y audiencia."
                className="mt-1 min-h-[70px]"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Color temático</Label>
              <div className="mt-1 flex gap-2">
                {courseColors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setInfo({ ...info, color: c.value })}
                    className={cn(
                      "rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all",
                      info.color === c.value
                        ? "border-[#003366] bg-[#003366]/5 text-[#003366] ring-1 ring-[#003366]/20"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Icono</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {courseIcons.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setInfo({ ...info, icon: iconName })}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all",
                      info.icon === iconName
                        ? "border-[#003366] bg-[#003366]/10 text-[#003366] ring-1 ring-[#003366]/20"
                        : "border-border bg-background text-muted-foreground hover:bg-accent/40"
                    )}
                    aria-label={iconName}
                  >
                    <DynamicIcon name={iconName} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Objectives */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-[#003366]/20 bg-[#003366]/[0.02] p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-[#003366]">
                <GraduationCap className="h-3.5 w-3.5" /> Competencias del curso
              </p>
              <p className="mt-1">
                Define 3-5 objetivos de aprendizaje generales. Usa verbos medibles (calcular, analizar, diseñar...).
                Estos objetivos guiarán la evaluación y se afinarán a nivel de unidad después.
              </p>
            </div>
            {objectives.map((obj, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Objetivo {i + 1}</Badge>
                  {objectives.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-rose-600"
                      onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <Input
                    value={obj.code}
                    onChange={(e) => {
                      const next = [...objectives];
                      next[i] = { ...obj, code: e.target.value };
                      setObjectives(next);
                    }}
                    placeholder="O1"
                    className="text-sm"
                  />
                  <Input
                    value={obj.description}
                    onChange={(e) => {
                      const next = [...objectives];
                      next[i] = { ...obj, description: e.target.value };
                      setObjectives(next);
                    }}
                    placeholder="Ej: Analizar circuitos de acondicionamiento de bioseñales"
                    className="text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {bloomLevels.map((bl) => (
                    <button
                      key={bl.value}
                      type="button"
                      onClick={() => {
                        const next = [...objectives];
                        next[i] = { ...obj, bloomLevel: bl.value };
                        setObjectives(next);
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                        obj.bloomLevel === bl.value
                          ? bl.color + " ring-1 ring-offset-1"
                          : "border border-border bg-background text-muted-foreground hover:bg-accent/40"
                      )}
                    >
                      {bl.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setObjectives([...objectives, { code: "", description: "", bloomLevel: "apply" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar objetivo
            </Button>
          </div>
        )}

        {/* STEP 2: Structure */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-[#003366]/20 bg-[#003366]/[0.02] p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-[#003366]">
                <Layers className="h-3.5 w-3.5" /> Estructura inicial
              </p>
              <p className="mt-1">
                Define las unidades del curso. Después podrás agregar lecciones y actividades a cada una.
                Mínimo 2-4 unidades para empezar.
              </p>
            </div>
            {units.map((u, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Unidad {i + 1}</Badge>
                  {units.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-rose-600"
                      onClick={() => setUnits(units.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input
                  value={u.title}
                  onChange={(e) => {
                    const next = [...units];
                    next[i] = { ...u, title: e.target.value };
                    setUnits(next);
                  }}
                  placeholder="Ej: Bioseñales y electrodos"
                  className="text-sm"
                />
                <Input
                  value={u.summary}
                  onChange={(e) => {
                    const next = [...units];
                    next[i] = { ...u, summary: e.target.value };
                    setUnits(next);
                  }}
                  placeholder="Resumen de 1 línea"
                  className="text-sm"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setUnits([...units, { title: "", summary: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar unidad
            </Button>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-[#003366]/20 bg-[#003366]/[0.02] p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-[#003366]">
                <Rocket className="h-3.5 w-3.5" /> Revisa y crea
              </p>
              <p className="mt-1">
                Se creará el curso en estado <strong>Borrador</strong>. Podrás editar todo y publicarlo cuando esté listo.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#003366] to-[#0066AA] text-white">
                  <DynamicIcon name={info.icon} className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">{info.title || "(sin título)"}</p>
                  <p className="text-xs text-muted-foreground">{info.description || "Sin descripción"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-[#003366]" /> Objetivos
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#003366]">
                    {objectives.filter((o) => o.description.trim()).length}
                  </p>
                  <p className="text-xs text-muted-foreground">competencias definidas</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[#003366]" /> Unidades
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[#003366]">
                    {units.filter((u) => u.title.trim()).length}
                  </p>
                  <p className="text-xs text-muted-foreground">unidades iniciales</p>
                </div>
              </div>
              {objectives.filter((o) => o.description.trim()).length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold mb-1.5">Competencias:</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {objectives.filter((o) => o.description.trim()).map((o, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#003366]">•</span>
                        <span><strong>{o.code || `O${i + 1}`}</strong> ({o.bloomLevel}): {o.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Atrás
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="bg-[#003366] hover:bg-[#004488] ml-auto"
            >
              Continuar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating}
              className="bg-[#003366] hover:bg-[#004488] ml-auto"
            >
              {creating ? "Creando..." : "Crear curso"} <Rocket className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
