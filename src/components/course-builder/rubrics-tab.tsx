"use client";

import * as React from "react";
import { useFetch, postJSON, patchJSON, deleteURL } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Award, Plus, Trash2, Edit2, Save, GripVertical } from "lucide-react";

interface Rubric {
  id: string;
  name: string;
  description: string | null;
  criteria: string;
  activityCount: number;
}

interface Criterion {
  name: string;
  weight: number;
  levels: { score: number; label: string; description: string }[];
}

const defaultCriteria: Criterion[] = [
  {
    name: "Comprensión del concepto",
    weight: 1,
    levels: [
      { score: 0, label: "Insuficiente", description: "No demuestra comprensión del concepto" },
      { score: 1, label: "En desarrollo", description: "Comprende parcialmente, con errores clave" },
      { score: 2, label: "Logrado", description: "Comprende el concepto correctamente" },
      { score: 3, label: "Destacado", description: "Comprende y contextualiza con ejemplos" },
    ],
  },
  {
    name: "Aplicación práctica",
    weight: 1,
    levels: [
      { score: 0, label: "Insuficiente", description: "No aplica el concepto al caso" },
      { score: 1, label: "En desarrollo", description: "Aplicación parcial o con errores" },
      { score: 2, label: "Logrado", description: "Aplica correctamente al caso" },
      { score: 3, label: "Destacado", description: "Aplica y justifica con criterio clínico" },
    ],
  },
];

