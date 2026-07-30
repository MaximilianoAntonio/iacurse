"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { postJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Diálogo compartido "Reportar error" para el contenido del curso
 * (unidades y lecciones). Envía POST /api/report con source="content" y un
 * sourceId con prefijo ("unit:<id>" | "lesson:<id>") para que el docente
 * pueda ubicar el material reportado.
 *
 * La retroalimentación de actividades y el chat del tutor mantienen sus
 * propios diálogos (ligados al estado del intento); este componente es
 * autocontenido y se puede soltar en cualquier vista de contenido.
 */

const CONTENT_REASONS = [
  { value: "incorrect", label: "Información incorrecta o error factual" },
  { value: "offtopic", label: "Contenido confuso o fuera de lugar" },
  { value: "biased", label: "Contenido sesgado" },
  { value: "harmful", label: "Contenido inapropiado" },
  { value: "other", label: "Otro (tipografía, formato, enlace roto…)" },
] as const;

interface ReportErrorDialogProps {
  /** Origen del reporte (por ahora siempre "content" desde este componente). */
  source: "content";
  /** Identificador del material: "unit:<id>" o "lesson:<id>". */
  sourceId: string;
  /** Etiqueta humana del material (ej. "Unidad: Bioseñales"). Se muestra en el
   *  diálogo y se antepone al comentario para dar contexto al docente. */
  contextLabel?: string;
  /** Texto del botón disparador (por defecto "Reportar error"). */
  triggerLabel?: string;
}

export function ReportErrorDialog({
  source,
  sourceId,
  contextLabel,
  triggerLabel = "Reportar error",
}: ReportErrorDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("incorrect");
  const [comment, setComment] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [reported, setReported] = React.useState(false);

  const handleSubmit = async () => {
    setSending(true);
    try {
      const fullComment = contextLabel
        ? `[${contextLabel}]${comment.trim() ? `\n${comment.trim()}` : ""}`
        : comment.trim();
      await postJSON("/api/report", {
        source,
        sourceId,
        reason,
        comment: fullComment || undefined,
      });
      setReported(true);
      setOpen(false);
      setComment("");
      toast({
        title: "Reporte enviado",
        description: "El equipo docente revisará este contenido. ¡Gracias por avisar!",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al enviar el reporte";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
          title="Reportar un error en este contenido"
        >
          {reported ? (
            <span className="text-emerald-600 dark:text-emerald-400">Reportado</span>
          ) : (
            <>
              <Flag className="h-3 w-3" />
              <span className="hidden sm:inline">{triggerLabel}</span>
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Reportar error en el contenido
          </DialogTitle>
          <DialogDescription>
            Tu reporte será revisado por el equipo docente.
            {contextLabel ? ` Estás reportando: ${contextLabel}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Motivo del reporte
            </label>
            <div className="space-y-1.5">
              {CONTENT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                    reason === r.value
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="content-report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-3.5 w-3.5 accent-destructive"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Comentario (opcional)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe el error que encontraste (sección, frase, dato)..."
              className="min-h-[70px] resize-none text-sm"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={sending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {sending ? (
              <>
                <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Enviando...
              </>
            ) : (
              <>
                <Flag className="mr-1 h-3.5 w-3.5" />
                Enviar reporte
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
