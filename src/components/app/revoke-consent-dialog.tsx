"use client";

/**
 * Diálogo "Retiro de la autorización" del consentimiento informado.
 *
 * Reproduce el formulario electrónico de retiro (Universidad de Valparaíso,
 * versión 2026-08-V2): cuatro casillas checklist vacías que el estudiante
 * debe marcar manualmente, un botón "Retirar mi autorización" (deshabilitado
 * hasta marcarlas todas) y un botón "Cancelar" para mantener el
 * consentimiento. El retiro solo afecta el uso científico de los datos: la
 * plataforma sigue siendo parte de las actividades pedagógicas de la
 * asignatura y las calificaciones no se modifican.
 *
 * Se abre en modo controlado desde el menú de usuario del header (solo
 * estudiantes con autorización vigente y dentro del plazo de retiro).
 */

import * as React from "react";
import { Loader2, ShieldOff, XCircle } from "lucide-react";
import { postJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Casillas de confirmación individual del formulario de retiro. */
const REVOKE_CHECKS = [
  "Comprendo que al presionar 'Retirar mi autorización', mis datos académicos dejarán de ser utilizados para los fines científicos de esta investigación.",
  "Entiendo que retirar esta autorización no tendrá consecuencias académicas, no afectará mis calificaciones ni mi relación con la Universidad.",
  "Entiendo que continuaré utilizando la plataforma como parte de las actividades obligatorias de la asignatura.",
  "Entiendo que el retiro de la autorización solo afecta el uso científico de mis datos académicos y no mi participación en las actividades docentes.",
];

interface RevokeConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback tras un retiro exitoso (p. ej. refetch del estado del curso). */
  onRevoked: () => void;
}

export function RevokeConsentDialog({
  open,
  onOpenChange,
  onRevoked,
}: RevokeConsentDialogProps) {
  const { toast } = useToast();
  const [checks, setChecks] = React.useState<boolean[]>(
    REVOKE_CHECKS.map(() => false)
  );
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  // Al abrir el diálogo, las casillas parten siempre desmarcadas (patrón
  // "ajustar estado durante el render", como en use-fetch.ts).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setChecks(REVOKE_CHECKS.map(() => false));
      setError(null);
    }
  }

  const allChecked = checks.every(Boolean);

  const handleRevoke = async () => {
    if (!allChecked) return;
    setError(null);
    setSending(true);
    try {
      await postJSON("/api/course/consent/revoke", {});
      onOpenChange(false);
      onRevoked();
      toast({
        title: "Autorización retirada",
        description:
          "Sus datos académicos dejarán de utilizarse con fines científicos. Puede seguir usando la plataforma con normalidad.",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el retiro de la autorización."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
            Retiro de la autorización
          </DialogTitle>
          <DialogDescription>
            Usted autorizó previamente el uso científico de los datos académicos
            generados durante la utilización de la plataforma educativa. Si ahora
            desea retirar esa autorización, puede hacerlo libremente mediante
            este formulario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            El retiro de su autorización <strong>únicamente afecta el uso
            científico de sus datos</strong>. La utilización de la plataforma
            continuará formando parte de las actividades pedagógicas de la
            asignatura. Si decide retirar su autorización:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Continuará utilizando normalmente la plataforma.</li>
            <li>Continuará realizando las mismas actividades académicas.</li>
            <li>Continuará siendo evaluado con los mismos criterios.</li>
            <li>Sus calificaciones no se modificarán.</li>
            <li>No recibirá sanciones ni perjuicios académicos.</li>
          </ul>
          <p>
            Si el retiro se solicita antes de que los datos se hayan incorporado
            de forma irreversible a la base científica o a resultados agregados,
            el coinvestigador excluirá dichos datos del estudio cuando ello sea
            técnicamente posible.
          </p>

          <div className="space-y-2.5 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Antes de registrar su decisión
            </p>
            {REVOKE_CHECKS.map((text, idx) => (
              <label
                key={idx}
                className="flex cursor-pointer items-start gap-2.5"
              >
                <input
                  type="checkbox"
                  checked={checks[idx]}
                  onChange={(e) =>
                    setChecks((prev) =>
                      prev.map((c, i) => (i === idx ? e.target.checked : c))
                    )
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span>{text}</span>
              </label>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Registro electrónico: al presionar el botón &quot;Retirar mi
            autorización&quot;, la plataforma registrará electrónicamente esta
            solicitud utilizando el código con el que usted ingresó. El registro
            incluirá únicamente: la versión del formulario de retiro, la fecha y
            hora de la solicitud, y su código de estudiante.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive animate-fade-in"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevoke}
            disabled={sending || !allChecked}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando…
              </>
            ) : (
              "Retirar mi autorización"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
