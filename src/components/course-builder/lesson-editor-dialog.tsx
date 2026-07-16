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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownPreview } from "./markdown-preview";
import { Save, Eye, Code } from "lucide-react";

export interface LessonFormData {
  id?: string;
  title: string;
  description: string;
  content: string;
  durationMin: number;
}

interface LessonEditorDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: LessonFormData | null;
  onSave: (data: LessonFormData) => Promise<void>;
}

const markdownHelp = `# Markdown soportado

- Encabezados: \`# H1\`, \`## H2\`, \`### H3\`...
- **Negrita** con \`**texto**\`
- *Cursiva* con \`*texto*\`
- Listas: \`- item\` o \`1. item\`
- Código en línea: \\\`código\\\`
- Bloques de código: \\\`\\\`\\\`
  código
\\\`\\\`
- Citas: \`> cita\`
- Enlaces: \`[texto](url)\`
- Tablas: \`| col1 | col2 |\`
- Separador: \`---\`
`;

export function LessonEditorDialog({ open, onOpenChange, initial, onSave }: LessonEditorDialogProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [content, setContent] = React.useState("");
  const [durationMin, setDurationMin] = React.useState(15);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      if (initial) {
        setTitle(initial.title);
        setDescription(initial.description);
        setContent(initial.content);
        setDurationMin(initial.durationMin);
      } else {
        setTitle("");
        setDescription("");
        setContent("");
        setDurationMin(15);
      }
      setError(null);
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        description: description.trim(),
        content,
        durationMin: Number(durationMin) || 15,
      });
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar lección" : "Crear lección"}</DialogTitle>
          <DialogDescription>
            Define el título, descripción y contenido Markdown de la lección.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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

          <Tabs defaultValue="write" className="w-full">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Contenido (Markdown)</Label>
              <TabsList className="h-8">
                <TabsTrigger value="write" className="text-xs gap-1.5"><Code className="h-3 w-3" /> Editor</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs gap-1.5"><Eye className="h-3 w-3" /> Vista previa</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="write" className="mt-2">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder={`# Título de la lección\n\nEscribe aquí el contenido en Markdown...\n\n## Subtítulo\n\n- Punto 1\n- Punto 2\n\n> Cita destacada\n\n\`\`\`\nbloque de código\n\`\`\``}
              />
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Ver ayuda de Markdown
                </summary>
                <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">{markdownHelp}</pre>
              </details>
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="rounded-md border border-border bg-background p-4 min-h-[300px] overflow-y-auto max-h-[500px]">
                <MarkdownPreview content={content} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-2.5 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
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