export function RubricsTab({ authorId }: { authorId: string }) {
  const { data, loading, refetch } = useFetch<{ rubrics: Rubric[] }>(
    authorId ? `/api/admin/rubrics?authorId=${authorId}` : null,
    [authorId]
  );
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editR, setEditR] = React.useState<Rubric | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [criteria, setCriteria] = React.useState<Criterion[]>(defaultCriteria);

  const rubrics = data?.rubrics ?? [];

  const openCreate = () => {
    setEditR(null);
    setName("");
    setDescription("");
    setCriteria(defaultCriteria);
    setCreateOpen(true);
  };

  const openEdit = (r: Rubric) => {
    setEditR(r);
    setName(r.name);
    setDescription(r.description || "");
    try {
      const parsed = JSON.parse(r.criteria) as Criterion[];
      setCriteria(parsed.length > 0 ? parsed : defaultCriteria);
    } catch {
      setCriteria(defaultCriteria);
    }
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    try {
      const criteriaStr = JSON.stringify(criteria);
      if (editR) {
        await patchJSON("/api/admin/rubrics", {
          rubricId: editR.id,
          name,
          description,
          criteria: criteriaStr,
        });
        toast({ title: "Rúbrica actualizada" });
      } else {
        await postJSON("/api/admin/rubrics", {
          authorId,
          name,
          description,
          criteria: criteriaStr,
        });
        toast({ title: "Rúbrica creada" });
      }
      setCreateOpen(false);
      refetch();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (rubricId: string) => {
    if (!confirm("¿Eliminar esta rúbrica?")) return;
    try {
      await deleteURL(`/api/admin/rubrics?rubricId=${rubricId}`);
      refetch();
      toast({ title: "Rúbrica eliminada" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const updateCriterion = (idx: number, patch: Partial<Criterion>) => {
    const next = [...criteria];
    next[idx] = { ...next[idx], ...patch };
    setCriteria(next);
  };

  const addCriterion = () => {
    setCriteria([...criteria, {
      name: "Nuevo criterio",
      weight: 1,
      levels: [
        { score: 0, label: "Insuficiente", description: "" },
        { score: 1, label: "Logrado", description: "" },
      ],
    }]);
  };

  const removeCriterion = (idx: number) => {
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const updateLevel = (cIdx: number, lIdx: number, patch: Partial<Criterion["levels"][0]>) => {
    const next = [...criteria];
    next[cIdx] = {
      ...next[cIdx],
      levels: next[cIdx].levels.map((l, i) => i === lIdx ? { ...l, ...patch } : l),
    };
    setCriteria(next);
  };

  const addLevel = (cIdx: number) => {
    const next = [...criteria];
    const maxScore = Math.max(...next[cIdx].levels.map((l) => l.score), 0);
    next[cIdx] = {
      ...next[cIdx],
      levels: [...next[cIdx].levels, { score: maxScore + 1, label: "Nuevo nivel", description: "" }],
    };
    setCriteria(next);
  };

  const removeLevel = (cIdx: number, lIdx: number) => {
    const next = [...criteria];
    next[cIdx] = {
      ...next[cIdx],
      levels: next[cIdx].levels.filter((_, i) => i !== lIdx),
    };
    setCriteria(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Rúbricas de evaluación</h3>
          <p className="text-xs text-muted-foreground">
            {rubrics.length} rúbrica{rubrics.length !== 1 ? "s" : ""} · Para evaluar respuestas abiertas con criterios pedagógicos
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-primary hover:bg-primary">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva Rúbrica
        </Button>
      </div>

      <div className="rounded-md border border-primary/20 bg-primary/[0.02] p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-primary">
          <Award className="h-3.5 w-3.5" /> ¿Para qué sirven las rúbricas?
        </p>
        <p className="mt-1">
          Las rúbricas permiten evaluar respuestas abiertas (casos clínicos, autoevaluaciones) con criterios
          múltiples y niveles de desempeño. El tutor IA las usa para dar retroalimentación más precisa.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : rubrics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Sin rúbricas</p>
            <p className="text-xs text-muted-foreground">Crea una rúbrica para evaluar respuestas abiertas con criterios</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rubrics.map((r) => {
            let critCount = 0;
            try {
              critCount = (JSON.parse(r.criteria) as unknown[]).length;
            } catch {
              // ignorar
            }
            return (
              <Card key={r.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 text-white">
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold">{r.name}</h3>
                      <Badge variant="outline" className="text-xs">{critCount} criterios</Badge>
                      {r.activityCount > 0 && (
                        <Badge variant="secondary" className="text-xs">{r.activityCount} actividades</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {r.description || "Sin descripción"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(r)} aria-label="Editar rúbrica">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600" onClick={() => handleDelete(r.id)} aria-label="Eliminar rúbrica">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog crear/editar rúbrica */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditR(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-gold" />
              {editR ? "Editar rúbrica" : "Nueva rúbrica de evaluación"}
            </DialogTitle>
            <DialogDescription>
              Define criterios múltiples con niveles de desempeño. El tutor IA los usará para retroalimentar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Rúbrica para análisis de caso ECG" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Descripción (opcional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cuándo usar esta rúbrica" className="mt-1" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">Criterios de evaluación</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCriterion}>
                  <Plus className="mr-1 h-3 w-3" /> Agregar criterio
                </Button>
              </div>
              <div className="space-y-3">
                {criteria.map((c, ci) => (
                  <div key={ci} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        value={c.name}
                        onChange={(e) => updateCriterion(ci, { name: e.target.value })}
                        className="text-sm font-medium"
                        placeholder="Nombre del criterio"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <Label className="text-xs text-muted-foreground">Peso:</Label>
                        <Input
                          type="number"
                          min={1}
                          value={c.weight}
                          onChange={(e) => updateCriterion(ci, { weight: Number(e.target.value) })}
                          className="w-16 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-rose-600 shrink-0"
                        onClick={() => removeCriterion(ci)}
                        aria-label="Eliminar criterio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1.5 pl-6">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Niveles de desempeño</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addLevel(ci)}>
                          <Plus className="mr-1 h-3 w-3" /> Nivel
                        </Button>
                      </div>
                      {c.levels.map((lvl, li) => (
                        <div key={li} className="grid grid-cols-[60px_100px_1fr_28px] gap-1.5 items-center">
                          <Input
                            type="number"
                            value={lvl.score}
                            onChange={(e) => updateLevel(ci, li, { score: Number(e.target.value) })}
                            className="text-xs h-8"
                            title="Puntaje"
                          />
                          <Input
                            value={lvl.label}
                            onChange={(e) => updateLevel(ci, li, { label: e.target.value })}
                            className="text-xs h-8"
                            placeholder="Etiqueta"
                          />
                          <Input
                            value={lvl.description}
                            onChange={(e) => updateLevel(ci, li, { description: e.target.value })}
                            className="text-xs h-8"
                            placeholder="Descripción del nivel"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-600"
                            onClick={() => removeLevel(ci, li)}
                            aria-label="Eliminar nivel"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold mb-1.5">Vista previa de la rúbrica:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-border p-1.5 text-left bg-background">Criterio</th>
                      {criteria[0]?.levels.map((lvl, i) => (
                        <th key={i} className="border border-border p-1.5 text-center bg-background">
                          {lvl.label}<br /><span className="text-muted-foreground">{lvl.score}pt</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((c, ci) => (
                      <tr key={ci}>
                        <td className="border border-border p-1.5 font-medium bg-background">{c.name} <span className="text-muted-foreground">({c.weight}x)</span></td>
                        {c.levels.map((lvl, li) => (
                          <td key={li} className="border border-border p-1.5 text-muted-foreground align-top">{lvl.description}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); setEditR(null); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} className="bg-primary hover:bg-primary">
              <Save className="mr-1.5 h-3.5 w-3.5" /> {editR ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
