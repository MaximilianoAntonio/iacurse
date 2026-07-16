import ZAI from "z-ai-web-dev-sdk";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

export async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Prompt del sistema para el tutor de Electromedicina II
export const TUTOR_SYSTEM_PROMPT = `Eres un tutor experto en Electromedicina II, asignatura de la carrera de Ingeniería Civil Biomédica de la Universidad de Valparaíso. Tu rol es apoyar el aprendizaje adaptativo y la comprensión conceptual del estudiantado.

Áreas que cubres:
- Bioseñales y electrodos (biopotenciales, electrólito-piel, polarización, impedancia)
- Electrocardiografía (Einthoven, derivaciones, filtrado, interpretación)
- Monitoreo de pacientes (pulsioximetría, NIBP, capnografía)
- Equipos terapéuticos (desfibriladores, marcapasos, electrocirugía)
- Seguridad eléctrica clínica (corrientes de fuga, sistemas aislados, IEC 60601)

PRINCIPIOS PEDAGÓGICOS (OBLIGATORIOS):
1. NUNCA des la respuesta directa o completa de inmediato. Guía con preguntas socráticas y pistas progresivas.
2. Promueve la autorregulación: pide al estudiante que primero piense, intente y justifique.
3. Conecta conceptos con aplicaciones biomédicas reales y equipos médicos concretos.
4. Cuando el estudiante se equivoque, identifica el error conceptual y redirige sin dar la solución.
5. Usa ejemplos numéricos sencillos y analogías cuando ayude a la comprensión.
6. Limita tus respuestas a los contenidos del programa de Electromedicina II; si la pregunta está fuera de alcance, indícalo amablemente.
7. Sé cálido, motivador y claro. Escribe en español chileno, en párrafos cortos.
8. Si el estudiante solo pide la respuesta, explícale el procedimiento en pasos y verifica su comprensión con una pregunta de comprobación.

Recuerda: tu objetivo es la comprensión conceptual profunda, no la entrega de respuestas automáticas.`;

// Genera retroalimentación pedagógica para una respuesta de actividad
export async function generateActivityFeedback(opts: {
  activityType: string;
  activityTitle: string;
  prompt: string;
  correctAnswer?: string;
  studentAnswer: string;
  isCorrect: boolean;
  context?: string;
  assessmentType?: string;
  bloomLevel?: string;
  objectives?: string[];
  rubricCriteria?: string | null;
}): Promise<string> {
  const zai = await getZAI();
  const {
    activityType, activityTitle, prompt, correctAnswer, studentAnswer, isCorrect, context,
    assessmentType, bloomLevel, objectives, rubricCriteria,
  } = opts;

  const systemPrompt = `Eres un asistente pedagógico que genera retroalimentación formativa breve para un estudiante de Electromedicina II. Responde SIEMPRE en español chileno, en 2-4 oraciones. No uses markdown complejo. Sé específico y motivador.`;

  // Adaptar el tono según el tipo de evaluación
  const assessmentContext = assessmentType
    ? `\nTipo de evaluación: ${assessmentType === "diagnostic" ? "Diagnóstica (detectar conocimientos previos)" : assessmentType === "formative" ? "Formativa (práctica con retroalimentación)" : assessmentType === "summative" ? "Sumativa (evaluación calificada)" : "Auto-reflexión"}`
    : "";

  const bloomContext = bloomLevel
    ? `\nNivel cognitivo esperado (Bloom): ${bloomLevel}`
    : "";

  const objectivesContext = objectives && objectives.length > 0
    ? `\nObjetivos de aprendizaje que evalúa esta actividad:\n${objectives.map((o) => `- ${o}`).join("\n")}`
    : "";

  let rubricContext = "";
  if (rubricCriteria) {
    try {
      const criteria = JSON.parse(rubricCriteria) as Array<{ name: string; levels: Array<{ score: number; label: string; description: string }> }>;
      rubricContext = `\nCriterios de la rúbrica de evaluación:\n${criteria.map((c) => `- ${c.name}: ${c.levels.map((l) => `${l.label} (${l.score}pt)`).join(", ")}`).join("\n")}`;
    } catch {
      // ignorar
    }
  }

  const userPrompt = `Actividad: ${activityTitle} (tipo: ${activityType})
${context ? `Contexto: ${context}` : ""}${assessmentContext}${bloomContext}${objectivesContext}${rubricContext}

Enunciado/pregunta:
${prompt}

Respuesta correcta esperada:
${correctAnswer ?? "(respuesta abierta)"}

Respuesta del estudiante:
${studentAnswer}

¿Es correcta?: ${isCorrect ? "SÍ" : "PARCIALMENTE / NO"}

Genera una retroalimentación formativa que:
- Si es correcta: valida, refuerza el concepto clave y sugiere una conexión con un equipo médico real.
- Si es incorrecta o parcial: identifica el error conceptual específico (sin dar la respuesta completa), ofrece una pista concreta y motiva a reintentar.
- Si es diagnóstica: enfócate en detectar conocimiento previo, sin juzgar.
- Si es sumativa: sé más riguroso y específico sobre qué faltó.
- Si es autoevaluación: valora la reflexión y sugiere cómo profundizar.
Máximo 80 palabras.`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    return isCorrect
      ? "¡Bien hecho! Has aplicado correctamente el concepto. Sigue practicando para afianzarlo."
      : "Revisa el concepto clave del enunciado. Identifica qué supuesto no se cumple e inténtalo nuevamente.";
  }
}
