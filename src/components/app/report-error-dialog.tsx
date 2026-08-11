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
 * Diálogo compartido "Reportar error/problema". Dos orígenes:
 *
 * - source="content": contenido del curso (unidades y lecciones). Se usa con
 *   su trigger integrado (botón discreto junto al material).
 * - source="platform": problema general de la plataforma. Lo abre el FAB
 *   global (`global-report-fab.tsx`) en modo controlado (props open /
 *   onOpenChange), sin trigger propio.
 *
 * Envía POST /api/report con un sourceId con prefijo ("unit:<id>",
 * "lesson:<id>" o "page:<view>..." para plataforma) para que el docente
 * pueda ubicar lo reportado.
 *
 * La retroalimentación de actividades mantiene su propio diálogo (ligado al
 * estado del intento); este componente es autocontenido.
 */

const CONTENT_REASONS = [
  { value: "incorrect", label: "Información incorrecta o error factual" },
  { value: "offtopic", label: "Contenido confuso o fuera de lugar" },
  { value: "biased", label: "Contenido sesgado" },
  { value: "harmful", label: "Contenido inapropiado" },
  { value: "other", label: "Otro (tipografía, formato, enlace roto…)" },
] as const;

const PLATFORM_REASONS = [
  { value: "bug", label: "La página no funciona o no carga" },
  ...CONTENT_REASONS,
] as const;

interface ReportErrorDialogProps {
  /** Origen del reporte: contenido del curso o problema general de la plataforma. */
  source: "content" | "platform";
  /** Identificador del origen: "unit:<id>", "lesson:<id>" o "page:<view>..." */
  sourceId: string;
  /** Etiqueta humana del material (ej. "Unidad: Bioseñales"). Se muestra en el
   *  diálogo y se antepone al comentario para dar contexto al docente. */
  contextLabel?: string;
  /** Texto del botón disparador (por defecto "Reportar error"). */
  triggerLabel?: string;
  /** Modo controlado (sin trigger integrado): estado de apertura externo. */
  open?: boolean;
  /** Modo controlado: callback de cambio de apertura. */
  onOpenChange?: (open: boolean) => void;
}

export function ReportErrorDialog({
  source,
  sourceId,
  contextLabel,
  triggerLabel = "Reportar error",
  open: controlledOpen,
  onOpenChange,
}: ReportErrorDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isPlatform = source === "platform";
  const reasons = isPlatform ? PLATFORM_REASONS : CONTENT_REASONS;
  const [reason, setReason] = React.useState<string>(reasons[0].value);
  const [comment, setComment] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [reported, setReported] = React.useState(false);

  // Modo controlado (FAB global) vs. no controlado (trigger integrado)
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

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
        description: isPlatform
          ? "El equipo docente revisará el problema. ¡Gracias por avisar!"
          : "El equipo docente revisará este contenido. ¡Gracias por avisar!",
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
      {!isControlled && (
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
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            {isPlatform
              ? "Reportar un problema de la plataforma"
              : "Reportar error en el contenido"}
          </DialogTitle>
          <DialogDescription>
            Tu reporte será revisado por el equipo docente.
            {isPlatform
              ? " El reporte incluye automáticamente la vista donde te encontrabas."
              : contextLabel
                ? ` Estás reportando: ${contextLabel}.`
                : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Motivo del reporte
            </label>
            <div className="space-y-1.5">
              {reasons.map((r) => (
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
                    name={`report-reason-${source}`}
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
              placeholder={
                isPlatform
                  ? "Describe qué estabas haciendo y qué falló..."
                  : "Describe el error que encontraste (sección, frase, dato)..."
              }
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
