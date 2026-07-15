/**
 * Seed - Plataforma de Aprendizaje Adaptativo Electromedicina II
 * Piloto de Innovación Docente - Universidad de Valparaíso
 *
 * Crea datos realistas para: badges, usuarios (1 docente + 4 estudiantes),
 * 5 unidades temáticas, ~15 lecciones con contenido Markdown enriquecido,
 * ~33 actividades (5 tipos), progreso, intentos, mensajes de chat,
 * sesiones de estudio, badges otorgados y autoevaluaciones.
 *
 * Ejecutar:  bun run prisma/seed.ts
 */

import { db } from "@/lib/db";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/** Convierte un objeto JS a string JSON para campos `data` (SQLite no soporta JSON nativo). */
const j = (o: unknown) => JSON.stringify(o);

/** Fecha restanda N días desde ahora. */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Fecha restanda N horas desde ahora. */
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);

// ──────────────────────────────────────────────────────────────────────────
// Datos estáticos (badges, usuarios, unidades/lecciones/actividades)
// ──────────────────────────────────────────────────────────────────────────

const BADGES = [
  {
    slug: "primer-paso",
    name: "Primer Paso",
    description: "Completa tu primera actividad en la plataforma.",
    icon: "Footprints",
    tier: "bronze",
  },
  {
    slug: "explorador",
    name: "Explorador",
    description: "Visita las cinco unidades temáticas del curso.",
    icon: "Compass",
    tier: "bronze",
  },
  {
    slug: "racha-7",
    name: "Constancia",
    description: "Mantén una racha de 7 días consecutivos de estudio.",
    icon: "Flame",
    tier: "silver",
  },
  {
    slug: "maestro-ecg",
    name: "Maestro del ECG",
    description: "Domina la unidad de Electrocardiografía con ≥80% de maestría.",
    icon: "Award",
    tier: "gold",
  },
  {
    slug: "centinela",
    name: "Centinela",
    description: "Completa el módulo de Seguridad Eléctrica Clínica.",
    icon: "ShieldCheck",
    tier: "silver",
  },
  {
    slug: "tutor-activo",
    name: "Curioso",
    description: "Realiza al menos 10 consultas al tutor IA.",
    icon: "MessageCircleQuestion",
    tier: "silver",
  },
] as const;

const USERS = [
  {
    email: "profesor.mora@uv.cl",
    name: "Prof. Hermes Mora",
    role: "teacher",
    points: 0,
    streak: 0,
    lastActive: hoursAgo(2),
  },
  {
    email: "camila.rojas@uv.cl",
    name: "Camila Rojas Vergara",
    role: "student",
    points: 850,
    streak: 12,
    lastActive: hoursAgo(1),
  },
  {
    email: "matias.soto@uv.cl",
    name: "Matías Soto Carrasco",
    role: "student",
    points: 520,
    streak: 5,
    lastActive: hoursAgo(5),
  },
  {
    email: "fernanda.vega@uv.cl",
    name: "Fernanda Vega López",
    role: "student",
    points: 410,
    streak: 3,
    lastActive: hoursAgo(20),
  },
  {
    email: "tomas.munoz@uv.cl",
    name: "Tomás Muñoz Herrera",
    role: "student",
    points: 180,
    streak: 1,
    lastActive: daysAgo(2),
  },
] as const;

// ─── Unidades, lecciones y actividades ────────────────────────────────────

type ActivitySpec = {
  type:
    | "multiple_choice"
    | "guided_problem"
    | "case_analysis"
    | "progressive_exercise"
    | "self_assessment";
  title: string;
  prompt: string;
  data: any;
  points: number;
  difficulty: "easy" | "medium" | "hard";
};

type LessonSpec = {
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  content: string;
  activities: ActivitySpec[];
};

type UnitSpec = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  color: string;
  lessons: LessonSpec[];
};

