"use client";

/**
 * Vista "Acerca del piloto" — página de lectura (modo Read).
 *
 * Versión destilada: una sola columna lineal, sin tarjetas anidadas ni
 * iconografía decorativa. La señal dorada aparece una vez (regla del mundo
 * "Instrumento de precisión").
 */

// ---------- Contenido estático ----------

const PROJECT_META: { label: string; value: string }[] = [
  {
    label: "Facultad",
    value: "Facultad de Ingeniería, Universidad de Valparaíso",
  },
  {
    label: "Investigación",
    value: "Prof. Hermes Mora (Civil Biomédica) · Prof. David Ortiz",
  },
  { label: "Duración", value: "12 meses" },
  { label: "Código", value: "UVA24991" },
];

const MVP_MODULES: { title: string; description: string }[] = [
  {
    title: "Acceso",
    description: "Registro y perfil con progreso, puntos e insignias.",
  },
  {
    title: "Contenido temático",
    description: "Unidades y lecciones del programa en formato markdown.",
  },
  {
    title: "Actividades guiadas",
    description:
      "Problemas, análisis de casos y ejercicios con retroalimentación inmediata.",
  },
  {
    title: "Aprendizaje adaptativo",
    description:
      "El contenido de cada unidad se ajusta a tu diagnóstico inicial.",
  },
  {
    title: "Panel docente",
    description: "Seguimiento del aprendizaje con telemetría y métricas del curso.",
  },
];

const PEDAGOGICAL_PRINCIPLES: string[] = [
  "Adaptación basada en el desempeño, no en estilos de aprendizaje rígidos.",
  "Retroalimentación formativa e inmediata que orienta el siguiente paso.",
  "Aprendizaje activo con casos reales del dominio.",
  "La IA complementa al docente, no lo reemplaza.",
];

const ETHICS_POINTS: string[] = [
  "Participación voluntaria: no afecta la evaluación formal del curso.",
  "Consentimiento informado del estudiantado antes de participar.",
  "Datos anonimizados para los análisis de investigación.",
  'Supervisión docente de las respuestas de la IA, con botón "Reportar error" en el contenido y las actividades.',
  "Evaluación por el Comité de Ética de la Universidad de Valparaíso.",
];

// Tratamiento de datos personales (Ley N°19.628, y N°21.719 desde dic-2026).
// Texto base referencial: el contenido definitivo debe validarse con el/la
// Delegado/a de Protección de Datos (DPO) de la Universidad.
const PRIVACY_POINTS: string[] = [
  "Finalidad: los datos se usan solo para operar la plataforma (progreso, personalización y retroalimentación) y para la investigación del piloto.",
  "Minimización: los estudiantes se identifican con un código anonimizado; no se solicitan nombres ni correos reales dentro de la plataforma.",
  "Se registran datos de uso (accesos, tiempo de interacción y eventos de navegación) para el seguimiento docente y la investigación.",
  "Las respuestas que escribes pueden ser procesadas por servicios externos de inteligencia artificial (OpenAI/Gemini) para generar retroalimentación y personalizar el contenido; no incluyas datos personales en ellas.",
  "Tus derechos: puedes solicitar acceso, rectificación, cancelación u oposición sobre tus datos. Puedes exportar tus datos desde la plataforma (GET /api/me/data) o canalizar solicitudes a través del docente del curso.",
  "Ante incidentes que afecten datos personales se informará conforme a la normativa vigente.",
];

// ---------- Componente principal ----------

export function AboutView() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 p-4 lg:p-8">
      {/* ---------- Encabezado ---------- */}
      <header className="space-y-4">
        <div className="h-1 w-12 rounded-full bg-brand-gold" />
        <h1 className="font-display text-display font-bold">Acerca del piloto</h1>
        <p className="max-w-[65ch] text-base leading-relaxed text-muted-foreground">
          Plataforma web con IA generativa para el aprendizaje personalizado en
          Electromedicina II. Un piloto de innovación docente de la Universidad
          de Valparaíso.
        </p>
      </header>

      {/* ---------- Ficha técnica ---------- */}
      <section className="space-y-4">
        <h2 className="font-display text-title font-semibold">Ficha técnica</h2>
        <dl className="border-t border-border">
          {PROJECT_META.map((item) => (
            <div
              key={item.label}
              className="grid gap-1 border-b border-border py-3 sm:grid-cols-3 sm:gap-4"
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {item.label}
              </dt>
              <dd className="text-sm font-medium leading-snug sm:col-span-2">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- Qué incluye ---------- */}
      <section className="space-y-4">
        <h2 className="font-display text-title font-semibold">Qué incluye</h2>
        <ul className="stagger-children border-t border-border">
          {MVP_MODULES.map((m) => (
            <li key={m.title} className="border-b border-border py-3">
              <span className="text-sm font-semibold">{m.title}</span>
              <span className="text-sm text-muted-foreground"> — {m.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Enfoque y ética ---------- */}
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Enfoque pedagógico</h2>
          <ul className="stagger-children space-y-3 border-t border-border pt-4">
            {PEDAGOGICAL_PRINCIPLES.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                <span className="text-sm leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Consideraciones éticas</h2>
          <ul className="stagger-children space-y-3 border-t border-border pt-4">
            {ETHICS_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-sm leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- Pregunta de investigación ---------- */}
      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Pregunta de investigación
        </h2>
        <blockquote className="max-w-[70ch] text-base italic leading-relaxed text-foreground/90 sm:text-lg">
          “¿En qué medida una plataforma web basada en IA generativa,
          implementada como apoyo complementario en la asignatura de
          Electromedicina II, favorece la comprensión conceptual y autonomía,
          la participación estudiantil y la percepción de utilidad en el
          proceso de aprendizaje en comparación con el método tradicional de
          enseñanza durante una experiencia piloto de innovación educativa?”
        </blockquote>
      </section>

      {/* ---------- Privacidad y protección de datos ---------- */}
      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="font-display text-title font-semibold">
          Privacidad y protección de datos
        </h2>
        <ul className="stagger-children space-y-3">
          {PRIVACY_POINTS.map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-sm leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
