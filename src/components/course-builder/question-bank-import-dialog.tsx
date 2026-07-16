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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFetch, patchJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Check, FileText, ListChecks } from "lucide-react";

interface BankQuestion {
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

interface QuestionBankImportDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lessonId: string | null;
  courseId: string | null;
  authorId: string;
  onImported: () => void;
}

const typeLabels: Record<string, string> = {
  multiple_choice: "Selección múltiple",
  guided_problem: "Problema guiado",
  case_analysis: "Análisis de caso",
  progressive_exercise: "Ejercicio progresivo",
  self_assessment: "Autoevaluación",
};

const difficultyColors: Record<string, string> = {
  easy: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  hard: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function QuestionBankImportDialog({
  open,
  onOpenChange,
  lessonId,
  courseId,
  authorId,
  onImported,
}: QuestionBankImportDialogProps) {
  const { data, loading } = useFetch<{ questions: BankQuestion[] }>(
    authorId ? `/api/question-banks/questions?authorId=${authorId}` : null,
    [authorId]
  );
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [importing, setImporting] = React.useState<string | null>(null);
  const [imported, setImported] = React.useState<Set<string>>(new Set());

  const questions = data?.questions ?? [];
  const q = search.trim().toLowerCase();
  const filtered = questions.filter((qst) => {
    if (!q) return true;
    const hay = `${qst.title} ${qst.prompt} ${qst.tags || ""} ${qst.type}`.toLowerCase();
    return hay.includes(q);
  });

  const handleImport = async (questionId: string) => {
    if (!lessonId || !courseId) return;
    setImporting(questionId);
    try {
      await patchJSON(`/api/courses/${courseId}`, {
        action: "importQuestionToLesson",
        lessonId,
        questionId,
      });
      setImported((prev) => new Set(prev).add(questionId));
      toast({ title: "Pregunta importada", description: "Se agregó a la lección" });
      onImported();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  };

  // Reset imported state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setImported(new Set());
      setSearch("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar del banco de preguntas</DialogTitle>
          <DialogDescription>
            Selecciona preguntas existentes para agregarlas a esta lección. Se crea una copia, el banco original no se modifica.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, contenido, tag..."
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No hay preguntas en el banco</p>
            <p className="text-xs text-muted-foreground">
              Crea preguntas en la pestaña "Banco de Preguntas" para reutilizarlas aquí
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filtered.map((qst) => (
              <div
                key={qst.id}
                className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#003366]/5 text-[#003366]">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{qst.title}</p>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {typeLabels[qst.type] ?? qst.type}
                    </Badge>
                    <Badge variant="outline" className={`text-xs shrink-0 ${difficultyColors[qst.difficulty] ?? ""}`}>
                      {qst.difficulty}
                    </Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{qst.prompt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{qst.points} pts · {qst.tags || "sin tags"}</p>
                </div>
                <Button
                  variant={imported.has(qst.id) ? "secondary" : "default"}
                  size="sm"
                  className="shrink-0 h-8"
                  disabled={importing === qst.id || imported.has(qst.id)}
                  onClick={() => handleImport(qst.id)}
                >
                  {imported.has(qst.id) ? (
                    <><Check className="mr-1 h-3.5 w-3.5" /> Importada</>
                  ) : importing === qst.id ? (
                    "Importando..."
                  ) : (
                    <><Plus className="mr-1 h-3.5 w-3.5" /> Importar</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