const UNITS: UnitSpec[] = [
  // ════════════════════════════════════════════════════════════════════════
  // UNIDAD 1 — Bioseñales y Electrodos
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: "biosenales-electrodos",
    title: "Bioseñales y Electrodos",
    summary:
      "Origen eléctrico de las señales biológicas y su captación mediante electrodos y transductores.",
    description:
      "Esta unidad introduce las bases bioeléctricas de las señales fisiológicas (ECG, EEG, EMG), los mecanismos de captación mediante electrodos y transductores, y las técnicas de acondicionamiento analógico necesarias para obtener registros clínicos confiables.",
    icon: "Activity",
    color: "emerald",
    lessons: [
      {
        slug: "naturaleza-de-las-biosenales",
        title: "Naturaleza de las Bioseñales",
        description:
          "Origen bioeléctrico, características frecuenciales y de amplitud de las principales señales fisiológicas.",
        durationMin: 18,
        content: `## Naturaleza de las Bioseñales

Las **bioseñales** son manifestaciones físicas o químicas generadas por el organismo que pueden medirse en forma continua o discreta. En Electromedicina nos enfocamos principalmente en las **bioseñales eléctricas**, originadas por la actividad coordinada de células excitables (neuronas, miocitos cardiacos y esqueléticos, células musculares lisas).

### Origen celular

Toda célula excitable mantiene un **potencial de membrana en reposo** del orden de \`−70 mV\` a \`−90 mV\`, producto de la distribución iónica (Na⁺, K⁺, Cl⁻, Ca²⁺) y de la bomba Na⁺/K⁺-ATPasa. Cuando se alcanza el umbral, se dispara un **potencial de acción** de aproximadamente \`100 mV\` de amplitud y \`1–3 ms\` de duración.

La señal registrada en superficie (por ejemplo, el ECG) es la **suma temporal y espacial** de millones de potenciales de acción que se propagan sincrónicamente por el miocardio.

### Clasificación

| Señal  | Amplitud típica | Ancho de banda |
|--------|-----------------|----------------|
| ECG    | 0.1 – 5 mV      | 0.05 – 150 Hz  |
| EEG    | 10 – 100 µV     | 0.5 – 60 Hz    |
| EMG    | 50 µV – 5 mV    | 20 – 2000 Hz   |
| EOG    | 50 – 3500 µV    | 0 – 100 Hz     |

### Características clínicas

- **Baja amplitud**: requieren amplificación de 1000× a 10000×.
- **Bajo contenido espectral**: la mayor parte de la energía útil está por debajo de 100 Hz.
- **Alta impedancia de fuente**: la piel y los electrodos presentan impedancias de kΩ a MΩ.
- **Ruido acoplado**: 50 Hz (Chile) o 60 Hz, además de artifactos de movimiento.

### Consideraciones prácticas

> El ancho de banda diagnóstico del ECG (0.05–150 Hz) preserva los complejos QRS y la repolarización. Para **monitoreo en UCI** se restringe a 0.5–40 Hz para reducir artefactos, sacrificando precisión morfológica por estabilidad visual.

### Impedancia y ruido térmico

El ruido térmico generado por la resistencia de entrada está dado por:

\`V_n = \\sqrt{4 k_B T R \\Delta f}\`

donde \`k_B\` es la constante de Boltzmann (1.38×10⁻²³ J/K), \`T\` la temperatura absoluta, \`R\` la resistencia y \`\\Delta f\` el ancho de banda. Una resistencia de 1 MΩ a 300 K en 150 Hz genera ~1.6 µV RMS de ruido, lo que ya compite con señales de ECG ruidosas.

## Conclusión

Comprender la naturaleza eléctrica, espectral y de impedancia de las bioseñales es el primer paso para diseñar o seleccionar el sistema de adquisición adecuado. Toda decisión de filtrado o amplificación parte de conocer la **energía útil** versus el **ruido** presente en cada banda.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Origen del ECG superficial",
            prompt:
              "¿Qué representa la señal ECG registrada en la superficie del tórax?",
            data: {
              question:
                "¿Qué representa la señal ECG registrada en la superficie del tórax?",
              options: [
                "A) El potencial de acción de una sola fibra cardiaca.",
                "B) La suma temporal y espacial de millones de potenciales de acción del miocardio.",
                "C) La variación de impedancia de los pulmones.",
                "D) La actividad mecánica del corazón.",
              ],
              correctIndex: 1,
              explanation:
                "El ECG superficial es el resultado de integrar espacialmente la actividad eléctrica de millones de células cardiacas que se despolarizan de forma coordinada. Una sola fibra generaría señales demasiado pequeñas para detectarse en superficie.",
              hints: [
                "Piensa en cuántas células cardiacas hay.",
                "La señal es la suma de muchos dipolos.",
              ],
            },
            points: 10,
            difficulty: "easy",
          },
          {
            type: "guided_problem",
            title: "Cálculo de ruido térmico en ECG",
            prompt:
              "Calcula el ruido térmico de un electrodo con resistencia de entrada de 1 MΩ a 37 °C en un ancho de banda de 150 Hz.",
            data: {
              scenario:
                "Un sistema de adquisición de ECG tiene una resistencia de entrada de 1 MΩ. La temperatura corporal es de 37 °C y el ancho de banda diagnóstico es 0.05–150 Hz (aproxima Δf ≈ 150 Hz).",
              steps: [
                {
                  prompt:
                    "Paso 1: Convierte la temperatura a Kelvin. T(°C) + 273.15",
                  answer: "310.15 K",
                  hint: "37 + 273.15",
                },
                {
                  prompt:
                    "Paso 2: Aplica la fórmula V_n = √(4·k_B·T·R·Δf) con k_B = 1.38×10⁻²³ J/K.",
                  answer: "1.6 µV RMS",
                  hint: "Sustituye: 4 · 1.38e-23 · 310.15 · 1e6 · 150",
                },
                {
                  prompt:
                    "Paso 3: Compara con la amplitud mínima de ECG (≈100 µV). ¿Es despreciable?",
                  answer: "Aproximadamente 1.6% de la señal mínima — no despreciable.",
                  hint: "1.6 / 100 = 1.6%",
                },
              ],
              finalAnswer:
                "El ruido térmico es ~1.6 µV RMS, equivalente al 1.6% de la señal mínima del ECG, lo que justifica el uso de amplificadores con alta CMRR y filtrado.",
              explanation:
                "El ruido térmico impone un límite inferior al ruido del sistema. Para reducirlo se baja la resistencia efectiva (electrodos de baja impedancia) o se limita el ancho de banda a lo estrictamente necesario.",
            },
            points: 15,
            difficulty: "medium",
          },
        ],
      },
      {
        slug: "captacion-electrodos-transductores",
        title: "Captación: Electrodos y Transductores",
        description:
          "Tipos de electrodos, interfaz electrodo-piel, polarización y transductores biomédicos.",
        durationMin: 22,
        content: `## Captación: Electrodos y Transductores

La interfaz entre el cuerpo y el sistema electrónico es **el componente más crítico** de cualquier equipo biomédico. Un mal electrodo arruina la mejor instrumentación.

### El electrodo como transductor iónico-electrónico

El cuerpo conduce mediante **iones**; los cables, mediante **electrones**. El electrodo realiza la conversión mediante reacciones de **óxido-reducción** en la interfaz metal-electrolito.

### Potencial de semi-celda

Cada electrodo sumergido en un electrolito desarrolla un potencial de semi-celda \`E₀\`. Para el par Ag/AgCl en solución fisiológica:

\`E_0 \\approx +0.223 \\text{ V}\`

Si ambos electrodos son idénticos, sus potenciales **se cancelan**. Pequeñas asimetrías generan voltajes de offset de varios milivolts que deben compensarse.

### Clasificación de electrodos

- **Despreciables o no polarizables** (Ag/AgCl): el ideal clínico. Estables, bajo ruido.
- **Polarizables** (platino puro, acero inoxidable): se comportan como capacitores, útiles para estimulación, no para registro.
- **Media polarización** (oro): estables a largo plazo, se usan en EEG de larga duración.

### Impedancia de la interfaz electrodo-piel

La piel seca presenta impedancias de **>100 kΩ**. Para reducirla:

1. Limar la capa córnea (peeling).
2. Aplicar gel conductor (cloruro de potasio en base viscosa).
3. Usar electrodos Ag/AgCl desechables con gel pre-aplicado.

La impedancia sigue un modelo de **Warburg**: \`Z(ω) = R_s + Z_w(ω)\`, donde la parte de Warburg decae con \`1/√ω\`.

### Transductores biomédicos

| Magnitud        | Transductor típico                  |
|-----------------|-------------------------------------|
| Temperatura     | Termistor NTC, PT100, IR            |
| Presión         | Strain gauge, piezorresistivo       |
| Flujo           | Ultrasónico Doppler, térmico         |
| SpO₂            | Fotodiodo + LEDs rojo/IR             |
| CO₂             | Celda infrarroja NDIR                |

### Consideración práctica: motion artifact

El movimiento del paciente cambia la distribución del gel y la impedancia, generando artefactos de **hasta decenas de milivolts**. La solución combina:
- Filtros paso-alto (corte en 0.05 Hz).
- Algoritmos de detección de saturación.
- Diseño mecánico del electrodo (geometría cóncava del gel).

## Conclusión

El electrodo no es un cable: es un **transductor activo** con dinámica propia. Conocer su modelo eléctrico permite diagnosticar la mayoría de los problemas de calidad de señal en el ámbito clínico.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Tipo ideal de electrodo para ECG",
            prompt:
              "¿Qué tipo de electrodo es el más apropiado para registro continuo de ECG y por qué?",
            data: {
              question:
                "¿Qué electrodo es preferible para el ECG de monitoreo prolongado?",
              options: [
                "A) Platino puro, porque es totalmente polarizable.",
                "B) Ag/AgCl, porque es prácticamente no polarizable y estable.",
                "C) Acero inoxidable, porque es más barato.",
                "D) Oro puro, porque es media-polarizable.",
              ],
              correctIndex: 1,
              explanation:
                "El Ag/AgCl es no polarizable: la reacción redox ocurre libremente, manteniendo un potencial de semi-celda estable y bajo ruido. Es el estándar clínico para ECG.",
              hints: [
                "Busca el electrodo no polarizable.",
                "Es el material más usado en electrodos desechables.",
              ],
            },
            points: 10,
            difficulty: "easy",
          },
          {
            type: "case_analysis",
            title: "Diagnóstico de artefacto en monitor ECG",
            prompt:
              "Analiza un caso clínico con artefacto en ECG de UCI y determina la causa más probable.",
            data: {
              case:
                "En la UCI del Hospital Carlos Van Buren, el monitor ECG de un paciente muestra una línea basal errática que oscila varios milivolts al mover el brazo derecho. La enfermera revisa los cables y están íntegros. Los electrodos llevan 5 días colocados.",
              questions: [
                {
                  prompt:
                    "¿Cuál es la causa más probable del artefacto al mover el brazo?",
                  answer:
                    "Movimiento del electrodo que altera la distribución del gel y la impedancia electrodo-piel.",
                  explanation:
                    "El movimiento modifica la capa de gel conductor, generando cambios bruscos de impedancia que se traducen en artefactos de milivolts. Esto es motion artifact clásico.",
                },
                {
                  prompt:
                    "¿Qué acción inmediata recomiendas como ingeniero clínico?",
                  answer:
                    "Reemplazar los electrodos (llevan 5 días, gel deshidratado) y preparar la piel nuevamente.",
                  explanation:
                    "Los electrodos desechables pierden humedad del gel tras 2-3 días. Además, el conducto de la piel cambia. Reemplazo + preparación reduce la impedancia a <10 kΩ.",
                },
                {
                  prompt:
                    "¿Qué filtro del monitor ayudaría a estabilizar la visualización sin perder información diagnóstica crítica?",
                  answer:
                    "Activar el filtro de línea base (corte 0.5 Hz) en modo monitor, no diagnóstico.",
                  explanation:
                    "En modo monitor se acepta corte en 0.5 Hz para reducir wander por respiración/movimiento, preservando el ritmo. En modo diagnóstico se mantiene 0.05 Hz.",
                },
              ],
            },
            points: 15,
            difficulty: "medium",
          },
        ],
      },
      {
        slug: "acondicionamiento-de-senal",
        title: "Acondicionamiento de Señal",
        description:
          "Amplificadores de instrumentación, CMRR, filtrado analógico y aislamiento.",
        durationMin: 25,
        content: `## Acondicionamiento de Señal

Una vez captada, la bioseñal (típicamente milivolts a microvolts) debe **amplificarse, filtrarse y aislarse** antes de su digitalización.

### Amplificador de instrumentación

El estándar es el **amplificador de instrumentación de tres amplificadores operacionales** (AD620, INA128). Sus características:

- **Alta impedancia de entrada** (>10 GΩ).
- **Alto CMRR** (>100 dB a 60 Hz).
- **Ganancia ajustable** con una sola resistencia externa.

La ganancia se calcula:

\`G = 1 + \\frac{49.4\\,k\\Omega}{R_g}\`

Para una ganancia de 1000×: \`R_g = 49.4 \\, \\Omega\`.

### Rechazo de modo común (CMRR)

El CMRR expresa cuánto se rechaza una señal común a ambas entradas:

\`CMRR = 20 \\log_{10}\\left(\\frac{A_d}{A_c}\\right) \\text{ [dB]}\`

Con 60 Hz de la red eléctrica acoplado por capacencias parásitas (~10 µV a mV), se requiere \`CMRR > 100 \\text{ dB}\` para reducirlo por debajo del ruido térmico.

### Filtrado analógico

| Filtro        | Tipo        | Corte      | Función                                  |
|---------------|-------------|------------|------------------------------------------|
| Paso-alto     | RC activo   | 0.05 Hz    | Elimina wander por respiración.          |
| Paso-bajo     | Bessel/Butterworth | 150 Hz | Rechaza ruido de alta frecuencia.       |
| Notch         | Twin-T / activo | 50 Hz  | Elimina ruido de la red eléctrica.       |

### Driver de pierna derecha (RLD)

Truco fundamental en ECG: en lugar de usar una pierna solo como referencia pasiva, se **invierte y amplifica** la señal de modo común y se inyecta de vuelta. Esto reduce el ruido de 60 Hz hasta **100×** sin sacrificar información diferencial.

### Aislamiento galvánico

Para cumplir **IEC 60601** y proteger al paciente, la parte conectada al cuerpo debe estar **aislada eléctricamente** de la red:

- **Aislamiento óptico**: para señales digitales.
- **Aislamiento por transformador**: para alimentación y analógico.
- **Amplificadores de aislamiento**: AD210, ISO124.

El límite de corriente de fuga a paciente para partes CF es de **10 µA** en condición normal.

### Cadena típica

\`Electrodos → Cables blindados → Protección (defibrilación) → IA (G=1000) → HPF (0.05 Hz) → LPF (150 Hz) → Notch (50 Hz) → Aislamiento → ADC\`

## Conclusión

El acondicionamiento determina la **calidad clínica** del registro. Errores en CMRR, filtrado o aislamiento convierten un equipo perfecto en un generador de falsos positivos.`,
        activities: [
          {
            type: "guided_problem",
            title: "Cálculo de Rg para ganancia 1000×",
            prompt:
              "Determina el valor de resistencia externa para un AD620 con ganancia 1000×.",
            data: {
              scenario:
                "El amplificador de instrumentación AD620 sigue la relación G = 1 + 49.4kΩ / Rg. Necesitas amplificar un ECG de 1 mV a 1 V para alimentar el ADC.",
              steps: [
                {
                  prompt: "Paso 1: Calcula la ganancia requerida.",
                  answer: "G = 1V / 1mV = 1000",
                  hint: "Divide salida entre entrada.",
                },
                {
                  prompt: "Paso 2: Despeja Rg de la fórmula.",
                  answer: "Rg = 49.4kΩ / (G − 1) = 49.4kΩ / 999",
                  hint: "G − 1 porque la fórmula es 1 + ...",
                },
                {
                  prompt: "Paso 3: Calcula el valor numérico.",
                  answer: "≈ 49.45 Ω",
                  hint: "49400 / 999 ≈ 49.45",
                },
              ],
              finalAnswer:
                "Se requiere una resistencia externa Rg ≈ 49.4 Ω para obtener G = 1000× con el AD620.",
              explanation:
                "Con este valor, una señal de 1 mV se amplifica a 1 V, dentro del rango típico de ADCs de 12 bits (0–3.3 V).",
            },
            points: 15,
            difficulty: "medium",
          },
          {
            type: "progressive_exercise",
            title: "Diseño completo de filtrado ECG",
            prompt:
              "Diseña progresivamente el filtrado analógico para un canal ECG.",
            data: {
              levels: [
                {
                  prompt:
                    "Nivel 1: Indica el corte del paso-alto para preservar el segmento ST.",
                  answer: "0.05 Hz",
                  explanation:
                    "Cortes mayores (0.5 Hz o más) distorsionan el segmento ST, evitando diagnóstico de isquemia.",
                },
                {
                  prompt:
                    "Nivel 2: ¿Qué corte del paso-bajo usar para diagnóstico versus monitoreo?",
                  answer:
                    "150 Hz para diagnóstico, 40 Hz para monitoreo.",
                  explanation:
                    "Diagnóstico requiere preservar ondas de rápida pendiente (QRS). Monitoreo prioriza estabilidad visual.",
                },
                {
                  prompt:
                    "Nivel 3: Si el CMRR del sistema es 80 dB a 60 Hz y el ruido de modo común es 1 mV, ¿cuánto ruido diferencial queda?",
                  answer: "≈ 0.1 µV",
                  explanation:
                    "80 dB → factor 10⁻⁴. 1 mV × 10⁻⁴ = 0.1 µV. Despreciable respecto a ruido térmico.",
                },
              ],
            },
            points: 20,
            difficulty: "hard",
          },
          {
            type: "self_assessment",
            title: "Autoevaluación: acondicionamiento de señal",
            prompt:
              "Reflexiona sobre tu comprensión del acondicionamiento analógico en ECG.",
            data: {
              prompt:
                "¿Hasta qué punto podrías diseñar desde cero la cadena de acondicionamiento para un ECG de 12 derivaciones, justificando cada componente?",
              rubric: [
                "Novato: reconoce los bloques pero no justifica valores de corte ni CMRR.",
                "Practicante: calcula ganancias y filtros básicos, pero no domina el rol del RLD.",
                "Competente: diseña la cadena completa con CMRR objetivo y aislamiento conforme a IEC 60601.",
                "Experto: justifica trade-offs diagnóstico/monitoreo y propone alternativas frente a restricciones.",
              ],
              autoGradeKeywords: [
                "CMRR",
                "ganancia",
                "AD620",
                "RLD",
                "paso-alto",
                "0.05 Hz",
                "aislamiento",
                "IEC 60601",
              ],
            },
            points: 5,
            difficulty: "medium",
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // UNIDAD 2 — Electrocardiografía (ECG)
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: "electrocardiografia",
    title: "Electrocardiografía (ECG)",
    summary:
      "Fundamentos eléctricos del corazón, sistema de derivaciones y la instrumentación del ECG.",
    description:
      "Estudia la actividad eléctrica cardiaca desde su origen electrofisiológico, el sistema de 12 derivaciones estándar y los aspectos de instrumentación y filtrado que permiten obtener trazados diagnósticos confiables.",
    icon: "HeartPulse",
    color: "rose",
    lessons: [
      {
        slug: "fundamentos-ecg-einthoven",
        title: "Fundamentos del ECG e Einthoven",
        description:
          "Sistema de conducción cardiaco, ondas P-QRS-T y triángulo de Einthoven.",
        durationMin: 20,
        content: `## Fundamentos del ECG e Einthoven

### Sistema de conducción cardiaco

El impulso eléctrico se origina en el **nódulo sinusal** (SA), ubicado en la aurícula derecha, a una frecuencia de **60–100 latidos/min** en reposo. Desde ahí:

1. Se propaga por ambas aurículas (onda **P**).
2. Llega al **nódulo auriculoventricular** (AV), con retardo de ~120 ms.
3. Desciende por el **haz de His** y sus ramas (Q, R, S).
4. Se distribuye por las **fibras de Purkinje** y despolariza los ventrículos.
5. Sobreviene la repolarización ventricular (onda **T**).

### El triángulo de Einthoven

Willem Einthoven (Premio Nobel 1924) propuso que los miembros forman un triángulo equilátero alrededor del corazón:

- **Vértice superior**: corazón.
- **Vértices inferiores**: brazo izquierdo (BI), brazo derecho (BD) y pierna izquierda (PI).

Las **derivaciones bipolares estándar** miden diferencias de potencial entre dos miembros:

- **DI** = BI − BD
- **DII** = PI − BD
- **DIII** = PI − BI

### Ley de Einthoven

\`DII = DI + DIII\`

Esta relación se verifica en cualquier instante del ciclo cardiaco y permite detectar errores de colocación de electrodos.

### Vector cardiaco

Cada instante del ciclo cardiaco puede representarse como un **vector dipolar** resultante. La proyección de este vector sobre cada derivación genera la morfología observada. Un vector que apunta hacia el electrodo positivo produce una **deflexión positiva**.

### Eje eléctrico medio

El eje eléctrico normal en adulto está entre **−30° y +90°**. Se calcula a partir de las amplitudes de R en DI y aVF:

| Eje            | DI   | aVF  |
|----------------|------|------|
| Normal (60°)   | +    | +    |
| Desviado izq.  | +    | −    |
| Desviado der.  | −    | +    |

### Amplitudes e intervalos clínicos

| Parámetro      | Valor normal          |
|----------------|-----------------------|
| Onda P         | < 0.25 mV, < 120 ms   |
| Intervalo PR   | 120–200 ms            |
| Complejo QRS   | 60–100 ms             |
| Intervalo QT   | 350–440 ms (corr. fc) |
| Segmento ST    | Isoeléctrico          |

## Conclusión

El triángulo de Einthoven no es solo un modelo histórico: es la base matemática que permite detectar errores de cableado, calcular el eje eléctrico y entender por qué cada derivación muestra una morfología distinta del mismo corazón.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Identificación de ondas ECG",
            prompt: "Identifica qué representa cada onda del ECG.",
            data: {
              question:
                "¿Qué evento fisiológico corresponde a la onda P del ECG?",
              options: [
                "A) Despolarización ventricular.",
                "B) Repolarización auricular.",
                "C) Despolarización auricular.",
                "D) Repolarización ventricular.",
              ],
              correctIndex: 2,
              explanation:
                "La onda P es la primera deflexión y representa la despolarización auricular, previa al complejo QRS.",
              hints: [
                "Es la primera onda del ciclo.",
                "Aurículas antes que ventrículos.",
              ],
            },
            points: 10,
            difficulty: "easy",
          },
          {
            type: "guided_problem",
            title: "Verificación de la ley de Einthoven",
            prompt:
              "Verifica la ley de Einthoven a partir de tres derivaciones registradas.",
            data: {
              scenario:
                "En un trazado se miden: DI = +0.4 mV, DII = +0.9 mV, DIII = +0.5 mV. Se sospecha un error de cableado.",
              steps: [
                {
                  prompt: "Paso 1: Aplica la ley de Einthoven: DII = DI + DIII.",
                  answer: "0.4 + 0.5 = 0.9 mV",
                  hint: "Suma DI y DIII.",
                },
                {
                  prompt:
                    "Paso 2: Compara con el DII medido. ¿Coincide?",
                  answer: "Sí, 0.9 mV medido = 0.9 mV calculado.",
                  hint: "Resta el calculado del medido.",
                },
                {
                  prompt:
                    "Paso 3: Concluye sobre la colocación de electrodos.",
                  answer:
                    "La ley se cumple → los electrodos están correctamente colocados.",
                  hint: "Si la ley fallara, habría intercambio de cables.",
                },
              ],
              finalAnswer:
                "La ley de Einthoven se cumple, por lo que la colocación de electrodos es correcta.",
              explanation:
                "La ley es una herramienta rápida de control de calidad al pie de cama del paciente.",
            },
            points: 15,
            difficulty: "medium",
          },
        ],
      },
      {
        slug: "sistema-de-derivaciones",
        title: "Sistema de Derivaciones",
        description:
          "Sistema estándar de 12 derivaciones: bipolares, aumentadas y precordiales.",
        durationMin: 22,
        content: `## Sistema de Derivaciones

El **ECG estándar de 12 derivaciones** es el registro clínico universal. Combina tres familias de derivaciones que miran el corazón desde ángulos distintos.

### 1. Derivaciones bipolares de miembros

- **DI**: BI − BD (eje 0°)
- **DII**: PI − BD (eje +60°)
- **DIII**: PI − BI (eje +120°)

### 2. Derivaciones unipolares aumentadas (aVR, aVL, aVF)

Calculan el potencial de un miembro respecto al **promedio** de los otros dos:

- **aVR** = −(DI + DII)/2 (eje −150°)
- **aVL** = DI − DIII/2 (eje −30°)
- **aVF** = DII/2 + DIII/2 (eje +90°)

La “a” viene de **augmented**: al promediar solo dos miembros (no tres), la amplitud aumenta 50%.

### 3. Derivaciones precordiales (V1–V6)

Son **unipolares**: el electrodo explorador se coloca en posiciones anatómicas del tórax, y el electrodo indiferente es el promedio de los tres miembros (Wilson).

| Derivación | Posición                                  |
|------------|-------------------------------------------|
| V1         | 4° espacio intercostal, borde esternal derecho |
| V2         | 4° espacio intercostal, borde esternal izquierdo |
| V3         | Entre V2 y V4                              |
| V4         | 5° espacio intercostal, línea clavicular media |
| V5         | Mismo nivel, línea axilar anterior         |
| V6         | Mismo nivel, línea axilar media            |

### Plano frontal vs plano horizontal

- **DI, DII, DIII, aVR, aVL, aVF**: miran en el **plano frontal**. Útiles para calcular el eje eléctrico y detectar infartos inferiores (DII, DIII, aVF) o laterales (DI, aVL).
- **V1–V6**: miran en el **plano horizontal**. Detectan infartos anteriores (V1–V4) o laterales (V5–V6).

### Localización de infartos

| Localización    | Derivaciones afectadas   |
|-----------------|--------------------------|
| Inferior        | DII, DIII, aVF           |
| Anterior        | V1–V4                    |
| Lateral         | DI, aVL, V5, V6          |
| Septal          | V1, V2                   |
| Posterior       | V1–V2 con imagen espejo  |

### Colocación correcta

Un error frecuente es invertir brazo y pierna izquierda: produce **aVF invertido** que se confunde con dextrocardia. La regla clínica: si aVR muestra QRS positivo, sospecha de inversión.

## Conclusión

Las 12 derivaciones no son redundantes: cada una observa una porción distinta del corazón. Su combinación permite localizar eléctricamente cualquier lesión.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Localización de infarto inferior",
            prompt:
              "¿Qué derivaciones muestran un infarto inferior agudo?",
            data: {
              question:
                "En un infarto agudo de miocardio inferior, ¿qué derivaciones muestran elevación del ST?",
              options: [
                "A) V1, V2, V3, V4",
                "B) DII, DIII y aVF",
                "C) DI y aVL",
                "D) V5 y V6",
              ],
              correctIndex: 1,
              explanation:
                "La pared inferior del corazón está mirada por DII, DIII y aVF. Elevación del ST en estas derivaciones indica infarto inferior, típicamente por oclusión de la arteria coronaria derecha.",
              hints: [
                "Inferior = abajo = aVF.",
                "DII y DIII también miran hacia abajo.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
          {
            type: "case_analysis",
            title: "Trazado con inversión de electrodos",
            prompt:
              "Diagnostica un problema de colocación de electrodos a partir del trazado.",
            data: {
              case:
                "Un técnico de ECG obtiene un trazado en el que aVR muestra complejos QRS positivos altos y aVF muestra QRS negativos. El paciente no tiene antecedentes cardiacos y el examen físico es normal. La enfermera sugiere dextrocardia.",
              questions: [
                {
                  prompt:
                    "¿Es probable la dextrocardia? Justifica.",
                  answer:
                    "No, es más probable la inversión de electrodos de brazos (BD ↔ BI).",
                  explanation:
                    "La dextrocardia es muy rara y la inversión de electrodos es un error común. aVR con QRS positivo es la firma de inversión BD↔BI.",
                },
                {
                  prompt:
                    "¿Qué derivaciones estarían invertidas?",
                  answer: "DI y aVL invertidos; aVR y aVF intercambiados en signo.",
                  explanation:
                    "Al invertir BD y BI, todas las derivaciones de miembros cambian de signo o se reordenan según sus fórmulas.",
                },
                {
                  prompt:
                    "¿Cómo lo confirmas rápidamente?",
                  answer:
                    "Revisar la ley de Einthoven: si no se cumple, hay error de cableado.",
                  explanation:
                    "DII ≠ DI + DIII en inversiones. La ley es el test rápido.",
                },
              ],
            },
            points: 20,
            difficulty: "hard",
          },
        ],
      },
      {
        slug: "instrumentacion-filtrado-ecg",
        title: "Instrumentación y Filtrado del ECG",
        description:
          "Requisitos del amplificador ECG, right leg drive y filtrado diagnóstico.",
        durationMin: 24,
        content: `## Instrumentación y Filtrado del ECG

### Especificaciones del amplificador

| Parámetro              | Valor clínico             |
|------------------------|---------------------------|
| Ganancia diferencial   | 1000–2000×                |
| CMRR a 60 Hz           | ≥ 100 dB                  |
| Impedancia de entrada  | ≥ 100 MΩ                  |
| Ancho de banda (diag.) | 0.05 – 150 Hz             |
| Ancho de banda (mon.)  | 0.5 – 40 Hz               |
| Ruido p-p (entrada)    | < 30 µV                   |

### Right Leg Drive (RLD)

En lugar de usar la pierna derecha como referencia flotante, se:

1. Toma la **señal de modo común** (promedio de las derivaciones).
2. Se **invierte y amplifica**.
3. Se inyecta de vuelta al paciente por el electrodo de pierna derecha.

Esto reduce el ruido de 60 Hz **en un factor de 10 a 100×** porque el lazo activo cancela la corriente de modo común.

### Detección de electrodo desconectado

Se inyecta una corriente AC pequeña (~10 µA a 30 kHz) por los electrodos. Si la impedancia sube (electrodo suelto), el voltaje de esta señal de test aumenta y se dispara la alarma.

### Filtrado por etapas

1. **Anti-aliasing**: paso-bajo a 1 kHz antes del ADC.
2. **Paso-alto digital**: 0.05 Hz (diagnóstico) o 0.67 Hz (monitor de ritmo).
3. **Paso-bajo digital**: 150 Hz (diagnóstico) o 40 Hz (monitor).
4. **Filtro notch**: 50 Hz (Chile, Europa) o 60 Hz (EE.UU.). Q ≥ 30.
5. **Filtro de red avanzado**: algoritmos adaptativos (LMS) para no distorsionar el QRS.

### Trade-off diagnóstico vs monitoreo

- **Diagnóstico**: preserva morfología → cortes anchos (0.05–150 Hz). Reemplaza al papel trazador.
- **Monitoreo**: estabiliza visualización para UCI → cortes estrechos (0.5–40 Hz). Sacrifica el segmento ST.

> **Regla clínica**: nunca diagnosticar isquemia con un monitor filtrado para UCI. El segmento ST se deforma visiblemente con corte en 0.5 Hz.

### Lead-off y alarms

El sistema debe distinguir:
- **Electrodo desconectado**: alarma prioritaria.
- **Cable roto**: alarma prioritaria.
- **Asistolia real**: alarma crítica + verificación multiderivación.

## Conclusión

El ECG moderno es un sistema altamente filtrado y adaptado. Conocer las configuraciones posibles evita errores diagnósticos graves, especialmente en interpretación de segmento ST.`,
        activities: [
          {
            type: "progressive_exercise",
            title: "Configuración de filtros para distintos escenarios",
            prompt:
              "Configura los filtros del monitor ECG para tres escenarios clínicos.",
            data: {
              levels: [
                {
                  prompt:
                    "Nivel 1: Paciente en UCI con marcapasos, solo necesitas ver ritmo. ¿Qué filtros activas?",
                  answer:
                    "HPF 0.5 Hz, LPF 40 Hz, notch 50 Hz, y filtro de marcapasos (pace pulse rejection).",
                  explanation:
                    "Monitoreo de ritmo prioriza estabilidad visual; no se usa para diagnóstico morfológico.",
                },
                {
                  prompt:
                    "Nivel 2: Paciente en urgencias con dolor torácico, sospecha de isquemia. ¿Cambio algo?",
                  answer:
                    "Paso a modo diagnóstico: HPF 0.05 Hz, LPF 150 Hz, notch desactivado o estrecho.",
                  explanation:
                    "El segmento ST requiere ancho de banda diagnóstico para no falsear la elevación.",
                },
                {
                  prompt:
                    "Nivel 3: El paciente presenta temblor importante. ¿Qué compensación haces sin perder el segmento ST?",
                  answer:
                    "Aumento LPF no; activo filtro de promediado o detección de artefacto; mantengo 0.05 Hz. Como última opción, pido al paciente quedarse quieto.",
                  explanation:
                    "Reducir LPF no afecta el ST, pero el temblor es ~5–10 Hz y se solapa con QRS. Mejor técnica: detector de artifacto que descarte latidos contaminados.",
                },
              ],
            },
            points: 20,
            difficulty: "hard",
          },
          {
            type: "self_assessment",
            title: "Autoevaluación: instrumentación ECG",
            prompt:
              "Reflexiona sobre tu capacidad de configurar un monitor ECG en distintos contextos clínicos.",
            data: {
              prompt:
                "¿Podrías justificar la selección de filtros y el modo (diagnóstico vs monitoreo) para distintos pacientes?",
              rubric: [
                "Novato: confunde diagnóstico con monitoreo y aplica filtros indiscriminadamente.",
                "Practicante: conoce los cortes estándar pero no justifica el RLD ni el segmento ST.",
                "Competente: ajusta filtros según contexto y explica implicancias para el ST.",
                "Experto: diseña protocolos de filtrado, gestiona artefactos y valida trazados para informe.",
              ],
              autoGradeKeywords: [
                "RLD",
                "0.05 Hz",
                "segmento ST",
                "diagnóstico",
                "monitoreo",
                "notch",
                "marcapasos",
              ],
            },
            points: 5,
            difficulty: "medium",
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // UNIDAD 3 — Monitoreo de Pacientes
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: "monitoreo-pacientes",
    title: "Monitoreo de Pacientes",
    summary:
      "Principios físicos y electrónicos de pulsioximetría, presión arterial no invasiva y capnografía.",
    description:
      "Aborda las técnicas de monitoreo continuo no invasivo más usadas en anestesia y cuidados intensivos: pulsioximetría, tensiometría oscilométrica y capnografía. Se enfatiza el principio físico de cada sensor y sus limitaciones clínicas.",
    icon: "MonitorHeart",
    color: "sky",
    lessons: [
      {
        slug: "pulsoximetria",
        title: "Pulsioximetría",
        description:
          "Principio de absorción óptica, calibración y limitaciones del SpO₂.",
        durationMin: 20,
        content: `## Pulsioximetría

La **pulsioximetría** estima la saturación arterial de oxígeno (SpO₂) de forma **no invasiva y continua**. Es uno de los grandes éxitos de la Electromedicina moderna: junto al ECG, es señal obligada en cualquier monitor multiparámetro.

### Principio físico: ley de Beer-Lambert

\`A = \\log_{10}\\left(\\frac{I_0}{I}\\right) = \\epsilon \\cdot c \\cdot d\`

donde \`A\` es absorbancia, \`ε\` el coeficiente de extinción molar, \`c\` la concentración y \`d\` el camino óptico.

### Hemoglobinas y absorción

La oxihemoglobina (HbO₂) y la desoxihemoglobina (Hb) tienen **espectros distintos**:

- A **660 nm (rojo)**: Hb absorbe más que HbO₂.
- A **940 nm (infrarrojo)**: HbO₂ absorbe más que Hb.

El pulsioxímetro alterna ambos LEDs y mide la absorbancia en cada longitud de onda. El cociente:

\`R = \\frac{A_{660}}{A_{940}}\`

se correlaciona con la saturación mediante una **curva de calibración empírica** (R ≈ 1 → SpO₂ ≈ 85%; R ≈ 0.4 → SpO₂ ≈ 100%).

### Componente pulsátil

Para aislarse de la absorción de tejido estático (piel, hueso, venas), el algoritmo usa solo la **componente pulsátil** (AC) sobre la continua (DC) generada por el llenado arterial en cada sístole.

\`R = \\frac{AC_{660}/DC_{660}}{AC_{940}/DC_{940}}\`

### Tipos de sensor

- **Transmisión**: dedo, lóbulo de oreja. LEDs y fotodiodo en lados opuestos.
- **Reflexión**: frente, mejilla. LEDs y detector en el mismo lado.

### Limitaciones clínicas

| Condición              | Efecto sobre SpO₂                |
|------------------------|----------------------------------|
| Carboxihemoglobin (COHb) | **Sobrestima** (lee ~100%).    |
| Methemoglobin (MetHb)  | Tiende a 85% (independientemente). |
| Anemia severa          | Poco fiable si Hb < 5 g/dL.      |
| Mal perfusión          | Señal débil → lectura intermitente. |
| Esmalte de uñas        | Interferencia en azul/verde.     |
| Movimiento             | Artefactos → falsas alarmas.     |

### Latencia

Los monitores actuales promedian **8–16 latidos** antes de mostrar un valor, lo que implica un retardo de **8–30 segundos** respecto a la PaO₂ real.

## Conclusión

La pulsioximetría es robusta pero **no mide PaO₂**: solo discrimina saturación. Conocer sus interferencias evita errores graves en pacientes con intoxicación por CO o anemia profunda.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Principio físico de la pulsioximetría",
            prompt:
              "¿Qué longitudes de onda usan los LEDs del pulsioxímetro?",
            data: {
              question:
                "¿Qué pares de longitudes de onda utilizan los pulsioxímetros convencionales?",
              options: [
                "A) 405 nm y 633 nm",
                "B) 660 nm (rojo) y 940 nm (infrarrojo)",
                "C) 540 nm y 800 nm",
                "D) 800 nm y 1200 nm",
              ],
              correctIndex: 1,
              explanation:
                "660 nm y 940 nm son las longitudes donde Hb y HbO₂ tienen absorciones cruzadas: a 660 nm Hb absorbe más; a 940 nm, HbO₂. El cociente permite estimar la saturación.",
              hints: [
                "Una es visible, la otra no.",
                "Rojo + infrarrojo cercano.",
              ],
            },
            points: 10,
            difficulty: "easy",
          },
          {
            type: "guided_problem",
            title: "Cálculo de saturación a partir del cociente R",
            prompt:
              "Estima la SpO₂ a partir del cociente R medido por el sensor.",
            data: {
              scenario:
                "Un sensor de pulso entrega: AC₆₆₀ = 0.5 mV, DC₆₆₀ = 100 mV, AC₉₄₀ = 0.8 mV, DC₉₄₀ = 100 mV.",
              steps: [
                {
                  prompt:
                    "Paso 1: Calcula AC₆₆₀/DC₆₆₀.",
                  answer: "0.005",
                  hint: "0.5 / 100",
                },
                {
                  prompt:
                    "Paso 2: Calcula AC₉₄₀/DC₉₄₀.",
                  answer: "0.008",
                  hint: "0.8 / 100",
                },
                {
                  prompt:
                    "Paso 3: Calcula R = (AC₆₆₀/DC₆₆₀) / (AC₉₄₀/DC₉₄₀).",
                  answer: "0.625",
                  hint: "0.005 / 0.008",
                },
                {
                  prompt:
                    "Paso 4: Usa la curva empírica R≈0.4 → 100%, R≈1 → 85%. Interpola.",
                  answer: "≈ 94% SpO₂",
                  hint: "Entre 85 y 100, R entre 1 y 0.4.",
                },
              ],
              finalAnswer:
                "Con R = 0.625 se estima una SpO₂ ≈ 94%, dentro de rango normal.",
              explanation:
                "El sensor no mide directamente PaO₂: correlaciona R con saturación mediante una curva calibrada in vitro con sangre de voluntarios.",
            },
            points: 15,
            difficulty: "medium",
          },
        ],
      },
      {
        slug: "presion-arterial-no-invasiva",
        title: "Presión Arterial No Invasiva (NIBP)",
        description:
          "Método oscilométrico, algoritmo de determinación y consideraciones de brazalete.",
        durationMin: 18,
        content: `## Presión Arterial No Invasiva (NIBP)

### Métodos disponibles

1. **Auscultatorio (Riva-Rocci/Korotkoff)**: método de referencia, manual.
2. **Oscilométrico**: usado en monitores automáticos.
3. **Tonometría arterial**: continúo, no invasivo, poco común.
4. **Fotopletismografía**: tendencias, no absoluto.

### Principio oscilométrico

Al inflar el brazalete por encima de la presión sistólica, la arteria colapsa. Al desinflar progresivamente, la arteria **recupera parcialmente su luz** con cada sístole, generando **oscilaciones de presión** en el brazalete. El algoritmo detecta:

- **Presión sistólica**: donde las oscilaciones comienzan a aumentar.
- **Presión media (MAP)**: donde las oscilaciones alcanzan **máxima amplitud**.
- **Presión diastólica**: donde las oscilaciones se estabilizan (calculada, no medida).

### Fórmula de cálculo

La presión arterial media:

\`MAP \\approx \\frac{P_{sis} + 2 \\cdot P_{dia}}{3}\`

### Tamaño del brazalete

La **regla de oro**: el brazalete debe cubrir **≥80% de la circunferencia** del brazo. Un brazalete pequeño sobreestima; uno grande subestima.

| Brazo (cm) | Brazalete recomendado |
|------------|-----------------------|
| < 24       | Adulto pequeño        |
| 24–32      | Adulto estándar       |
| 33–41      | Adulto grande         |
| > 42       | Muslo                 |

### Algoritmo típico (Dinamap, Philips)

1. Infla a 30 mmHg sobre la sistólica estimada.
2. Desinfla por pasos de 5–10 mmHg.
3. En cada paso mide amplitud de oscilación.
4. Aplica **ventana deslizante** para filtrar ruido.
5. Identifica pico → MAP.
6. Calcula sistólica y diastólica según ratios empíricos (~0.55 y ~0.85 del pico).

### Limitaciones

- **Arritmias severas**: latidos irregulares falsean el promedio.
- **Trauma o edema**: señales atenuadas.
- **Brazalete mal puesto**: lectura errónea sistemática.
- **Movimiento**: aborta la medición.

### Comparación con método invasivo

El método invasivo (línea arterial) mide **presión real** con respuesta continua; el NIBP oscilométrico tiene error típico de **±5–10 mmHg** y muestrea cada 5–15 min.

## Conclusión

El NIBP es práctico y seguro, pero sus algoritmos son empíricos. Ante hipotensión severa, arritmias o needing de tendencias continuas, debe sustituirse por línea arterial invasiva.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Método oscilométrico: MAP",
            prompt:
              "¿En qué punto del desinflado se determina la presión arterial media (MAP)?",
            data: {
              question:
                "En el método oscilométrico, ¿cómo se identifica la presión arterial media?",
              options: [
                "A) Es el primer punto donde aparecen oscilaciones.",
                "B) Es el punto de máxima amplitud de oscilación.",
                "C) Es el último punto donde se detectan oscilaciones.",
                "D) Es el promedio entre sistólica y diastólica medidas por auscultación.",
              ],
              correctIndex: 1,
              explanation:
                "La presión media (MAP) coincide con el máximo de las oscilaciones del brazalete, porque allí la arteria tiene su máxima compliance dinámica.",
              hints: [
                "Busca el pico de la curva de oscilaciones.",
                "Sistólica y diastólica se calculan a partir de ella.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
          {
            type: "case_analysis",
            title: "Discrepancia entre NIBP y línea arterial",
            prompt:
              "Analiza una discrepancia entre el NIBP y la presión invasiva.",
            data: {
              case:
                "Paciente en shock séptico, hipotenso. El NIBP oscilométrico marca 85/50 mmHg; la línea arterial marca 68/40 mmHg. La enfermera consulta al ingeniero clínico.",
              questions: [
                {
                  prompt:
                    "¿Cuál valor es más confiable y por qué?",
                  answer:
                    "La línea arterial (68/40), porque mide presión real con respuesta continua.",
                  explanation:
                    "En hipotensión severa, las oscilaciones son pequeñas y ruidosas; el NIBP puede sobreestimar 10–20 mmHg.",
                },
                {
                  prompt:
                    "¿Qué tres causas técnicas podrían explicar parte de la diferencia?",
                  answer:
                    "1) Brazalete pequeño para el brazo. 2) Arritmia o pulso débil. 3) Posición del brazo por encima del corazón.",
                  explanation:
                    "El tamaño del brazalete es la causa más frecuente. La posición del brazo respecto al corazón añade o quita ~2 mmHg por cada cm de diferencia.",
                },
                {
                  prompt:
                    "¿Qué acción recomiendas?",
                  answer:
                    "Confirmar tamaño del brazalete, comparar en miembro contralateral y, si la diferencia persiste, confiar en la línea arterial.",
                  explanation:
                    "La línea arterial es el gold standard hemodinámico; el NIBP es útil para tendencias, no para decisiones críticas en shock.",
                },
              ],
            },
            points: 15,
            difficulty: "medium",
          },
        ],
      },
      {
        slug: "capnografia",
        title: "Capnografía",
        description:
          "Principio de absorción infrarroja de CO₂ y la curva capnográfica.",
        durationMin: 18,
        content: `## Capnografía

La **capnografía** mide la concentración de CO₂ en el gas espirado, de forma continua y no invasiva. Es estándar de monitorización en anestesia y debe confirmar la intubación endotraqueal.

### Principio físico

El CO₂ absorbe fuertemente **infrarrojo** a **4.26 µm**. La celda del capnógrafo emite IR a esa longitud de onda y mide la absorbancia mediante la ley de Beer-Lambert:

\`A = \\log_{10}\\left(\\frac{I_0}{I}\\right) = k \\cdot c \\cdot d\`

Donde \`c\` es la concentración de CO₂ y \`d\` el camino óptico.

### Tipos de muestreo

- **Mainstream**: el sensor se coloca directamente en la vía aérea. Respuesta rápida, sin retardo. Más voluminoso.
- **Sidestream**: se aspira gas por una manguera fina (50–200 mL/min) hasta una celda remota. Retardo 2–6 s. Más liviano, permite uso en paciente no intubado.

### Curva capnográfica (4 fases)

| Fase | Descripción                                  | CO₂    |
|------|----------------------------------------------|--------|
| I    | Espiración de espacio muerto (sin CO₂)       | 0      |
| II   | Transición aire-alveolar                     | ↑      |
| III  | Meseta alveolar                              | máximo |
| IV   | Inspiración                                  | ↓ a 0  |

### Valores clínicos

- **EtCO₂ normal**: 35–45 mmHg (4–6 kPa).
- **EtCO₂ ≈ PaCO₂**: diferencia normalmente 2–5 mmHg.
- **Aumento progresivo**: hipoventilación, fiebre, malfunción del ventilador.
- **Caída brusca**: desconexión del tubo, embolia pulmonar, paro circulatorio.
- **EtCO₂ = 0 tras intubación**: intubación esofágica (alarma crítica).

### Casos clásicos

- **Broncoespasmo**: meseta ascendente (no se estabiliza).
- **Curare insuficiente**: muescas en la meseta (esfuerzo del paciente).
- **Embolia gaseosa**: caída súbita de EtCO₂ sin cambios ventilatorios.

### Relación con la PaCO₂

En condiciones normales:

\`PaCO_2 - EtCO_2 \\approx 3-5 \\text{ mmHg}\`

Si la diferencia aumenta, sospechar **aumento del espacio muerto** (embolia, EPOC severo).

## Conclusión

La capnografía es la única monitorización que confirma intubación correcta y ventilación efectiva en tiempo real. Es imprescindible en anestesia y RCP avanzada.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Interpretación de EtCO₂ tras intubación",
            prompt:
              "Tras intubar a un paciente, el capnógrafo muestra EtCO₂ = 0. ¿Qué sospechas?",
            data: {
              question:
                "Inmediatamente después de intubar, no se detecta CO₂ espirado. ¿Cuál es el diagnóstico más probable?",
              options: [
                "A) El paciente tiene hiperventilación severa.",
                "B) El tubo está en esófago.",
                "C) El sensor está mal calibrado.",
                "D) El paciente tiene acidosis metabólica.",
              ],
              correctIndex: 1,
              explanation:
                "Sin CO₂ espirado tras intubación → intubación esofágica hasta demostrar lo contrario. Es la causa más grave y debe corregirse de inmediato reubicando el tubo.",
              hints: [
                "El esófago no produce CO₂.",
                "Es la alarma crítica más importante del capnógrafo.",
              ],
            },
            points: 10,
            difficulty: "easy",
          },
          {
            type: "self_assessment",
            title: "Autoevaluación: interpretación capnográfica",
            prompt:
              "Reflexiona sobre tu capacidad de interpretar curvas capnográficas en distintos escenarios.",
            data: {
              prompt:
                "¿Hasta qué punto podrías distinguir las cuatro fases de la curva capnográfica e identificar broncoespasmo, embolia e intubación esofágica?",
              rubric: [
                "Novato: reconoce la curva pero no las fases.",
                "Practicante: identifica las cuatro fases y el EtCO₂ normal.",
                "Competente: diagnostica patrones anormales comunes (broncoespasmo, desconexión).",
                "Experto: integra EtCO₂ con PaCO₂, espacio muerto y gasto cardiaco para razonamiento clínico.",
              ],
              autoGradeKeywords: [
                "EtCO₂",
                "meseta",
                "broncoespasmo",
                "embolia",
                "intubación esofágica",
                "espacio muerto",
              ],
            },
            points: 5,
            difficulty: "medium",
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // UNIDAD 4 — Equipos Terapéuticos
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: "equipos-terapeuticos",
    title: "Equipos Terapéuticos",
    summary:
      "Desfibriladores, marcapasos y electrobisturíes: principios físicos y de operación.",
    description:
      "Estudia los equipos que entregan energía eléctrica con fines terapéuticos: desfibriladores (descarga sincronizada y no sincronizada), marcapasos (modos NBG y su programación) y unidades de electrocirugía con sus modos de corte y coagulación.",
    icon: "Zap",
    color: "amber",
    lessons: [
      {
        slug: "desfibriladores",
        title: "Desfibriladores",
        description:
          "Principios de desfibrilación, formas de onda monofásica y bifásica, energía.",
        durationMin: 22,
        content: `## Desfibriladores

La **desfibrilación** consiste en aplicar un pulso eléctrico de alta energía (100–360 J) al corazón para **despolarizar simultáneamente todo el miocardio**, interrumpiendo arritmias caóticas (fibrilación ventricular, taquicardia ventricular sin pulso) y permitiendo que el nódulo sinusal retome el control.

### Componentes

1. **Batería** (24 V, NiCd o Li-ion).
2. **Conversor DC-DC**: sube el voltaje a 1500–5000 V.
3. **Banco de condensadores**: almacena la energía seleccionada.
4. **Inductor**: da forma a la onda (trapezoidal).
5. **Conmutador de polaridad**: invierte la polaridad en bifásicos.
6. **Paletas o parches**: entregan la energía al tórax.

### Energía y carga

\`E = \\frac{1}{2} C V^2\`

Con \`C = 100 \\, \\mu F\` y \`V = 2000 \\, V\`:

\`E = 0.5 \\cdot 100e-6 \\cdot 2000^2 = 200 \\, J\`

### Formas de onda

- **Monofásica amortiguada (Lown)**: una sola fase, ~5 ms, 360 J. Obsoleta.
- **Bifásica truncada**: dos fases de polaridad opuesta, 3–10 ms, **150–200 J**. Más eficaz, menor daño miocárdico.

### Por qué bifásica

La segunda fase remueve la carga residual de la primera, **reduciendo la despolarización persistente** y mejorando la efectividad con menor energía. Esto disminuye:
- Daño térmico miocárdico.
- Disfunción post-desfibrilación.
- Tamaño de la batería.

### Desfibrilación vs cardioversión

- **Desfibrilación**: asíncrona (inmediata), para FV o TV sin pulso.
- **Cardioversión**: **sincronizada** con la onda R (evita el período vulnerable de la onda T), para TV con pulso, flutter, FA.

### Riesgos y seguridad

- Riesgo de **arco eléctrico** si las paletas están mal aplicadas o hay gel insuficiente.
- Riesgo para el operador: usar guantes secos, **nadie toca al paciente** durante la descarga.
- Entorno con oxígeno: **retirar fuentes de O₂** para evitar ignición.

### Mantenimiento

- Descarga de prueba diaria (interno) a 50 J con paletas cortocircuitadas.
- Verificación de batería.
- Calibración anual de energía entregada (±4 J o ±15%).

## Conclusión

La desfibrilación temprana es **la intervención que más impacto tiene** en sobrevida de paro cardiaco. La onda bifásica es hoy el estándar por su eficacia y seguridad.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Cardioversión vs desfibribrilación",
            prompt:
              "¿Cuándo se aplica cardioversión sincronizada y cuándo desfibrilación?",
            data: {
              question:
                "¿Para cuál de los siguientes ritmos se indica cardioversión sincronizada?",
              options: [
                "A) Fibrilación ventricular.",
                "B) Taquicardia ventricular sin pulso.",
                "C) Taquicardia ventricular con pulso y compromiso hemodinámico.",
                "D) Asistolia.",
              ],
              correctIndex: 2,
              explanation:
                "La cardioversión sincronizada entrega la descarga sobre la onda R, evitando el período vulnerable de la onda T (donde podría inducir FV). Se usa en TV con pulso, flutter y FA inestables.",
              hints: [
                "Sincronizada = busca la onda R.",
                "FV y asistolia no tienen onda R usable.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
          {
            type: "progressive_exercise",
            title: "Cálculo de energía y capacitancia",
            prompt:
              "Calcula los parámetros eléctricos del banco de condensadores del desfibrilador.",
            data: {
              levels: [
                {
                  prompt:
                    "Nivel 1: ¿Qué voltaje se requiere en un capacitor de 100 µF para almacenar 200 J?",
                  answer: "2000 V",
                  explanation:
                    "E = ½CV² → V = √(2E/C) = √(2·200/100e-6) = √4e6 = 2000 V.",
                },
                {
                  prompt:
                    "Nivel 2: Si se reduce la energía a 150 J, ¿cuál es el nuevo voltaje?",
                  answer: "≈ 1732 V",
                  explanation:
                    "V = √(2·150/100e-6) = √3e6 ≈ 1732 V.",
                },
                {
                  prompt:
                    "Nivel 3: Si la impedancia transtorácica es 75 Ω y la onda dura 5 ms con corriente constante, ¿cuál es la corriente aproximada para 200 J?",
                  answer: "≈ 23 A",
                  explanation:
                    "E = I²·R·t → I = √(E/(R·t)) = √(200/(75·5e-3)) ≈ √533 ≈ 23 A.",
                },
              ],
            },
            points: 20,
            difficulty: "hard",
          },
        ],
      },
      {
        slug: "marcapasos",
        title: "Marcapasos",
        description:
          "Indicaciones, modos NBG, generador de pulso y tipos de electrodo.",
        durationMin: 22,
        content: `## Marcapasos

El **marcapasos cardiaco artificial** entrega estímulos eléctricos al miocardio cuando el sistema de conducción intrínseco falla. Indicaciones principales: bradicardia sintomática, bloqueo AV completo, disfunción sinusal.

### Componentes

1. **Generador de pulso**: batería (Li-I₂), circuito de control, telemetría.
2. **Cables-electrodos**: transmiten el pulso al corazón y sensan la actividad intrínseca.
3. **Programador externo**: configura parámetros por telemetría inductiva o RF.

### Código NBG (NASPE/BPEG)

\`\\text{Posición 1} - \\text{Posición 2} - \\text{Posición 3} - \\text{Posición 4} - \\text{Posición 5}\`

| Posición | Significado                  | Valores                 |
|----------|------------------------------|-------------------------|
| 1        | Cámara estimulada            | O, A, V, D              |
| 2        | Cámara sensada               | O, A, V, D              |
| 3        | Respuesta al sensado         | O, I, T, D              |
| 4        | Programable/telemetría       | R                       |
| 5        | Antitaquicardia              | O, P, S, D              |

(Letras: **O**=ninguno, **A**=aurícula, **V**=ventrículo, **D**=dual, **I**=inhibido, **T**=disparado, **R**=rate-modulated, **P**=anti-taqui pacing, **S**=shock, **D**=dual.)

### Modos comunes

- **VVI**: estimula ventrículo, sensa ventrículo, inhibe al sensar. Para FA con bradicardia.
- **DDD**: estimula y sensa ambas cámaras, dual. Bradi sinusal y bloqueo AV.
- **AAI**: solo aurícula, indicado en disfunción sinusal con conducción AV intacta.

### Parámetros programables

| Parámetro          | Valor típico           |
|--------------------|------------------------|
| Frecuencia basal   | 60–80 lpm              |
| Energía de pulso   | 0.5–5 V, 0.4 ms        |
| Sensibilidad       | 2–5 mV (ventrículo)    |
| Período refractario| 250–350 ms             |
| Histeresis         | 60 lpm                 |

### Tipo de electrodo

- **Unipolar**: la punta del electrodo es cátodo y la carcasa del generador es ánodo. Mayor sensibilidad, más susceptible a interferencia.
- **Bipolar**: ambos polos en el electrodo. Menos interferencia, estándar actual.

### Fijación

- **Activa**: hélice roscada al miocardio. Estable de inmediato.
- **Pasiva**: aletas que se enclavan en trabéculas. Más rápida de colocar.

### Complicaciones

- **Síndrome de marcapasos** (VVI en paciente con función sinusal): pérdida de sincronía AV → bajo gasto.
- **Estimulación del nervio frénico** o muscular.
- **Exit block**: umbral de estimulación sube por fibrosis.
- **Twiddler's syndrome**: el paciente rota el generador, desplazando el cable.

## Conclusión

El marcapasos es terapéutico y personalizado: cada paciente tiene un modo y parámetros óptimos. La telemetría permite ajustes finos durante toda la vida del dispositivo.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Selección de modo NBG",
            prompt:
              "Para un paciente con bloqueo AV completo y función sinusal normal, ¿qué modo NBG eliges?",
            data: {
              question:
                "¿Cuál es el modo más apropiado para bloqueo AV completo con función sinusal conservada?",
              options: [
                "A) VVI",
                "B) AAI",
                "C) DDD",
                "D) VOO",
              ],
              correctIndex: 2,
              explanation:
                "DDD permite estimular y sensar ambas cámaras: aprovecha el impulso sinusal del paciente y estimula el ventrículo cuando el bloqueo AV impide la conducción. Mantiene sincronía AV.",
              hints: [
                "Necesitas sensar y estimular ambas cámaras.",
                "Función sinusal presente → conviene aprovecharla.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
          {
            type: "case_analysis",
            title: "Síndrome de marcapasos",
            prompt:
              "Analiza un caso de paciente con marcapasos y síntomas de bajo gasto.",
            data: {
              case:
                "Paciente de 78 años con marcapasos VVI implantado hace 6 meses por FA bradicárdica. Consulta por mareo, fatiga y edema maleolar. En el interrogatorio del dispositivo: frecuencia 100% estimulada, batería y umbrales normales.",
              questions: [
                {
                  prompt:
                    "¿Cuál es la hipótesis diagnóstica más probable?",
                  answer: "Síndrome de marcapasos por pérdida de sincronía AV.",
                  explanation:
                    "En VVI el ventrículo se estimula sin coordinación con la contracción auricular, lo que reduce el llenado ventricular (pérdida del 'kick' auricular) y el gasto cardiaco, especialmente en ancianos.",
                },
                {
                  prompt:
                    "¿Qué cambio de modo sugerirías evaluar?",
                  answer:
                    "Upgrade a VDD o DDD si se restaura ritmo sinusal, o mantener VVI con optimización si la FA es persistente.",
                  explanation:
                    "Si el paciente está en FA permanente, VVI es razonable; el síndrome se maneja con control de frecuencia y manejo de volumen. Si hay ritmo sinusal, DDD mejora la sincronía AV.",
                },
                {
                  prompt:
                    "¿Qué parámetro de telemetría revisas además de los umbrales?",
                  answer:
                    "Porcentaje de estimulación vs sensado, histeresis y respuesta de frecuencia.",
                  explanation:
                    "Un alto porcentaje de estimulación con síntomas sugiere falta de aprovechamiento del ritmo intrínseco. La histeresis y rate response pueden mitigar parcialmente.",
                },
              ],
            },
            points: 15,
            difficulty: "hard",
          },
        ],
      },
      {
        slug: "electrocirugia",
        title: "Electrocirugía",
        description:
          "Principios RF, modos de corte y coagulación, placa del paciente y prevención de quemaduras.",
        durationMin: 20,
        content: `## Electrocirugía

La **unidad electroquirúrgica (UEQ)** corta y coagula tejido usando corriente alterna de **alta frecuencia** (300 kHz – 3 MHz). A estas frecuencias, las células se despolarizan tan rápido que **no provocan contracción muscular ni fibrilación** (que requieren < 1 kHz).

### Densidad de corriente: la clave

El efecto térmico depende de la **densidad de corriente** \`J = I/A\`:

- En el **electrodo activo** (punta, ~1 mm²): \`J\` enorme → calor intenso → corte/coagulación.
- En la **placa neutra** (~200 cm²): \`J\` baja → no calienta.

### Fórmula del calentamiento

\`P = I^2 \\cdot R \\quad ; \\quad \\Delta T \\propto \\frac{P \\cdot t}{m \\cdot c}\`

### Modos básicos

| Modo           | Forma de onda            | Efecto                              |
|----------------|--------------------------|-------------------------------------|
| Corte puro     | Senoidal continua        | Vaporización celular rápida.        |
| Corte coagulante| Senoidal modulada       | Corte con hemostasia.               |
| Coagulación    | Trenes de pulsos         | Desecación y sello vascular.        |
| Fulguración    | Chispa sin contacto     | Carbonización superficial.          |

### Placa neutra (electrodo dispersivo)

- Colocación sobre **músculo bien perfundido** (muslo, glúteo).
- **Lejos del hueso** y de implantes metálicos.
- En pacientes con **marcapasos**: colocar placa lejos del generador y usar modo bipolar si es posible.

### Riesgos y seguridad

1. **Quemadura en el sitio de la placa**: por despegamiento parcial o excesiva impedancia de contacto.
2. **Quemaduras en puntos de contacto alternativos**: si la placa se desconecta, la corriente regresa por catéteres, electrodos ECG o medios de contraste → quemaduras graves.
3. **Interferencia con marcapasos**: puede inhibir o causar arritmias.
4. **Incendio en quirófano**: con O₂ y alcohol.

### Sistemas modernos

- **Monitoreo de contacto**: mide impedancia de placa y desconecta si supera umbral.
- **Generador con retorno segmentado**: si una mitad de la placa se despega, corta la energía.
- **Bipolar**: corriente circula entre dos puntas de una pinza (no requiere placa), usado en neurocirugía y microcirugía.

### Mantenimiento

- Verificación de cables y conectores antes de cada cirugía.
- Inspección de la placa: una sola использования (desechable).
- Calibración anual de potencia de salida.

## Conclusión

La electrocirugía es segura porque la **alta frecuencia** evita efectos neuromusculares y porque la **diferencia de densidad de corriente** entre electrodo activo y placa concentra el calor solo en el sitio quirúrgico. La falla de la placa es la causa más común de quemaduras graves.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Densidad de corriente y placa",
            prompt:
              "¿Por qué la placa del electrobisturí no causa quemaduras al paciente?",
            data: {
              question:
                "¿Qué principio físico hace que la placa neutra sea segura para el paciente?",
              options: [
                "A) La placa es de material aislante.",
                "B) La baja densidad de corriente por su gran área disipa el calor.",
                "C) La corriente que pasa por la placa es menor que por el electrodo activo.",
                "D) La placa se refrigera activamente.",
              ],
              correctIndex: 1,
              explanation:
                "La corriente total es la misma en electrodo y placa (corriente en serie), pero la densidad J = I/A es enorme en el electrodo (corte) y muy baja en la placa (sin calentamiento). Es la diferencia de área lo que garantiza la seguridad.",
              hints: [
                "Misma corriente, distinta área.",
                "J = I/A.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
          {
            type: "guided_problem",
            title: "Cálculo de densidad de corriente",
            prompt:
              "Calcula densidades de corriente en electrodo activo y placa.",
            data: {
              scenario:
                "Un electrobisturí entrega 400 W a 500 kHz. El electrodo activo tiene 1 mm² y la placa 200 cm².",
              steps: [
                {
                  prompt:
                    "Paso 1: Supón 200 Vrms aplicados y estima la corriente total.",
                  answer: "I = P/V = 400/200 = 2 A",
                  hint: "Potencia / voltaje.",
                },
                {
                  prompt:
                    "Paso 2: Convierte áreas a m².",
                  answer:
                    "Activo: 1 mm² = 1×10⁻⁶ m². Placa: 200 cm² = 0.02 m².",
                  hint: "1 mm² = 1e-6 m²; 1 cm² = 1e-4 m².",
                },
                {
                  prompt:
                    "Paso 3: Calcula densidad en electrodo activo.",
                  answer: "J_act = 2 / 1e-6 = 2×10⁶ A/m²",
                  hint: "I / A.",
                },
                {
                  prompt:
                    "Paso 4: Calcula densidad en la placa y compara.",
                  answer: "J_placa = 2 / 0.02 = 100 A/m² (factor 20000× menor)",
                  hint: "Cociente entre activo y placa.",
                },
              ],
              finalAnswer:
                "J activo = 2×10⁶ A/m² ; J placa = 100 A/m². Diferencia de 20000× que justifica el corte local y la inocuidad de la placa.",
              explanation:
                "Esta diferencia de cuatro órdenes de magnitud es la base de toda la seguridad de la electrocirugía.",
            },
            points: 15,
            difficulty: "medium",
          },
        ],
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // UNIDAD 5 — Seguridad Eléctrica Clínica
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: "seguridad-electrica",
    title: "Seguridad Eléctrica Clínica",
    summary:
      "Riesgos eléctricos, sistemas de tierra y aislamiento, y la normativa IEC 60601.",
    description:
      "Aborda la seguridad eléctrica en el entorno clínico: macroshock y microshock, sistemas de tierra y de aislamiento (IT), monitores de aislamiento de línea, y la familia de normas IEC 60601 que regula los equipos electromédicos.",
    icon: "ShieldCheck",
    color: "violet",
    lessons: [
      {
        slug: "riesgos-electricos-clinica",
        title: "Riesgos Eléctricos en Clínica",
        description:
          "Macroshock vs microshock, umbrales de fibrilación y mecanismos de lesión.",
        durationMin: 18,
        content: `## Riesgos Eléctricos en Clínica

En el ambiente hospitalario coexisten pacientes, equipos electromédicos y red eléctrica. El riesgo eléctrico se clasifica en dos categorías:

### Macroshock

Contacto externo del cuerpo con una fuente eléctrica. La corriente se distribuye por todo el cuerpo.

| Corriente (60 Hz) | Efecto                        |
|-------------------|-------------------------------|
| 1 mA              | Umbral de percepción          |
| 10–20 mA          | Contracción muscular (tetania)|
| 50–100 mA         | Umbral de fibrilación ventricular |
| > 1 A             | Quemaduras graves             |

### Microshock

Es el riesgo específico del paciente con **acceso directo al corazón**: catéteres, electrodos intracardiacos, sondas con fluidos conductores. El umbral de fibrilación cae drásticamente a **10 µA** — miles de veces menor que el macroshock.

### Modelo eléctrico del microshock

Si un equipo tiene una corriente de fuga de 100 µA hacia tierra, y el paciente tiene un catéter intracardiaco conectado a tierra por fluidos:

\`I_{micro} = I_{fuga} \\cdot \\frac{R_{eq,\\,ruta}}{R_{total}}\`

Aún fracciones de esa fuga pueden generar **corrientes de 10–50 µA directamente sobre el miocardio**, suficientes para fibrilar.

### Período vulnerable

El corazón es particularmente sensible durante la **onda T** (repolarización). Una corriente de 10 µA en ese instante puede precipitar FV.

### Fuentes de riesgo

- **Corriente de fuga de carcasa**: por capacitancias parásitas entre el primario del transformador y la tierra.
- **Falla de aislamiento**: cable interno roto en contacto con la carcasa.
- **Diferencia de potencial entre tierras**: entre dos equipos conectados a distintos circuitos.
- **Acoplamiento capacitivo**: en monitores con electrodos sin aislamiento.

### Clasificación por ambiente

| Área           | Riesgo principal | Equipo requerido       |
|----------------|------------------|------------------------|
| Habitación     | Macroshock       | Clase I, tipo BF       |
| UCI / Sala curación | Macroshock + microshock | Clase I CF, tierra equipotencial |
| Quirófano / Hemodinamia | Microshock | Sistema IT, LIM, tierra equipotencial |

## Conclusión

El microshock es el peligro silencioso: invisible, indoloro y mortal en microamperios. Diseñar y mantener instalaciones electromédicas seguras es tarea de ingeniería clínica, no solo de electricistas.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Umbral de microshock",
            prompt:
              "¿Cuál es el umbral aproximado de fibrilación ventricular por microshock?",
            data: {
              question:
                "¿A partir de qué corriente se considera riesgo de fibrilación por microshock en pacientes con catéter intracardiaco?",
              options: [
                "A) 1 mA",
                "B) 100 µA",
                "C) 10 µA",
                "D) 1 µA",
              ],
              correctIndex: 2,
              explanation:
                "El umbral de fibrilación por microshock es ~10 µA, porque la corriente se concentra directamente en el miocardio, saltando la resistencia de la piel.",
              hints: [
                "Es miles de veces menor que el macroshock.",
                "La piel ya no protege.",
              ],
            },
            points: 10,
            difficulty: "easy",
          },
          {
            type: "case_analysis",
            title: "Investigación de incidente en hemodinamia",
            prompt:
              "Investiga una fibrilación ventricular inexplicada durante un cateterismo.",
            data: {
              case:
                "Durante un cateterismo cardiaco, el paciente fibrila súbitamente al conectar el cable de ECG de un segundo monitor. El primer monitor y la mesa eran de un sistema IT con LIM. El segundo monitor estaba enchufado a un tomacorriente estándar de la sala.",
              questions: [
                {
                  prompt:
                    "¿Cuál es la causa más probable de la fibrilación?",
                  answer:
                    "Microshock por diferencia de potencial entre tierras de los dos monitores, acoplado al paciente por el catéter.",
                  explanation:
                    "El segundo monitor (sin aislamiento CF ni tierra equipotencial) introduce una corriente de fuga que busca retorno a través del catéter intracardiaco del paciente.",
                },
                {
                  prompt:
                    "¿Qué falla en el procedimiento lo permitió?",
                  answer:
                    "Conectar un equipo no certificado para el área (debe ser CF y conectado al sistema IT monitoreado).",
                  explanation:
                    "En hemodinamia todo equipo debe ser Clase I CF y conectado al sistema IT con LIM activo. La mezcla con circuitos estándar rompe la equipotencialidad.",
                },
                {
                  prompt:
                    "¿Qué medida correctiva recomiendas?",
                  answer:
                    "Revisar todo el panel eléctrico de hemodinamia, verificar LIM, re-certificar equipos como CF y capacitar al personal en protocolo de conexión.",
                  explanation:
                    "La medida estructural es restringir el área a equipos CF y circuitos IT exclusivos. La medida operativa es protocolo escrito y capacitación.",
                },
              ],
            },
            points: 20,
            difficulty: "hard",
          },
        ],
      },
      {
        slug: "sistemas-tierra-aislamiento",
        title: "Sistemas de Tierra y Aislamiento",
        description:
          "Tierra equipotencial, sistema IT, monitor de aislamiento de línea (LIM).",
        durationMin: 20,
        content: `## Sistemas de Tierra y Aislamiento

### Sistema TN (estándar doméstico)

La red eléctrica domiciliaria es **TN-S** o **TN-C-S**: el neutro está **puesto a tierra** en el transformador. Una falla a carcasa genera una corriente de cortocircuito que dispara el magnetotérmico. La mayoría de las áreas no críticas del hospital usan TN.

### Sistema IT (quirófano, UCI crítica)

En áreas de cuidado crítico se usa el **sistema IT médico**:

- El **neutro no está puesto a tierra** (o lo está por alta impedancia).
- La carcasa de los equipos sí está conectada a tierra.
- Si ocurre una **primera falla**, no hay cortocircuito, el equipo sigue funcionando → continuidad asistencial.
- El **LIM (Line Isolation Monitor)** detecta la falla y da alarma sin cortar energía.

### ¿Por qué IT en quirófano?

1. **Continuidad**: una falla no interrumpe la cirugía.
2. **Seguridad**: la corriente de fuga a tierra es ínfima (sólo capacitiva).
3. **Bajo riesgo de microshock**: no hay retorno por tierra que pase por el paciente.

### LIM (Line Isolation Monitor)

Mide continuamente la **impedancia total** entre las líneas IT y tierra. Si baja de un umbral (típicamente corresponde a **5 mA** de fuga hipotética), genera alarma audible y visual **sin cortar la energía**. El equipo permite terminar el procedimiento y luego reparar.

### Tierra equipotencial (PE)

Toda masa metálica accesible en el área (cama, lámpara, mesa, bandeja) se conecta a un **punto equipotencial común**. La diferencia de potencial entre cualquier par debe ser **< 100 mV** en condiciones normales.

### Conexión equipotencial del paciente

La cama del paciente en UCI/quirófano tiene un **terminal de tierra para paciente** que se conecta a la barra equipotencial, reduciendo la diferencia de potencial entre equipos a < 20 mV.

### Corrientes de fuga

| Tipo de fuga              | Límite (IEC 60601) |
|---------------------------|---------------------|
| Fuga de tierra            | 500 µA              |
| Fuga de carcasa           | 500 µA              |
| Fuga a paciente (BF)      | 100 µA              |
| Fuga a paciente (CF)      | 10 µA               |

### Mantenimiento

- **Anual**: verificación de corrientes de fuga en cada equipo.
- **Semestral**: prueba del LIM con resistencia calibrada.
- **Tras instalación**: medición de impedancia equipotencial.

## Conclusión

El sistema IT médico y la tierra equipotencial convierten el quirófano en un recinto donde la primera falla eléctrica no mata ni interrumpe. Es uno de los pilares de la ingeniería clínica moderna.`,
        activities: [
          {
            type: "guided_problem",
            title: "Verificación de corriente de fuga de paciente",
            prompt:
              "Calcula la corriente de fuga a paciente y verifica conformidad con IEC 60601.",
            data: {
              scenario:
                "Un equipo de medición reporta 75 µA de corriente de fuga a paciente en un monitor de UCI clasificado como BF. El límite IEC 60601 para BF es 100 µA.",
              steps: [
                {
                  prompt:
                    "Paso 1: Identifica el tipo de parte aplicada (BF o CF).",
                  answer: "BF (Body Floating)",
                  hint: "Revisa la clasificación del equipo.",
                },
                {
                  prompt:
                    "Paso 2: Compara con el límite de la norma.",
                  answer: "75 µA < 100 µA → conforme.",
                  hint: "El límite BF es 100 µA.",
                },
                {
                  prompt:
                    "Paso 3: ¿Es apto para uso intracardiaco?",
                  answer: "No, se requiere equipo CF con límite de 10 µA.",
                  hint: "Microshock exige CF.",
                },
              ],
              finalAnswer:
                "El equipo BF está dentro de norma para uso externo, pero no para procedimientos intracardiacos. Para esos se requiere CF con fuga ≤ 10 µA.",
              explanation:
                "La clasificación BF permite contacto externo; CF es obligatoria para conexiones eléctricas directas al corazón.",
            },
            points: 15,
            difficulty: "medium",
          },
          {
            type: "multiple_choice",
            title: "Función del LIM",
            prompt:
              "¿Qué hace el monitor de aislamiento de línea (LIM) ante una falla en sistema IT?",
            data: {
              question:
                "En un sistema IT médico, ¿cuál es la respuesta del LIM ante la primera falla a tierra?",
              options: [
                "A) Corta la energía inmediatamente.",
                "B) Genera una alarma audible y visual sin cortar energía.",
                "C) Aumenta la impedancia del sistema.",
                "D) Pone el neutro a tierra automáticamente.",
              ],
              correctIndex: 1,
              explanation:
                "El LIM detecta la pérdida de aislamiento pero NO corta energía: garantiza continuidad asistencial para terminar el procedimiento. La alarma avisa al equipo para corregir la falla después.",
              hints: [
                "El sistema IT está pensado para seguir funcionando.",
                "Cortar energía en medio de una cirugía sería catastrófico.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
        ],
      },
      {
        slug: "normativa-iec-60601",
        title: "Normativa IEC 60601",
        description:
          "Familia de normas, clasificación B/BF/CF y ensayos de seguridad eléctrica.",
        durationMin: 22,
        content: `## Normativa IEC 60601

La **IEC 60601** es la familia de normas internacionales que rige la **seguridad y desempeño esencial** de los equipos electromédicos. En Chile es referenciada por el ISP y por el Sistema Nacional de Acreditación.

### Estructura

- **IEC 60601-1**: requisitos generales de seguridad (base).
- **60601-1-2**: compatibilidad electromagnética (EMC).
- **60601-1-6**: usabilidad.
- **60601-1-8**: alarmas.
- **60601-2-XX**: normas particulares por equipo (p. ej. 60601-2-27 para monitores ECG, 60601-2-49 para multicalibradores).

### Definición de equipo electromédico

> Aparato eléctrico, provisto de no más de una conexión a una red de alimentación, destinado a diagnosticar, tratar o vigilar al paciente bajo supervisión médica, y que tiene contacto físico con el paciente o transfiere energía.

### Clasificación por protección eléctrica

| Clase   | Protección principal                 |
|---------|--------------------------------------|
| Clase I | Tierra de protección + aislamiento básico |
| Clase II| Doble aislamiento, sin tierra        |
| Clase III| Alimentación por seguridad extra-baja (SELV) |

### Clasificación de partes aplicadas

| Tipo | Contacto                          | Límite de fuga a paciente |
|------|-----------------------------------|---------------------------|
| B    | Contacto externo, no cardíaco     | 100 µA                    |
| BF   | Contacto externo, aislado         | 100 µA                    |
| CF   | Contacto directo al corazón        | 10 µA                     |

### Ensados de seguridad eléctrica

1. **Continuidad del conductor de protección**: resistencia < 0.1 Ω entre carcasa y pin de tierra.
2. **Resistencia de aislamiento**: > 2 MΩ a 500 V DC.
3. **Corriente de fuga de tierra**: < 500 µA.
4. **Corriente de fuga de carcasa**: < 500 µA (normal), < 1 mA (condición única falla).
5. **Corriente de fuga a paciente**: según tipo B/BF/CF.

### Calibración vs verificación

- **Verificación eléctrica**: anual, por ingeniería clínica.
- **Calibración metrológica**: según equipo (ECG anual, NIBP semestral, ventilador trimestral).
- **Trazabilidad**: debe existir cadena hasta patrones nacionales (NIST, CEM).

### Documentación obligatoria

- Manual de usuario en español.
- Hoja de datos de seguridad eléctrica.
- Registro de mantenimiento preventivo.
- Certificado de conformidad (FCC/CE/INVIMA/ISP).

### Señalización

El equipo debe llevar:
- Marcaje CE con número de organismo notificado.
- Símbolo de clase (cuadrado con línea para Clase II).
- Símbolo de parte aplicada (B, BF o CF con su sigla).
- Símbolo de "tipo BF/CF desfibrylador" si aplica.
- IP de protección contra ingreso (ej. IPX4).

## Conclusión

IEC 60601 es el lenguaje común entre fabricantes, hospitales y autoridades. Conocer sus límites y ensayos permite evaluar, comprar y mantener equipos electromédicos con criterio de ingeniería clínica.`,
        activities: [
          {
            type: "multiple_choice",
            title: "Clasificación de partes aplicadas",
            prompt:
              "¿Qué tipo de parte aplicada se exige para catéteres intracardiacos?",
            data: {
              question:
                "Un equipo que se conecta directamente al corazón del paciente debe clasificarse como:",
              options: [
                "A) Tipo B",
                "B) Tipo BF",
                "C) Tipo CF",
                "D) Clase II",
              ],
              correctIndex: 2,
              explanation:
                "El tipo CF (Cardiac Floating) está diseñado para contacto directo al corazón. Su límite de corriente de fuga a paciente es 10 µA, diez veces menor que BF, para evitar microshock.",
              hints: [
                "Busca el tipo específico para corazón.",
                "Es el límite más estricto.",
              ],
            },
            points: 10,
            difficulty: "medium",
          },
          {
            type: "progressive_exercise",
            title: "Plan de verificación eléctrica de un monitor multiparámetro",
            prompt:
              "Planifica la verificación eléctrica anual de un monitor multiparámetro de UCI.",
            data: {
              levels: [
                {
                  prompt:
                    "Nivel 1: Indica los cuatro ensayos eléctricos mínimos a realizar.",
                  answer:
                    "Continuidad de tierra, resistencia de aislamiento, fuga de tierra, fuga de carcasa (y fuga a paciente si es CF).",
                  explanation:
                    "Son los cuatro ensayos fundamentales de IEC 60601-1 para certificar seguridad eléctrica.",
                },
                {
                  prompt:
                    "Nivel 2: Para cada uno, indica el valor de aceptación.",
                  answer:
                    "Continuidad <0.1 Ω; aislamiento >2 MΩ; fuga tierra <500 µA; fuga carcasa <500 µA; fuga paciente <10 µA (CF).",
                  explanation:
                    "Estos son los umbrales especificados por la norma IEC 60601-1 en condición normal.",
                },
                {
                  prompt:
                    "Nivel 3: Si la fuga de tierra da 1.2 mA, ¿qué decides?",
                  answer:
                    "Retirar de servicio, abrir reporte de no conformidad y revisar fuente / filtros EMI / cable de alimentación.",
                  explanation:
                    "Una fuga 2.4× el límite indica falla activa que puede lesionar al paciente o al operador. El equipo no debe volver a uso clínico hasta corregirse.",
                },
              ],
            },
            points: 20,
            difficulty: "hard",
          },
          {
            type: "self_assessment",
            title: "Autoevaluación: seguridad eléctrica",
            prompt:
              "Reflexiona sobre tu capacidad para auditar la seguridad eléctrica de equipos electromédicos.",
            data: {
              prompt:
                "¿Hasta qué punto podrías liderar una auditoría de seguridad eléctrica conforme a IEC 60601-1 en un hospital?",
              rubric: [
                "Novato: identifica los tipos B/BF/CF pero no los ensayos asociados.",
                "Practicante: conoce los ensayos y límites, pero no decide acciones correctivas.",
                "Competente: planifica auditorías, ejecuta ensayos y emite informe técnico.",
                "Experto: diseña programas de mantenimiento predictivo y conformidad normativa.",
              ],
              autoGradeKeywords: [
                "IEC 60601",
                "fuga de tierra",
                "500 µA",
                "10 µA",
                "CF",
                "BF",
                "LIM",
                "continuidad",
              ],
            },
            points: 5,
            difficulty: "medium",
          },
        ],
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed - Electromedicina II (UV)");

  // 1. Limpieza (orden respetando relaciones; SQLite hace cascade pero igual)
  console.log("🧹 Limpiando base de datos...");
  await db.userBadge.deleteMany();
  await db.selfAssessment.deleteMany();
  await db.studySession.deleteMany();
  await db.chatMessage.deleteMany();
  await db.attempt.deleteMany();
  await db.progress.deleteMany();
  await db.activity.deleteMany();
  await db.lesson.deleteMany();
  await db.unit.deleteMany();
  await db.badge.deleteMany();
  await db.user.deleteMany();
  console.log("   ✔ BD limpia");

  // 2. Badges
  console.log("🏆 Creando badges...");
  const badgeMap: Record<string, { id: string }> = {};
  for (const b of BADGES) {
    const created = await db.badge.create({ data: { ...b } });
    badgeMap[b.slug] = created;
    console.log(`   • ${created.name} [${b.tier}]`);
  }

  // 3. Usuarios
  console.log("👥 Creando usuarios...");
  const userMap: Record<string, { id: string }> = {};
  for (const u of USERS) {
    const created = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        points: u.points,
        streak: u.streak,
        lastActive: u.lastActive,
      },
    });
    userMap[u.email] = created;
    console.log(`   • ${created.name} (${u.role}) — ${u.points} pts`);
  }

  // 4. Unidades + Lecciones + Actividades
  console.log("📚 Creando unidades, lecciones y actividades...");
  const unitMap: Record<string, { id: string }> = {};
  const lessonMap: Record<string, { id: string; unitId: string }> = {};
  const activityMap: Record<string, { id: string; lessonId: string }> = {};

  let totalLessons = 0;
  let totalActivities = 0;

  UNITS.forEach((u, i) => (u as any).order = i + 1);

  for (const u of UNITS) {
    const unit = await db.unit.create({
      data: {
        slug: u.slug,
        title: u.title,
        summary: u.summary,
        description: u.description,
        icon: u.icon,
        color: u.color,
        order: (u as any).order,
      },
    });
    unitMap[u.slug] = unit;
    console.log(`   ▸ Unidad: ${u.title}`);

    for (let li = 0; li < u.lessons.length; li++) {
      const lessonSpec = u.lessons[li];
      const lesson = await db.lesson.create({
        data: {
          unitId: unit.id,
          slug: lessonSpec.slug,
          title: lessonSpec.title,
          description: lessonSpec.description,
          content: lessonSpec.content,
          durationMin: lessonSpec.durationMin,
          order: li + 1,
        },
      });
      lessonMap[`${u.slug}:${lessonSpec.slug}`] = {
        id: lesson.id,
        unitId: unit.id,
      };
      totalLessons++;

      for (let ai = 0; ai < lessonSpec.activities.length; ai++) {
        const a = lessonSpec.activities[ai];
        const created = await db.activity.create({
          data: {
            lessonId: lesson.id,
            type: a.type,
            title: a.title,
            prompt: a.prompt,
            data: j(a.data),
            points: a.points,
            difficulty: a.difficulty,
            order: ai + 1,
          },
        });
        activityMap[`${u.slug}:${lessonSpec.slug}:${ai}`] = {
          id: created.id,
          lessonId: lesson.id,
        };
        totalActivities++;
      }
    }
  }
  console.log(`   ✔ ${totalLessons} lecciones, ${totalActivities} actividades`);

  // 5. Progreso por estudiante y unidad
  console.log("📊 Creando registros de progreso...");
  const studentsEmails = [
    "camila.rojas@uv.cl",
    "matias.soto@uv.cl",
    "fernanda.vega@uv.cl",
    "tomas.munoz@uv.cl",
  ];

  // Configuración de progreso por estudiante (maestría 0-100)
  // Camila (alta), Matías (media-alta), Fernanda (media), Tomás (baja)
  const progressConfig: Record<string, Record<string, { completed: number; mastery: number }>> = {
    "camila.rojas@uv.cl": {
      "biosenales-electrodos": { completed: 8, mastery: 92 },
      "electrocardiografia": { completed: 6, mastery: 88 },
      "monitoreo-pacientes": { completed: 5, mastery: 80 },
      "equipos-terapeuticos": { completed: 4, mastery: 70 },
      "seguridad-electrica": { completed: 5, mastery: 85 },
    },
    "matias.soto@uv.cl": {
      "biosenales-electrodos": { completed: 6, mastery: 75 },
      "electrocardiografia": { completed: 5, mastery: 78 },
      "monitoreo-pacientes": { completed: 4, mastery: 65 },
      "equipos-terapeuticos": { completed: 2, mastery: 50 },
      "seguridad-electrica": { completed: 1, mastery: 30 },
    },
    "fernanda.vega@uv.cl": {
      "biosenales-electrodos": { completed: 5, mastery: 70 },
      "electrocardiografia": { completed: 4, mastery: 68 },
      "monitoreo-pacientes": { completed: 3, mastery: 55 },
      "equipos-terapeuticos": { completed: 1, mastery: 40 },
      "seguridad-electrica": { completed: 0, mastery: 0 },
    },
    "tomas.munoz@uv.cl": {
      "biosenales-electrodos": { completed: 2, mastery: 35 },
      "electrocardiografia": { completed: 1, mastery: 25 },
      "monitoreo-pacientes": { completed: 0, mastery: 0 },
      "equipos-terapeuticos": { completed: 0, mastery: 0 },
      "seguridad-electrica": { completed: 0, mastery: 0 },
    },
  };

  for (const email of studentsEmails) {
    const userId = userMap[email].id;
    for (const unit of UNITS) {
      const cfg = progressConfig[email][unit.slug];
      const total = unit.lessons.reduce(
        (acc, l) => acc + l.activities.length,
        0,
      );
      await db.progress.create({
        data: {
          userId,
          unitId: unitMap[unit.slug].id,
          completed: cfg.completed,
          total,
          mastery: cfg.mastery,
          lastVisited: daysAgo(Math.floor(Math.random() * 10) + 1),
        },
      });
    }
  }
  console.log("   ✔ Progreso creado para 4 estudiantes × 5 unidades");

  // 6. Intentos (Attempts)
  console.log("✍️ Creando intentos...");
  let attemptsCount = 0;

  // Función auxiliar para crear intento
  const makeAttempt = async (
    userEmail: string,
    activityKey: string,
    answer: string,
    correct: boolean,
    score: number,
    feedback: string,
    timeSpent: number,
    daysBack: number,
    hintsUsed: number = 0,
  ) => {
    const userId = userMap[userEmail].id;
    const activity = activityMap[activityKey];
    if (!activity) return;
    await db.attempt.create({
      data: {
        userId,
        activityId: activity.id,
        answer,
        feedback,
        score,
        correct,
        timeSpent,
        hintsUsed,
        createdAt: daysAgo(daysBack),
      },
    });
    attemptsCount++;
  };

  // Camila — alta performance, ~12 intentos
  await makeAttempt(
    "camila.rojas@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:0",
    "B",
    true,
    10,
    "¡Correcto! Identificaste correctamente la naturaleza sumatoria del ECG superficial.",
    45,
    14,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:1",
    "1.6 µV RMS",
    true,
    15,
    "Cálculo impecable. Aplicaste bien la fórmula de Johnson-Nyquist.",
    180,
    13,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "biosenales-electrodos:captacion-electrodos-transductores:0",
    "B",
    true,
    10,
    "Correcto: el Ag/AgCl es no polarizable y es el estándar clínico.",
    60,
    12,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "biosenales-electrodos:captacion-electrodos-transductores:1",
    "Respuesta case_analysis completa",
    true,
    14,
    "Diagnóstico correcto del motion artifact. Bien sugerido el cambio de electrodos.",
    240,
    11,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "biosenales-electrodos:acondicionamiento-de-senal:0",
    "49.4 Ω",
    true,
    15,
    "Excelente. Recordaste que la fórmula tiene 1+ por eso G−1.",
    150,
    10,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "biosenales-electrodos:acondicionamiento-de-senal:1",
    "0.05 Hz / 150 Hz / 0.1 µV",
    true,
    20,
    "Dominas los trade-offs diagnóstico vs monitoreo. ¡Excelente!",
    300,
    9,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "electrocardiografia:fundamentos-ecg-einthoven:0",
    "C",
    true,
    10,
    "Correcto, la onda P es la despolarización auricular.",
    35,
    8,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "electrocardiografia:fundamentos-ecg-einthoven:1",
    "0.9 = 0.4 + 0.5 → cumple",
    true,
    15,
    "Aplicación correcta de la ley de Einthoven.",
    120,
    7,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "electrocardiografia:sistema-de-derivaciones:0",
    "B",
    true,
    10,
    "Correcto: DII, DIII y aVF miran la pared inferior.",
    50,
    6,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "electrocardiografia:sistema-de-derivaciones:1",
    "Inversión BD↔BI",
    true,
    18,
    "Excelente diagnóstico diferencial con dextrocardia.",
    280,
    5,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "electrocardiografia:instrumentacion-filtrado-ecg:0",
    "Niveles 1-3 correctos",
    true,
    18,
    "Muy bien razonado el caso de temblor.",
    320,
    4,
  );
  await makeAttempt(
    "camila.rojas@uv.cl",
    "seguridad-electrica:riesgos-electricos-clinica:0",
    "C",
    true,
    10,
    "Correcto: 10 µA es el umbral de microshock.",
    40,
    3,
  );

  // Matías — media, ~9 intentos, algunos incorrectos
  await makeAttempt(
    "matias.soto@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:0",
    "B",
    true,
    10,
    "¡Correcto!",
    55,
    10,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:1",
    "1.8 µV",
    false,
    8,
    "Cerca. Revisa la conversión de °C a K; te faltó sumar 273.15 correctamente.",
    220,
    9,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:1",
    "1.6 µV RMS",
    true,
    15,
    "¡Ahora sí! La conversión a Kelvin era la clave.",
    150,
    8,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "biosenales-electrodos:captacion-electrodos-transductores:0",
    "B",
    true,
    10,
    "Correcto.",
    70,
    8,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "biosenales-electrodos:acondicionamiento-de-senal:0",
    "50 Ω",
    false,
    10,
    "Muy cerca. Revisa la fórmula: Rg = 49.4kΩ/(G−1).",
    200,
    7,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "biosenales-electrodos:acondicionamiento-de-senal:0",
    "49.4 Ω",
    true,
    15,
    "¡Corregido!",
    90,
    7,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "electrocardiografia:fundamentos-ecg-einthoven:0",
    "C",
    true,
    10,
    "Correcto.",
    45,
    5,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "electrocardiografia:sistema-de-derivaciones:0",
    "A",
    false,
    4,
    "No. V1-V4 son derivaciones precordiales anteriores, no inferiores. Recuerda: inferior = DII, DIII, aVF.",
    30,
    4,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "electrocardiografia:sistema-de-derivaciones:0",
    "B",
    true,
    10,
    "¡Ahí está!",
    40,
    4,
  );
  await makeAttempt(
    "matias.soto@uv.cl",
    "monitoreo-pacientes:pulsoximetria:0",
    "B",
    true,
    10,
    "Correcto.",
    60,
    3,
  );

  // Fernanda — media-baja, ~6 intentos
  await makeAttempt(
    "fernanda.vega@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:0",
    "B",
    true,
    10,
    "Correcto.",
    80,
    6,
  );
  await makeAttempt(
    "fernanda.vega@uv.cl",
    "biosenales-electrodos:captacion-electrodos-transductores:0",
    "A",
    false,
    3,
    "No. El platino es polarizable. El estándar es Ag/AgCl porque es no polarizable.",
    50,
    5,
    2, // usó 2 pistas
  );
  await makeAttempt(
    "fernanda.vega@uv.cl",
    "biosenales-electrodos:captacion-electrodos-transductores:0",
    "B",
    true,
    10,
    "¡Ahora sí!",
    40,
    5,
    1, // usó 1 pista en el reintento
  );
  await makeAttempt(
    "fernanda.vega@uv.cl",
    "electrocardiografia:fundamentos-ecg-einthoven:0",
    "C",
    true,
    10,
    "Correcto.",
    50,
    4,
  );
  await makeAttempt(
    "fernanda.vega@uv.cl",
    "electrocardiografia:fundamentos-ecg-einthoven:1",
    "0.4 + 0.5 = 0.9",
    true,
    13,
    "Bien aplicada la ley de Einthoven.",
    180,
    3,
  );
  await makeAttempt(
    "fernanda.vega@uv.cl",
    "monitoreo-pacientes:pulsoximetria:0",
    "B",
    true,
    10,
    "Correcto.",
    65,
    2,
  );

  // Tomás — bajo, ~4 intentos, varios incorrectos
  await makeAttempt(
    "tomas.munoz@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:0",
    "A",
    false,
    2,
    "No. Una sola fibra no se ve en superficie. El ECG es la suma de millones de potenciales.",
    30,
    8,
    1, // usó 1 pista
  );
  await makeAttempt(
    "tomas.munoz@uv.cl",
    "biosenales-electrodos:naturaleza-de-las-biosenales:0",
    "B",
    true,
    10,
    "¡Correcto! Te recomiendo repasar el material de origen celular.",
    45,
    8,
    2, // usó 2 pistas en el reintento
  );
  await makeAttempt(
    "tomas.munoz@uv.cl",
    "biosenales-electrodos:captacion-electrodos-transductores:0",
    "C",
    false,
    2,
    "El acero es más barato pero no es el apropiado. Recuerda: buscamos electrodos no polarizables.",
    40,
    5,
    2, // usó 2 pistas
  );
  await makeAttempt(
    "tomas.munoz@uv.cl",
    "electrocardiografia:fundamentos-ecg-einthoven:0",
    "A",
    false,
    2,
    "No. Repasa el orden: P → QRS → T. La onda P es la despolarización auricular.",
    35,
    3,
  );

  console.log(`   ✔ ${attemptsCount} intentos creados`);

  // 7. Mensajes de chat (tutor IA)
  console.log("💬 Creando mensajes de chat...");
  let chatCount = 0;

  const addChat = async (
    userEmail: string,
    role: "user" | "assistant",
    content: string,
    context: string | null,
    rating: number | null,
    minutesBack: number,
  ) => {
    await db.chatMessage.create({
      data: {
        userId: userMap[userEmail].id,
        role,
        content,
        context,
        rating,
        createdAt: new Date(Date.now() - minutesBack * 60_000),
      },
    });
    chatCount++;
  };

  // Conversación de Camila sobre ECG (6 mensajes)
  await addChat(
    "camila.rojas@uv.cl",
    "user",
    "Profesor, ¿por qué el filtro de línea base en modo monitor corta a 0.5 Hz pero el diagnóstico exige 0.05 Hz? ¿No es básicamente lo mismo?",
    "Unidad: electrocardiografia / Lección: instrumentacion-filtrado-ecg",
    null,
    60 * 24 * 2,
  );
  await addChat(
    "camila.rojas@uv.cl",
    "assistant",
    "Excelente pregunta. La diferencia parece pequeña (un orden de magnitud) pero tiene enorme impacto clínico: el segmento ST tiene componentes frecuenciales entre 0.05 y 0.5 Hz. Si cortas a 0.5 Hz, eliminas justamente la información que permite detectar isquemia. En modo monitor priorizas estabilidad visual (para ver el ritmo) y aceptas perder el ST. Por eso **nunca debes diagnosticar isquemia con un monitor filtrado a 0.5 Hz**: necesitas el modo diagnóstico.",
    "Unidad: electrocardiografia / Lección: instrumentacion-filtrado-ecg",
    5,
    60 * 24 * 2 - 2,
  );
  await addChat(
    "camila.rojas@uv.cl",
    "user",
    "¿Y cómo se justifica entonces usar 0.5 Hz en UCI si el paciente podría estar isquémico?",
    null,
    null,
    60 * 24 * 2 - 5,
  );
  await addChat(
    "camila.rojas@uv.cl",
    "assistant",
    "Buena observación. En UCI lo que se busca es **detectar arritmias** continuamente. Si hay sospecha de isquemia, el protocolo es obtener un **ECG de 12 derivaciones en modo diagnóstico** en ese momento, no usar la traza del monitor. El monitor de UCI es para ritmo y frecuencia; el ECG diagnóstico es para morfología. Son dos herramientas complementarias, no intercambiables.",
    null,
    5,
    60 * 24 * 2 - 7,
  );
  await addChat(
    "camila.rojas@uv.cl",
    "user",
    "¿Tiene sentido entonces pedir siempre ECG de 12 derivaciones al ingreso a UCI?",
    null,
    null,
    60 * 24 * 1,
  );
  await addChat(
    "camila.rojas@uv.cl",
    "assistant",
    "Exacto. Es estándar de ingreso: una línea de base de 12 derivaciones en modo diagnóstico permite comparar futuros trazos y detectar cambios sutiles en el ST. Es la 'fotografía' morfológica que complementa la 'película' de ritmo del monitor.",
    null,
    4,
    60 * 24 * 1 - 1,
  );

  // Conversación de Matías sobre electrodos (4 mensajes)
  await addChat(
    "matias.soto@uv.cl",
    "user",
    "No entiendo bien la diferencia entre electrodo polarizable y no polarizable. ¿Podrías dármelo con un ejemplo clínico?",
    "Unidad: biosenales-electrodos / Lección: captacion-electrodos-transductores",
    null,
    60 * 30,
  );
  await addChat(
    "matias.soto@uv.cl",
    "assistant",
    "Claro. Imagina el electrodo como una 'compuerta' iónica-electrónica:\n\n- **No polarizable (Ag/AgCl)**: la reacción redox ocurre libremente, como una puerta abierta. La corriente pasa sin acumular carga. Perfecto para **registrar** señales frágiles como ECG o EEG.\n\n- **Polarizable (platino, acero)**: la reacción no ocurre; la carga se acumula en la interfaz como un capacitor, como una puerta cerrada que solo pasa AC. Útil para **estimar** (alta corriente, poco tiempo) porque no degrada el electrodo, pero registra mal señales de baja frecuencia.\n\nLa regla práctica: para ECG → Ag/AgCl; para marcapasos o desfibrilador → acero/platino.",
    "Unidad: biosenales-electrodos / Lección: captacion-electrodos-transductores",
    5,
    60 * 30 - 2,
  );
  await addChat(
    "matias.soto@uv.cl",
    "user",
    "¿Y el oro? Había visto electrodos de oro para EEG prolongado.",
    null,
    null,
    60 * 29,
  );
  await addChat(
    "matias.soto@uv.cl",
    "assistant",
    "Excelente recordatorio. El oro es **media polarización**: intermedio entre Ag/AgCl y platino. No es tan estable como Ag/AgCl pero resiste mejor la corrosión en registros prolongados (días) sin degradarse. Por eso se usa en EEG de larga duración (video-EEG, polysomnografía) donde el gel del Ag/AgCl se secaría. Para registros de pocas horas, Ag/AgCl sigue siendo mejor.",
    null,
    4,
    60 * 29 - 1,
  );

  console.log(`   ✔ ${chatCount} mensajes creados`);

  // 8. Sesiones de estudio
  console.log("⏱️ Creando sesiones de estudio...");
  let sessionsCount = 0;

  const addSession = async (
    userEmail: string,
    unitSlug: string | null,
    durationMin: number,
    daysBack: number,
  ) => {
    await db.studySession.create({
      data: {
        userId: userMap[userEmail].id,
        unitId: unitSlug ? unitMap[unitSlug].id : null,
        startedAt: daysAgo(daysBack),
        duration: durationMin,
      },
    });
    sessionsCount++;
  };

  // Camila: 8 sesiones, alta intensidad
  await addSession("camila.rojas@uv.cl", "biosenales-electrodos", 65, 14);
  await addSession("camila.rojas@uv.cl", "biosenales-electrodos", 80, 13);
  await addSession("camila.rojas@uv.cl", "electrocardiografia", 90, 10);
  await addSession("camila.rojas@uv.cl", "electrocardiografia", 55, 8);
  await addSession("camila.rojas@uv.cl", "monitoreo-pacientes", 70, 6);
  await addSession("camila.rojas@uv.cl", "seguridad-electrica", 60, 4);
  await addSession("camila.rojas@uv.cl", "equipos-terapeuticos", 45, 3);
  await addSession("camila.rojas@uv.cl", "electrocardiografia", 50, 1);

  // Matías: 6 sesiones
  await addSession("matias.soto@uv.cl", "biosenales-electrodos", 40, 10);
  await addSession("matias.soto@uv.cl", "biosenales-electrodos", 55, 9);
  await addSession("matias.soto@uv.cl", "electrocardiografia", 60, 7);
  await addSession("matias.soto@uv.cl", "monitoreo-pacientes", 35, 5);
  await addSession("matias.soto@uv.cl", "electrocardiografia", 45, 3);
  await addSession("matias.soto@uv.cl", "monitoreo-pacientes", 30, 1);

  // Fernanda: 5 sesiones
  await addSession("fernanda.vega@uv.cl", "biosenales-electrodos", 50, 6);
  await addSession("fernanda.vega@uv.cl", "biosenales-electrodos", 35, 5);
  await addSession("fernanda.vega@uv.cl", "electrocardiografia", 45, 4);
  await addSession("fernanda.vega@uv.cl", "monitoreo-pacientes", 40, 2);
  await addSession("fernanda.vega@uv.cl", "electrocardiografia", 25, 1);

  // Tomás: 3 sesiones, baja intensidad
  await addSession("tomas.munoz@uv.cl", "biosenales-electrodos", 20, 8);
  await addSession("tomas.munoz@uv.cl", "biosenales-electrodos", 15, 5);
  await addSession("tomas.munoz@uv.cl", "electrocardiografia", 18, 3);

  console.log(`   ✔ ${sessionsCount} sesiones creadas`);

  // 9. Otorgar badges
  console.log("🎖️ Otorgando badges...");
  let badgeAwardCount = 0;

  const awardBadge = async (userEmail: string, badgeSlug: string, daysBack: number) => {
    await db.userBadge.create({
      data: {
        userId: userMap[userEmail].id,
        badgeId: badgeMap[badgeSlug].id,
        awardedAt: daysAgo(daysBack),
      },
    });
    badgeAwardCount++;
  };

  // Camila: 5 badges
  await awardBadge("camila.rojas@uv.cl", "primer-paso", 14);
  await awardBadge("camila.rojas@uv.cl", "explorador", 10);
  await awardBadge("camila.rojas@uv.cl", "racha-7", 7);
  await awardBadge("camila.rojas@uv.cl", "maestro-ecg", 5);
  await awardBadge("camila.rojas@uv.cl", "tutor-activo", 2);

  // Matías: 3 badges
  await awardBadge("matias.soto@uv.cl", "primer-paso", 10);
  await awardBadge("matias.soto@uv.cl", "explorador", 6);
  await awardBadge("matias.soto@uv.cl", "racha-7", 4);

  // Fernanda: 2 badges
  await awardBadge("fernanda.vega@uv.cl", "primer-paso", 6);
  await awardBadge("fernanda.vega@uv.cl", "explorador", 3);

  // Tomás: 1 badge
  await awardBadge("tomas.munoz@uv.cl", "primer-paso", 5);

  console.log(`   ✔ ${badgeAwardCount} badges otorgados`);

  // 10. Autoevaluaciones
  console.log("🪞 Creando autoevaluaciones...");
  let selfAssessCount = 0;

  const addSelfAssess = async (
    userEmail: string,
    unitSlug: string | null,
    confidence: number,
    reflection: string,
    daysBack: number,
  ) => {
    await db.selfAssessment.create({
      data: {
        userId: userMap[userEmail].id,
        unitId: unitSlug ? unitMap[unitSlug].id : null,
        confidence,
        reflection,
        createdAt: daysAgo(daysBack),
      },
    });
    selfAssessCount++;
  };

  await addSelfAssess(
    "camila.rojas@uv.cl",
    "biosenales-electrodos",
    5,
    "Me siento muy segura con la cadena de acondicionamiento. El punto que más me costó fue justificar el RLD, pero ya lo tengo claro: inyectar el modo común invertido reduce 60 Hz sin tocar la señal diferencial.",
    12,
  );
  await addSelfAssess(
    "camila.rojas@uv.cl",
    "electrocardiografia",
    4,
    "Dominio los modos y filtros pero todavía me confundo un poco con la localización de infartos posteriores. Voy a repasar la imagen espejo en V1-V2.",
    6,
  );
  await addSelfAssess(
    "matias.soto@uv.cl",
    "biosenales-electrodos",
    3,
    "Voy mejorando con los cálculos. Me cuesta aún distinguir electrodos media polarización. La conversión del chat IA me ayudó bastante.",
    8,
  );
  await addSelfAssess(
    "fernanda.vega@uv.cl",
    "biosenales-electrodos",
    3,
    "Entiendo la teoría pero me equivoco en los detalles prácticos. Necesito practicar más casos de motion artifact.",
    4,
  );
  await addSelfAssess(
    "tomas.munoz@uv.cl",
    "biosenales-electrodos",
    2,
    "Me cuesta seguir el ritmo. Las fórmulas se me olvidan. Voy a repasar desde la naturaleza de las bioseñales y pedir más ayuda al tutor IA.",
    3,
  );

  console.log(`   ✔ ${selfAssessCount} autoevaluaciones creadas`);

  console.log("\n✅ Seed completado:");
  console.log(`   - 6 badges`);
  console.log(`   - 5 usuarios (1 docente + 4 estudiantes)`);
  console.log(`   - 5 unidades`);
  console.log(`   - ${totalLessons} lecciones`);
  console.log(`   - ${totalActivities} actividades`);
  console.log(`   - 20 registros de progreso`);
  console.log(`   - ${attemptsCount} intentos`);
  console.log(`   - ${chatCount} mensajes de chat`);
  console.log(`   - ${sessionsCount} sesiones de estudio`);
  console.log(`   - ${badgeAwardCount} badges otorgados`);
  console.log(`   - ${selfAssessCount} autoevaluaciones`);
}

main()
  .catch(async (e) => {
    console.error("❌ Error en seed:", e);
    await db.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
