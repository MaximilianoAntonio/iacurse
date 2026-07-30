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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Save, Loader2, FileEdit, Send, Trash2 } from "lucide-react";

export interface LessonFormData {
  id?: string;
  title: string;
  description: string;
  content: string;
  durationMin: number;
  isPublished?: boolean;
}

interface LessonEditorDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: LessonFormData | null;
  onSave: (data: LessonFormData) => Promise<void>;
  // false en contextos donde todo es borrador por diseño (cursos sandbox):
  // el pie muestra un único botón "Guardar" sin acciones de publicación.
  draftEnabled?: boolean;
}

// Borrador local del editor (localStorage): permite cerrar el diálogo y
// retomar la edición después sin haber guardado nada en el servidor.
interface LocalDraft {
  title: string;
  description: string;
  content: string;
  durationMin: number;
  updatedAt: string;
}

export function LessonEditorDialog({ open, onOpenChange, initial, onSave, draftEnabled = true }: LessonEditorDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [content, setContent] = React.useState("");
  const [durationMin, setDurationMin] = React.useState(15);
  const [saving, setSaving] = React.useState<"draft" | "publish" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [localDraft, setLocalDraft] = React.useState<LocalDraft | null>(null);

  const draftKey = `electromed_lesson_editor_draft_${initial?.id ?? "new"}`;

  // Al abrir: cargar valores iniciales y revisar si hay borrador local
  // (patrón "ajustar estado durante el render").
  const [prevOpenKey, setPrevOpenKey] = React.useState<{ open: boolean; initial: typeof initial }>({ open: false, initial: null });
  if (open !== prevOpenKey.open || initial !== prevOpenKey.initial) {
    setPrevOpenKey({ open, initial });
    if (open) {
      setError(null);
      setLocalDraft(null);
      const base: LocalDraft = {
        title: initial?.title ?? "",
        description: initial?.description ?? "",
        content: initial?.content ?? "",
        durationMin: initial?.durationMin ?? 15,
        updatedAt: "",
      };
      let restored: LocalDraft | null = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw) as LocalDraft;
          // Solo restaurar si difiere del contenido guardado en el servidor
          if (
            parsed.content !== base.content ||
            parsed.title !== base.title ||
            parsed.description !== base.description
          ) {
            restored = parsed;
          }
        }
      } catch {
        // borrador corrupto: se ignora
      }
      const source = restored ?? base;
      setTitle(source.title);
      setDescription(source.description);
      setContent(source.content);
      setDurationMin(source.durationMin);
      setLocalDraft(restored);
    }
  }

  // Autosave del borrador local mientras el diálogo está abierto
  React.useEffect(() => {
    if (!open) return;
    if (!title.trim() && !content.trim()) return; // no guardar formularios vacíos
    const draft: LocalDraft = {
      title,
      description,
      content,
      durationMin,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // localStorage lleno: no es crítico
    }
  }, [open, title, description, content, durationMin, draftKey]);

  const clearLocalDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // silencioso
    }
    setLocalDraft(null);
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setSaving(publish ? "publish" : "draft");
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        description: description.trim(),
        content,
        durationMin: Number(durationMin) || 15,
        isPublished: publish,
      });
      clearLocalDraft();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message || "Error al guardar");
    } finally {
      setSaving(null);
    }
  };

  const isDraftLesson = draftEnabled && initial ? initial.isPublished === false : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initial ? "Editar lección" : "Crear lección"}
            {isDraftLesson && (
              <Badge variant="outline" className="border-brand-gold/50 bg-brand-gold/10 text-amber-700 dark:text-brand-gold">
                Borrador — no visible para estudiantes
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Define el título, descripción y contenido Markdown de la lección. Puedes guardarla como borrador y publicarla cuando esté lista.
          </DialogDescription>
        </DialogHeader>

        {localDraft && (
          <div className="animate-fade-in flex items-center justify-between gap-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
            <span className="text-foreground">
              Borrador local recuperado
              {localDraft.updatedAt && ` · ${new Date(localDraft.updatedAt).toLocaleString("es-CL")}`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => {
                clearLocalDraft();
                setTitle(initial?.title ?? "");
                setDescription(initial?.description ?? "");
                setContent(initial?.content ?? "");
                setDurationMin(initial?.durationMin ?? 15);
              }}
            >
              <Trash2 className="h-3 w-3" /> Descartar y volver al guardado
            </Button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div>
              <Label className="text-xs font-semibold">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Triángulo de Einthoven y derivaciones"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Duración (min)</Label>
              <Input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="mt-1"
                min={1}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Descripción breve</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumen de 1 línea que verá el estudiante"
              className="mt-1"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <Label className="text-xs font-semibold">Contenido (Markdown)</Label>
            <div className="mt-2 min-h-0 flex-1">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                className="h-full"
                height="h-full min-h-[300px]"
                placeholder={"# Título de la lección\n\nEscribe aquí el contenido en Markdown...\n\n## Subtítulo\n\n- Punto 1\n- Punto 2\n\n> Cita destacada"}
              />
            </div>
            <p className="mt-1.5 shrink-0 text-xs text-muted-foreground">
              Usa la barra de herramientas para dar formato, subir imágenes y enlazar videos de YouTube/Vimeo (se embeben en la vista del estudiante). El borrador local se guarda solo mientras escribes.
            </p>
          </div>
        </div>

        {error && (
          <div className="animate-fade-in rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!draftEnabled ? (
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving !== null}
              className="bg-primary transition-colors hover:bg-primary/90"
            >
              {saving === "publish" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {saving === "publish" ? "Guardando…" : initial ? "Guardar" : "Crear"}
            </Button>
          ) : (
            <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={saving !== null}
              title="Guarda sin publicar: la lección no es visible para los estudiantes"
            >
              {saving === "draft" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileEdit className="mr-1.5 h-3.5 w-3.5" />
              )}
              {saving === "draft" ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving !== null}
              className="bg-primary transition-colors hover:bg-primary/90"
              title="Guarda y publica: visible para los estudiantes"
            >
              {saving === "publish" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : isDraftLesson || !initial ? (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {saving === "publish"
                ? "Publicando…"
                : isDraftLesson || !initial
                  ? "Publicar"
                  : "Guardar cambios"}
            </Button>
          </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
