"use client";

import { motion } from "framer-motion";
import { PageHeader } from "@/components/app/page-header";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Target,
  BookOpen,
  Quote,
  Microscope,
  Clock,
  GraduationCap,
  FlaskConical,
  Building2,
  UserCheck,
  UserCog,
  Hash,
  CheckCircle2,
} from "lucide-react";

// ---------- Static content ----------

interface ProjectMeta {
  label: string;
  value: string;
  icon: typeof Building2;
}

const PROJECT_META: ProjectMeta[] = [
  {
    label: "Tipo",
    value: "Proyecto de Innovación en Docencia Universitaria",
    icon: FlaskConical,
  },
  {
    label: "Línea",
    value:
      "Integración de la Inteligencia Artificial en el proceso de enseñanza y aprendizaje",
    icon: Target,
  },
  {
    label: "Código",
    value: "UVA24991",
    icon: Hash,
  },
  {
    label: "Facultad",
    value: "Facultad de Ingeniería, Universidad de Valparaíso",
    icon: Building2,
  },
  {
    label: "Investigador principal",
    value: "Prof. Hermes Mora (Escuela de Ingeniería Civil Biomédica)",
    icon: UserCheck,
  },
  {
    label: "Investigador alterno",
    value: "Prof. David Ortiz",
    icon: UserCog,
  },
  {
    label: "Duración",
    value: "12 meses",
    icon: Clock,
  },
];

interface ModuleInfo {
  icon: string;
  title: string;
  description: string;
  gradient: string;
}

const MVP_MODULES: ModuleInfo[] = [
  {
    icon: "Users",
    title: "Módulo de acceso",
    description:
      "Registro y autenticación de estudiantes. Cada estudiante tiene un perfil con su progreso, puntos e insignias.",
    gradient: "from-sky-500 to-cyan-600",
  },
  {
    icon: "BookOpen",
    title: "Módulo temático",
    description:
      "Unidades acotadas al programa de Electromedicina II, organizadas en lecciones con contenido markdown estructurado.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: "Lightbulb",
    title: "Módulo de aprendizaje activo",
    description:
      "Actividades guiadas: resolución de problemas, análisis de casos y ejercicios progresivos con retroalimentación inmediata.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: "Brain",
    title: "Módulo de metacognición",
    description:
      "Retroalimentación automática sobre las respuestas y autoevaluación con rúbricas para promover la autorregulación.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: "MessageSquare",
    title: "Módulo tutor IA",
    description:
      "Asistente conversacional basado en IA generativa, con método socrático: guía sin entregar las respuestas.",
    gradient: "from-rose-500 to-pink-600",
  },
  {
    icon: "BarChart3",
    title: "Panel docente",
    description:
      "Seguimiento del aprendizaje con registro de interacciones, métricas por unidad y analytics agregados del curso.",
    gradient: "from-slate-500 to-slate-700",
  },
];

const PEDAGOGICAL_PRINCIPLES: string[] = [
  "Aprendizaje adaptativo basado en desempeño (no en estilos de aprendizaje rígidos).",
  "Retroalimentación formativa e inmediata que orienta la siguiente acción del estudiante.",
  "Aprendizaje activo y resolución asistida de problemas con casos reales del dominio.",
  "Autorregulación del aprendizaje: el estudiante monitorea y ajusta su propia comprensión.",
  "IA como herramienta complementaria, no como reemplazo del proceso docente.",
];

const ETHICS_POINTS: string[] = [
  "Participación voluntaria: el uso de la plataforma no afecta la evaluación formal del curso.",
  "Consentimiento informado explícito del estudiantado antes de participar.",
  "Datos anonimizados para los análisis de investigación del piloto.",
  "Supervisión docente activa de las respuestas generadas por la IA.",
  "Evaluación por el Comité de Ética de la Universidad de Valparaíso.",
  'Botón "Reportar error" disponible en cada interfaz para señalar contenidos o respuestas inadecuadas.',
];

// ---------- Main component ----------

export function AboutView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Acerca del piloto"
        icon="Info"
        iconGradient="from-emerald-500 to-teal-600"
        description="Plataforma web con IA generativa para apoyar el aprendizaje personalizado."
      />

      {/* ---------- Project card ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <Microscope className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base leading-tight">
                  Plataforma web con IA generativa para apoyar el aprendizaje
                  personalizado: piloto de innovación docente.
                </CardTitle>
                <CardDescription>
                  Ficha técnica del proyecto de innovación.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {PROJECT_META.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 border-b border-border/60 pb-3 last:border-b-0 sm:last:border-b-0"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="text-sm font-medium leading-snug">
                      {item.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </motion.div>

      {/* ---------- Objetivo general ---------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Objetivo general</CardTitle>
              <CardDescription>
                Qué busca lograr el piloto de innovación.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">
            Desarrollar una plataforma web piloto basada en Inteligencia
            Artificial generativa para apoyar el aprendizaje adaptativo y la
            comprensión conceptual en estudiantes de la asignatura de
            Electromedicina II, integrando retroalimentación formativa,
            actividades activas y un tutor conversacional con enfoque socrático
            como complemento al proceso docente tradicional.
          </p>
        </CardContent>
      </Card>

      {/* ---------- Módulos del MVP ---------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold">Módulos del MVP</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          La plataforma piloto se organiza en seis módulos funcionales
          interconectados.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MVP_MODULES.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
              whileHover={{ y: -3 }}
            >
              <Card className="h-full">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                        m.gradient
                      )}
                    >
                      <DynamicIcon name={m.icon} className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] tabular-nums">
                      {i + 1}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold leading-tight">
                    {m.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {m.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Enfoque pedagógico ---------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Enfoque pedagógico</CardTitle>
                <CardDescription>
                  Principios que orientan el diseño del piloto.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {PEDAGOGICAL_PRINCIPLES.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
                  <span className="text-sm leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ---------- Consideraciones éticas ---------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Consideraciones éticas
                </CardTitle>
                <CardDescription>
                  Resguardos del piloto con las y los estudiantes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {ETHICS_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400" />
                  <span className="text-sm leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Pregunta de investigación ---------- */}
      <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Quote className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Pregunta de investigación
            </span>
          </div>
          <Separator />
          <blockquote className="text-base italic leading-relaxed text-foreground/90 sm:text-lg">
            “¿En qué medida una plataforma web basada en IA generativa,
            implementada como apoyo complementario en la asignatura de
            Electromedicina II, favorece la comprensión conceptual y autonomía,
            la participación estudiantil y la percepción de utilidad en el
            proceso de aprendizaje en comparación con el método tradicional de
            enseñanza durante una experiencia piloto de innovación educativa?”
          </blockquote>
        </CardContent>
      </Card>
    </div>
  );
}
