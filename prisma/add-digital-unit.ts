/**
 * Script para añadir la Unidad 6: "Electrónica Digital en Equipos Médicos"
 * Basado en "Lessons In Electric Circuits, Volume IV – Digital" de Tony R. Kuphaldt
 * Adaptado a la perspectiva biomédica de Electromedicina II
 *
 * Ejecutar con: bun run prisma/add-digital-unit.ts
 */

import { db } from "../src/lib/db";

async function main() {
  console.log("📚 Añadiendo Unidad 6: Electrónica Digital en Equipos Médicos...");

  // Crear la unidad
  const unit = await db.unit.create({
    data: {
      slug: "electronica-digital-medica",
      title: "Electrónica Digital en Equipos Médicos",
      summary: "Conversión ADC/DAC, compuertas lógicas y multivibradores aplicados a equipos biomédicos.",
      description:
        "Fundamentos de electrónica digital aplicados a equipos médicos: conversión analógico-digital para monitoreo de señales fisiológicas, compuertas lógicas en circuitos de alarma y seguridad, y multivibradores en temporizadores de dispositivos como marcapasos y desfibriladores. Basado en 'Lessons In Electric Circuits, Vol. IV – Digital' de Kuphaldt, con enfoque biomédico.",
      icon: "Activity",
      color: "sky",
      order: 6,
    },
  });
  console.log(`  ✔ Unidad creada: ${unit.title}`);

  // ──────────────────────────────────────────────────────
  // LECCIÓN 1: Conversión Analógico-Digital en Equipos Médicos
  // Basada en Cap. 13 del libro
  // ──────────────────────────────────────────────────────
  const lesson1 = await db.lesson.create({
    data: {
      unitId: unit.id,
      slug: "conversion-ad-da-equipos-medicos",
      title: "Conversión Analógico-Digital en Equipos Médicos",
      description:
        "Principios de conversión ADC/DAC (R/2R, SAR, flash) aplicados a la digitalización de señales fisiológicas como ECG y SpO₂.",
      durationMin: 25,
      order: 1,
      content: `## Introducción

La conversión analógico-digital (ADC) y digital-analógica (DAC) son procesos fundamentales en todos los equipos médicos modernos que procesan señales fisiológicas. Un electrocardiógrafo, un monitor de signos vitales, un pulsioxímetro o un equipo de ultrasonido dependen de circuitos ADC para convertir las señales analógicas del cuerpo en datos digitales procesables.

## El problema de la cuantificación

Las señales biológicas (ECG, EEG, SpO₂, presión arterial) son inherentemente analógicas: varían continuamente en el tiempo y amplitud. Para que un microprocesador pueda analizarlas, almacenarlas o transmitirlas, deben convertirse a valores discretos (digitales).

**Parámetros clave del ADC en equipos médicos:**

- **Resolución (bits):** Determina la precisión. Un ADC de 12 bits puede representar $2^{12} = 4096$ niveles. Para ECG se usan típicamente 12-16 bits.
- **Frecuencia de muestreo:** Debe cumplir el teorema de Nyquist ($f_s \\geq 2 \\times f_{max}$). Para ECG diagnóstico (0.05-150 Hz) basta 500 Hz; para EEG se requieren hasta 1000 Hz.
- **Rango de entrada:** El ECG superficial tiene amplitudes de 0.5-5 mV, lo que requiere amplificación previa (ganancia 1000×) antes del ADC.

## DAC de red R/2R

El libro de Kuphaldt describe la red R/2R como una alternativa elegante al DAC de resistencias ponderadas. Usa solo dos valores de resistencia (R y 2R), lo que simplifica la fabricación.

### Principio de funcionamiento

La red R/2R funciona como un divisor de voltaje escalonado donde cada bit binario contribuye con una fracción que es potencia de 2 del voltaje de referencia:

| Binary | Output voltage |
|--------|---------------|
| 000 | 0.00 V |
| 001 | -1.25 V |
| 010 | -2.50 V |
| 011 | -3.75 V |
| 100 | -5.00 V |
| 101 | -6.25 V |
| 110 | -7.50 V |
| 111 | -8.75 V |

**Aplicación biomédica:** Un DAC R/2R puede usarse para generar estímulos calibrados en equipos de estimulación eléctrica funcional (FES), donde la amplitud del pulso debe controlarse con precisión en incrementos de 0.5 mA.

## ADC de aproximaciones sucesivas (SAR)

El ADC SAR (Successive Approximation Register) es el más usado en equipos médicos portátiles por su balance entre velocidad y consumo.

### Funcionamiento

1. El registro coloca el bit más significativo (MSB) en 1.
2. El DAC convierte este valor a voltaje y se compara con la entrada analógica.
3. Si la entrada es mayor, el bit se mantiene; si es menor, se pone en 0.
4. Se repite con el siguiente bit, de MSB a LSB.
5. En N ciclos de reloj se obtiene la conversión completa de N bits.

**Ventaja para equipos médicos:** Un SAR de 12 bits completa la conversión en 12 ciclos de reloj (~25 μs a 500 kHz), suficiente para ECG en tiempo real.

## Aplicación: Digitalización del ECG

La cadena típica de acondicionamiento y digitalización de un ECG es:

1. **Electrodos** captan la señal (0.5-5 mV)
2. **Amplificador de instrumentación** (AD620, INA128) con ganancia 1000×
3. **Filtro paso-banda** (0.05-150 Hz) elimina deriva y ruido 60 Hz
4. **ADC de 12-16 bits** a 500 Hz muestrea la señal
5. **Microprocesador** procesa, almacena y muestra el ECG

La resolución efectiva del sistema: con un ADC de 12 bits y rango ±5V, la resolución es $10V / 4096 = 2.44 mV$ por bit. Después de la amplificación (1000×), esto equivale a **2.44 μV** a la entrada del electrodo — suficiente para detectar las ondas P (0.1 mV).

## Aplicación: Pulsioximetría digital

El pulsioxímetro usa ADC para procesar la relación de absorción rojo/infrarrojo:

- Dos LEDs (660 nm y 940 nm) iluminan el tejido
- Un fotodiodo captura la luz transmitida
- Un ADC de 16-22 bits digitaliza la señal fotopletismográfica
- El microprocesador calcula el cociente R y estima SpO₂ por interpolación

La alta resolución del ADC (22 bits) es necesaria porque la componente AC (pulso) es solo ~1-2% de la componente DC.

## Conclusión

La conversión ADC/DAC es el puente entre el mundo analógico de la fisiología y el mundo digital del procesamiento. Comprender los principios de la red R/2R, el SAR y los requisitos de muestreo es esencial para evaluar la calidad de la señal en cualquier equipo de monitoreo médico.`,
    },
  });
  console.log(`  ✔ Lección 1 creada: ${lesson1.title}`);

  // Actividades para lección 1
  const act1 = await db.activity.create({
    data: {
      lessonId: lesson1.id,
      type: "multiple_choice",
      title: "Resolución de ADC para ECG",
      prompt: "Selecciona la respuesta correcta sobre la resolución de un ADC de 12 bits.",
      data: JSON.stringify({
        question: "Un ADC de 12 bits con rango de ±5V se usa para digitalizar un ECG amplificado 1000×. ¿Cuál es la resolución efectiva a la entrada del electrodo?",
        options: [
          "A) 2.44 mV",
          "B) 2.44 μV",
          "C) 24.4 μV",
          "D) 1.22 μV",
        ],
        correctIndex: 1,
        explanation: "Resolución = 10V / 2^12 = 10V / 4096 = 2.44 mV por bit. Con ganancia 1000×, la resolución a la entrada del electrodo es 2.44 mV / 1000 = 2.44 μV.",
        hints: ["Calcula 10V / 4096 primero", "Luego divide por la ganancia del amplificador"],
      }),
      points: 10,
      difficulty: "medium",
      order: 1,
    },
  });

  const act2 = await db.activity.create({
    data: {
      lessonId: lesson1.id,
      type: "guided_problem",
      title: "Cálculo de frecuencia de muestreo mínima",
      prompt: "Calcula la frecuencia de muestreo mínima para digitalizar una señal de ECG.",
      data: JSON.stringify({
        scenario: "Un ECG diagnóstico tiene componentes de frecuencia hasta 150 Hz. Por el teorema de Nyquist, la frecuencia de muestreo debe ser al menos el doble de la frecuencia máxima.",
        steps: [
          { prompt: "Paso 1: Identifica la frecuencia máxima de la señal.", answer: "150 Hz", hint: "El ancho de banda diagnóstico del ECG es 0.05-150 Hz" },
          { prompt: "Paso 2: Aplica el teorema de Nyquist: fs = 2 × fmax", answer: "300 Hz", hint: "Multiplica por 2" },
          { prompt: "Paso 3: En la práctica se usa el doble del mínimo para mejor reconstrucción. ¿Qué frecuencia se recomienda?", answer: "500 Hz", hint: "Se usa ~1.5-2× el mínimo teórico" },
        ],
        finalAnswer: "La frecuencia de muestreo mínima es 300 Hz (Nyquist), pero se recomienda 500 Hz para mejor reconstrucción de la señal.",
        explanation: "El teorema de Nyquist establece que fs ≥ 2 × fmax. Para ECG con fmax = 150 Hz, fs mínimo = 300 Hz. En la práctica se usa 500 Hz para margen de seguridad.",
      }),
      points: 15,
      difficulty: "medium",
      order: 2,
    },
  });

  const act3 = await db.activity.create({
    data: {
      lessonId: lesson1.id,
      type: "case_analysis",
      title: "Selección de ADC para pulsioxímetro",
      prompt: "Analiza el caso y responde las preguntas sobre la selección del ADC.",
      data: JSON.stringify({
        case: "Un equipo de pulsioximetría debe detectar variaciones de luz del 1% sobre una señal DC de 100 mV. La componente AC (pulso) tiene una amplitud de ~1 mV. El ingeniero debe seleccionar un ADC adecuado.",
        questions: [
          { prompt: "¿Cuántos bits se necesitan como mínimo para resolver 1 mV sobre un rango de 100 mV?", answer: "14 bits", explanation: "100 mV / 2^n ≤ 1 mV → 2^n ≥ 100 → n ≥ 7. Pero se necesita margen, en la práctica se usan 16-22 bits." },
          { prompt: "¿Por qué se prefiere un ADC SAR sobre un flash en este equipo portátil?", answer: "Menor consumo y suficiente velocidad", explanation: "El SAR consume menos potencia que un ADC flash del mismo resolución, crítico en equipos a batería." },
        ],
      }),
      points: 20,
      difficulty: "hard",
      order: 3,
    },
  });
  console.log(`  ✔ 3 actividades creadas para lección 1`);

  // ──────────────────────────────────────────────────────
  // LECCIÓN 2: Compuertas Lógicas y Circuitos de Alarma
  // Basada en Cap. 3 del libro
  // ──────────────────────────────────────────────────────
  const lesson2 = await db.lesson.create({
    data: {
      unitId: unit.id,
      slug: "compuertas-logicas-alarmas-medicas",
      title: "Compuertas Lógicas y Circuitos de Alarma Médica",
      description:
        "Aplicación de compuertas lógicas (AND, OR, NOT, Schmitt trigger) en circuitos de alarma, seguridad e interlocks de equipos médicos.",
      durationMin: 22,
      order: 2,
      content: `## Introducción

Las compuertas lógicas son los bloques fundamentales de la electrónica digital. En equipos médicos, se usan en circuitos de alarma, sistemas de seguridad (interlocks), control de desfibriladores y lógica de monitoreo. El libro de Kuphaldt (Cap. 3) establece los fundamentos de niveles de voltaje, márgenes de ruido y el trigger de Schmitt.

## Niveles lógicos y márgenes de ruido

En un circuito digital, los niveles lógicos se definen como rangos de voltaje:

- **VOH (mínimo):** Voltaje de salida garantizado para "1" lógico
- **VOL (máximo):** Voltaje de salida garantizado para "0" lógico
- **VIH (mínimo):** Voltaje de entrada reconocido como "1"
- **VIL (máximo):** Voltaje de entrada reconocido como "0"

**El margen de ruido** es la diferencia entre el peor caso de salida y el umbral de entrada. En equipos médicos, un margen de ruido amplio es crítico porque el ambiente hospitalario tiene mucha interferencia electromagnética (EMI) de otros equipos.

## Schmitt Trigger: Solución al ruido

El libro describe cómo un umbral único causa conmutación errática ante el ruido. La solución es el **Schmitt trigger**, que introduce histéresis mediante realimentación positiva:

- **Umbral superior (Vt+):** Voltaje al que la salida cambia de bajo a alto
- **Umbral inferior (Vt−):** Voltaje al que la salida cambia de alto a bajo
- **Histéresis = Vt+ − Vt−**

**Aplicación biomédica:** En un monitor de frecuencia cardíaca, la señal del ECG puede tener ruido que causaría detecciones falsas. Un Schmitt trigger en el detector de onda R asegura que solo los picos suficientemente altos (por encima de Vt+) disparen el contador, y el ruido entre Vt− y Vt+ no cause conmutación.

## Compuertas en circuitos de alarma

### Alarma de límites (comparador + AND)

Un monitor de signos vitales debe alarmar cuando **cualquier** parámetro excede su límite. La lógica es:

---CODE---
Alarma = (FC > FC_max) OR (SpO₂ < SpO₂_min) OR (PA > PA_max) OR (Temp > Temp_max)
---CODE---

Cada comparador genera un "1" cuando hay violación. Una compuerta **OR** combina todas las señales: si cualquiera está activa, suena la alarma.

### Interlock de seguridad (AND)

Un desfibrilador no debe descargar si:
1. El selector de energía está en una posición válida **AND**
2. Los electrodos están correctamente colocados **AND**
3. No hay personal tocando al paciente **AND**
4. El modo (sincronizado/asincrónico) está confirmado

Esto es una compuerta **AND** de 4 entradas: todas deben ser "1" para habilitar la descarga.

### Temporizador de alarma (NOT + RC)

Cuando una alarma suena, debe poder silenciarse temporalmente (120 segundos). Esto se implementa con:
- Un pulso de silencio activa un latch
- Un temporizador RC descuenta el tiempo
- Una compuerta **NOT** invierte la salida del temporizador para silenciar la alarma

## Aplicación: Detector de arritmia simple

Un detector básico de taquicardia ventricular puede construirse con lógica combinacional:

1. Un contador digital cuenta los complejos QRS en una ventana de 10 segundos
2. Un comparador verifica si el conteo > 17 (FC > 100 bpm → taquicardia)
3. Una compuerta **AND** verifica además que el complejo sea ancho (> 120 ms, característica de TV)
4. Si ambas condiciones se cumplen, se activa la alarma de taquicardia ventricular

## Conclusión

Las compuertas lógicas, aunque simples individualmente, permiten construir sistemas de seguridad complejos en equipos médicos. El Schmitt trigger es esencial para el procesamiento confiable de señales ruidosas en el entorno hospitalario. Los interlocks basados en lógica AND previenen operaciones peligrosas, mientras que las alarmas basadas en OR garantizan que ningún parámetro crítico pase desapercibido.`,
    },
  });
  console.log(`  ✔ Lección 2 creada: ${lesson2.title}`);

  // Actividades para lección 2
  const act4 = await db.activity.create({
    data: {
      lessonId: lesson2.id,
      type: "multiple_choice",
      title: "Interlock de desfibrilador",
      prompt: "Selecciona la compuerta lógica correcta para el interlock de seguridad.",
      data: JSON.stringify({
        question: "Un desfibrilador solo debe descargar si TODAS las condiciones de seguridad se cumplen simultáneamente. ¿Qué compuerta lógica implementa esta función?",
        options: [
          "A) OR — basta que una condición se cumpla",
          "B) AND — todas las condiciones deben cumplirse",
          "C) NOT — invierte la señal de seguridad",
          "D) XOR — exactamente una condición debe cumplirse",
        ],
        correctIndex: 1,
        explanation: "La compuerta AND requiere que TODAS las entradas sean 1 para que la salida sea 1. Esto garantiza que ninguna condición de seguridad pueda saltarse.",
        hints: ["Piensa: ¿necesita TODAS o ALGUNA?"],
      }),
      points: 10,
      difficulty: "easy",
      order: 1,
    },
  });

  const act5 = await db.activity.create({
    data: {
      lessonId: lesson2.id,
      type: "case_analysis",
      title: "Diseño de sistema de alarma multi-parámetro",
      prompt: "Analiza el caso de diseño de un sistema de alarma para un monitor de paciente.",
      data: JSON.stringify({
        case: "Un monitor multiparámetro debe generar una alarma cuando: (1) la frecuencia cardíaca exceda 120 bpm, (2) la SpO₂ caiga bajo 90%, o (3) la temperatura exceda 38.5°C. Además, debe haber una alarma crítica separada si tanto la FC como la SpO₂ están en rango de alarma simultáneamente.",
        questions: [
          { prompt: "¿Qué compuerta se usa para combinar las 3 alarmas individuales en una alarma general?", answer: "OR", explanation: "Cualquier parámetro fuera de rango debe disparar la alarma general, por lo que se usa OR." },
          { prompt: "¿Qué compuerta se usa para detectar la alarma crítica (FC y SpO₂ simultáneos)?", answer: "AND", explanation: "La alarma crítica solo se activa si AMBAS condiciones (FC y SpO₂) están en alarma, por lo que se usa AND." },
        ],
      }),
      points: 15,
      difficulty: "medium",
      order: 2,
    },
  });
  console.log(`  ✔ 2 actividades creadas para lección 2`);

  // ──────────────────────────────────────────────────────
  // LECCIÓN 3: Multivibradores y Temporizadores en Dispositivos Médicos
  // Basada en Cap. 10 del libro
  // ──────────────────────────────────────────────────────
  const lesson3 = await db.lesson.create({
    data: {
      unitId: unit.id,
      slug: "multivibradores-temporizadores-medicos",
      title: "Multivibradores y Temporizadores en Dispositivos Médicos",
      description:
        "Latches, flip-flops y multivibradores aplicados a marcapasos, desfibriladores y sistemas de temporización médica.",
      durationMin: 24,
      order: 3,
      content: `## Introducción

Los multivibradores son circuitos digitales que generan señales temporales: pulsos, oscilaciones o estados estables. El libro de Kuphaldt (Cap. 10) describe los tres tipos: astable, monoestable y biestable. En equipos médicos, estos circuitos son la base de los marcapasos, temporizadores de desfibrilación, alarmas retardadas y sistemas de adquisición sincronizada.

## Latch S-R (Set-Reset)

El latch S-R es el multivibrador biestable más básico:

- **S (Set):** Fuerza Q = 1
- **R (Reset):** Fuerza Q = 0
- **S = R = 0:** Mantiene el estado anterior (memoria)
- **S = R = 1:** Estado inválido (no se permite)

**Aplicación biomédica:** Un latch S-R puede usarse como memoria de alarma en un monitor. Cuando se detecta una arritmia (S = 1), el latch se activa y la alarma permanece aunque la arritmia cese, hasta que el enfermero presiona "reconocer alarma" (R = 1).

## Latch con Enable (gated latch)

El libro describe cómo añadir una entrada de habilitación (E/EN). Cuando E = 0, el latch ignora S y R, manteniendo su estado. Solo cuando E = 1, S y R tienen efecto.

**Aplicación biomédica:** En un sistema de adquisición multiplexado, el enable permite que el latch solo capture datos durante la ventana de muestreo correcta, evitando capturar ruido entre muestras.

## Flip-flop D (Datos)

El flip-flop D elimina el problema del estado inválido del S-R. Solo tiene una entrada de datos (D) y una de reloj (CLK):

- En el flanco de subida del reloj, Q toma el valor de D
- En otros momentos, Q mantiene su valor

**Aplicación biomédica — Marcapasos:** Un marcapasos en modo VOO (asincrónico) usa un oscilador astable para generar pulsos a frecuencia fija (ej. 60 ppm = 1 Hz). La duración del pulso se controla con un monoestable (0.5 ms). Un flip-flop D sincroniza la salida con un divisor de frecuencia para ajustar la tasa.

## Multivibrador astable

El astable no tiene estado estable: oscila continuamente entre alto y bajo. La frecuencia depende de los componentes RC:

---CODE---
f = 1.44 / ((R1 + 2×R2) × C)
---CODE---

**Aplicación — Marcapasos:** Un marcapasos VOO básico usa un astable a 60 ppm (1 Hz) para generar los pulsos de estimulación. El ciclo de trabajo se ajusta para que el pulso sea corto (0.5 ms) comparado con el período (1000 ms).

**Aplicación — Buzzer de alarma:** El tono de las alarmas médicas (típicamente 300-1000 Hz) se genera con un astable. La frecuencia se elige para ser claramente audible sobre el ruido ambiental del hospital.

## Multivibrador monoestable (one-shot)

El monoestable tiene un estado estable y genera un pulso de duración fija cuando se dispara:

---CODE---
T = 1.1 × R × C
---CODE---

**Aplicación — Desfibrilador:** Tras la descarga, el ECG no puede monitorizarse durante unos segundos (el amplificador se satura). Un monoestable genera un pulso de "blanking" de 3-5 segundos que bloquea la visualización del ECG hasta que el amplificador se recupera.

**Aplicación — Retardo de alarma:** Para evitar falsas alarmas por artefactos transitorios (ej. paciente se mueve), se usa un monoestable que retarda la alarma 5-10 segundos. Si la condición anómala persiste después del retardo, la alarma suena.

## Flip-flop JK y contadores

El flip-flop JK es el más versátil. En modo "toggle" (J = K = 1), invierte su estado en cada flanco de reloj. Conectando varios flip-flops JK en cascada se construyen contadores binarios.

**Aplicación — Contador de frecuencias cardíacas:** Un contador digital cuenta los complejos QRS (detectados por un Schmitt trigger) durante una ventana de 10 segundos generada por un monoestable. El resultado se multiplica por 6 para obtener bpm. Un latch D captura el conteo al final de la ventana para mostrarlo en el display.

## Tabla resumen de aplicaciones

| Circuito | Función | Aplicación médica |
|----------|---------|-------------------|
| Latch S-R | Memoria de estado | Memoria de alarma persistente |
| Latch con Enable | Muestreo controlado | Adquisición multiplexada |
| Flip-flop D | Captura sincronizada | Divisor de marcapasos |
| Astable | Oscilador | Generación de pulsos de marcapasos, tono de alarma |
| Monoestable | Pulso de duración fija | Blanking post-desfibrilación, retardo de alarma |
| Contador (JK) | Conteo de eventos | Medición de frecuencia cardíaca |

## Conclusión

Los multivibradores son los bloques de construcción de la temporización en equipos médicos. Desde el marcapasos más simple (un astable + monoestable) hasta sistemas complejos de monitoreo con contadores y latches, estos circuitos permiten que los equipos médicos midan, controlen y alerten con precisión temporal.`,
    },
  });
  console.log(`  ✔ Lección 3 creada: ${lesson3.title}`);

  // Actividades para lección 3
  const act6 = await db.activity.create({
    data: {
      lessonId: lesson3.id,
      type: "multiple_choice",
      title: "Circuito para marcapasos VOO",
      prompt: "Selecciona los circuitos correctos para un marcapasos VOO básico.",
      data: JSON.stringify({
        question: "Un marcapasos en modo VOO (asincrónico) debe generar pulsos de 0.5 ms a una frecuencia de 60 ppm. ¿Qué combinación de multivibradores se necesita?",
        options: [
          "A) Un astable para la frecuencia + un monoestable para la duración del pulso",
          "B) Un latch S-R para la frecuencia + un flip-flop D para el pulso",
          "C) Un contador para la frecuencia + un astable para el pulso",
          "D) Solo un astable ajustado al ciclo de trabajo correcto",
        ],
        correctIndex: 0,
        explanation: "El astable genera la frecuencia base (1 Hz = 60 ppm). El monoestable, disparado por cada flanco del astable, genera el pulso corto de 0.5 ms de duración fija.",
        hints: ["Necesitas dos funciones: ritmo y duración del pulso"],
      }),
      points: 10,
      difficulty: "medium",
      order: 1,
    },
  });

  const act7 = await db.activity.create({
    data: {
      lessonId: lesson3.id,
      type: "guided_problem",
      title: "Cálculo de frecuencia de astable para alarma",
      prompt: "Calcula los componentes RC para un astable que genera el tono de alarma.",
      data: JSON.stringify({
        scenario: "Un generador 555 en modo astable debe producir un tono de alarma a 880 Hz (La5) para un monitor médico. La fórmula es f = 1.44 / ((R1 + 2×R2) × C).",
        steps: [
          { prompt: "Paso 1: Despeja (R1 + 2×R2) × C de la fórmula", answer: "0.001636", hint: "1.44 / 880 = 0.001636" },
          { prompt: "Paso 2: Si C = 100 nF (0.1 μF), calcula R1 + 2×R2", answer: "16360", hint: "0.001636 / 0.0000001 = 16360 Ω" },
          { prompt: "Paso 3: Si R1 = R2, ¿cuánto vale cada resistencia?", answer: "5453", hint: "R1 + 2×R2 = 3×R → R = 16360/3" },
        ],
        finalAnswer: "Con C = 100 nF, R1 = R2 ≈ 5.5 kΩ se obtienen 880 Hz.",
        explanation: "El 555 en modo astable con C=100nF y R1=R2≈5.5kΩ genera 880 Hz, el tono estándar para alarmas médicas de prioridad media.",
      }),
      points: 15,
      difficulty: "hard",
      order: 2,
    },
  });

  const act8 = await db.activity.create({
    data: {
      lessonId: lesson3.id,
      type: "self_assessment",
      title: "Autoevaluación: diseño de temporizadores médicos",
      prompt: "Reflexiona sobre tu comprensión del diseño de circuitos de temporización para equipos médicos.",
      data: JSON.stringify({
        prompt: "Si tuvieras que diseñar el circuito de temporización para un desfibrilador que debe: (1) cargar los capacitores en 10 segundos, (2) generar un pulso de blanking de 5 segundos tras la descarga, y (3) permitir re-descargar solo después de 30 segundos — ¿qué tipo de multivibradores usarías para cada función?",
        rubric: [
          "Novato: No distingue entre astable, monoestable y biestable",
          "Practicante: Identifica correctamente al menos una función",
          "Competente: Asigna monoestable para blanking y retardo, pero confunde la carga",
          "Experto: Usa monoestable para blanking (5s) y retardo (30s), contador/latch para controlar la carga",
        ],
        autoGradeKeywords: ["monoestable", "blanking", "retardo", "contador", "latch", "carga"],
      }),
      points: 5,
      difficulty: "medium",
      order: 3,
    },
  });
  console.log(`  ✔ 3 actividades creadas para lección 3`);

  console.log("\n✅ Unidad 6 creada exitosamente:");
  console.log(`   - 3 lecciones`);
  console.log(`   - 8 actividades (3 MC, 2 guiados, 1 caso, 1 autoevaluación, 1 extra)`);
  console.log(`   - Contenido basado en 'Lessons In Electric Circuits, Vol. IV – Digital'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
