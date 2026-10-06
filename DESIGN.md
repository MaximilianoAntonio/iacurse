# DESIGN.md — CAAMI

> Sistema visual del rediseño 2026. Fuente de verdad para todos los agentes y
> personas que toquen el frontend. Los tokens viven en `src/app/globals.css`
> (Tailwind CSS 4, bloques `@theme`); este documento explica el mundo, los
> valores y las reglas de uso. **No uses `tailwind.config.ts`: es legado de
> Tailwind v3 y está inerte.**

## El mundo: "Instrumento de precisión"

CAAMI es una herramienta de estudio (modo **Operate**) para
Electromedicina II, Universidad de Valparaíso. Su mundo visual es el del
equipo biomédico bien construido: paneles de porcelana de laboratorio, tinta
azul profunda, etiquetado técnico preciso y una única señal ámbar que marca lo
importante. El azul UV `#003366` y el dorado `#F5B800` son **acentos de
marca**, no el molde: la marca vive en el sidebar, el foco de teclado, las
insignias y los estados activos — nunca como relleno masivo de fondos.

Lo que este mundo **rechaza** explícitamente:

- El default SaaS: blanco puro `#FFFFFF` de fondo, Inter, azul `#3B82F6`.
- El cliché IA: crema + serif editorial + terracota; negro con acento neón y
  bordes que brillan; gradientes de texto; glassmorphism decorativo.
- Geist y cualquier cara del monocultivo de interfaces generadas.

## Escena de luz

Estudiantes y docentes en salas, laboratorios y biblioteca, de día y con luz
artificial: el **modo claro es el default**. El modo oscuro no es negro: es
"azul tinta" (la oscuridad del mismo mundo, no otro tema).

## Paleta

Estrategia: **Restrained** — neutrales con tinte azul frío + azul UV primario
+ ámbar como señal. El verde "monitor" solo aparece en datos y estados de
éxito. Todos los valores de tema son oklch en `globals.css`; los hex de marca
son fijos.

### Marca (uso puntual, utilidades `*-brand`, `*-brand-gold`, `*-brand-ink`)

| Token | Valor | Uso |
|---|---|---|
| `--color-brand` | `#003366` | Azul UV: logos, detalles de marca, foco |
| `--color-brand-gold` | `#F5B800` | Dorado UV: insignias, estados activos, señales |
| `--color-brand-ink` | `#0A2540` | Tinta azul del sidebar y sombras |

### Modo claro (default)

| Token | oklch | ≈ hex | Rol |
|---|---|---|---|
| `--background` | `0.975 0.005 250` | `#F3F5F9` | Porcelana fría con tinte azul |
| `--foreground` | `0.22 0.035 260` | `#182741` | Tinta azul-negra |
| `--card` / `--popover` | `0.995 0.002 250` | `#FCFDFE` | Superficie elevada |
| `--primary` | `0.283 0.084 260` | `#003366` | Azul UV (acciones primarias) |
| `--primary-foreground` | `0.98 0.005 250` | `#F7F9FC` | Texto sobre primario |
| `--secondary` / `--muted` | `0.94–0.945 0.008–0.01 250` | `#EAEEF4` | Rellenos neutros azulados |
| `--muted-foreground` | `0.47 0.03 255` | `#5A6C85` | Texto secundario (≥4.5:1) |
| `--accent` | `0.9 0.09 90` | `#F2E3B3` | Ámbar suave de fondo |
| `--ring` | `0.46 0.1 255` | `#2E6DA8` | Foco visible |
| `--destructive` | `0.577 0.215 27` | `#C0452F` | Errores, acciones destructivas |
| `--border` / `--input` | `0.9 0.012 250` | `#DEE4EC` | Bordes con tinte azul |

### Modo oscuro

| Token | oklch | Rol |
|---|---|---|
| `--background` | `0.16 0.025 258` | Azul tinta profundo (no negro) |
| `--foreground` | `0.96 0.008 250` | Texto principal |
| `--card` / `--popover` | `0.20 0.03 258` | Superficie elevada |
| `--primary` | `0.70 0.11 250` | Azul UV claro, legible en dark |
| `--secondary` / `--muted` | `0.25 0.035 258` | Rellenos |
| `--muted-foreground` | `0.74 0.02 250` | Texto secundario |
| `--accent` | `0.32 0.07 85` | Ámbar oscuro |
| `--ring` | `0.70 0.11 250` | Foco visible |

### Sidebar (constante de marca, apenas cambia entre temas)

Tinta azul permanente: `--sidebar: #0A2540` (claro) / `#081A2E` (oscuro);
texto `#F1F5FA`; acento/hover `#16334F` / `#12283D`; señal dorada `#F5B800`.

### Gráficos (`--chart-1..5`)

1 azul UV · 2 dorado UV · 3 verde monitor (`0.62 0.12 165`) · 4 rojo alerta ·
5 violeta. En dark se aclaran a L 0.65–0.80.

## Tipografía

Cargada con `next/font/google` en `src/app/layout.tsx` (sin dependencias
nuevas). Utilidades Tailwind: `font-sans` (default en `body`), `font-display`,
`font-mono`.

| Cara | Rol | Variable CSS | Fallback |
|---|---|---|---|
| **Archivo** (500–800) | Display: titulares `h1–h4`, números hero, marca | `--font-archivo` | Hanken → system sans |
| **Hanken Grotesk** | Texto de trabajo: body, UI, formularios, tablas | `--font-hanken` | system sans |
| **JetBrains Mono** (400–600) | **Solo datos y medición**: métricas, telemetría, código | `--font-jetbrains` | ui-monospace |

Reglas:

- Los `h1–h4` ya heredan Archivo desde `@layer base`; no hace falta
  `font-display` en cada titular. Úsalo para elementos que tipográficamente
  son titular sin ser heading (p. ej. el nombre de marca).
- Titulares: peso 600–700, tracking heredado de Archivo (no lo cierres más de
  `-0.02em`; piso absoluto `-0.04em`). `text-wrap: balance` ya está aplicado.
- Escala: `text-display` (2.5rem/1.1) para héroes de vista; `text-title`
  (1.75rem/1.15) para títulos de sección; pasos de Tailwind (`text-lg`,
  `text-base`, `text-sm`, `text-xs`) para el resto. Máximo display: 6rem.
- Cuerpo: `text-sm` a `text-base`, medida 65–75ch en textos largos.
- Mono **nunca** como disfraz "técnico" de párrafos o etiquetas: solo números
  medidos, código y telemetría.

## Radios

`--radius: 0.75rem`; escala derivada: `rounded-sm` 0.5rem, `rounded-md`
0.625rem, `rounded-lg` 0.75rem, `rounded-xl` 1rem. Paneles de instrumento:
amables pero precisos. No mezclar radios arbitrarios (`rounded-[7px]`).

## Sombras (elevación)

Siempre con offset y blur suave, tintadas con la tinta azul en claro y negro
profundo en oscuro (los tokens se redefinen solos en `.dark`). Utilidades
estándar: `shadow-xs` → `shadow-xl`.

| Utilidad | Uso |
|---|---|
| `shadow-xs` | Bordes elevados mínimos (chips, inputs) |
| `shadow-sm` | Tarjetas en reposo, botones primarios |
| `shadow-md` | Tarjetas en hover (ver `hover-lift`), dropdowns |
| `shadow-lg` | Popovers, diálogos |
| `shadow-xl` | Modales sobre overlay |

Prohibido: halos de color sin offset (`shadow-amber-500/20` como decoración),
sombras duras tipo neobrutalismo.

## Motion

Lenguaje: ease-out exponencial `cubic-bezier(0.16, 1, 0.3, 1)` (token
`--ease-out-expo`, utilidad `ease-out-expo`), duraciones **150–350 ms**, todo
desde un estado ya visible hacia su reposo. Un momento de motion con propósito
por pantalla, no efectos dispersos.

| Token / utilidad | Duración | Uso |
|---|---|---|
| `animate-fade-in` | 250 ms | Aparición simple (overlays, tooltips) |
| `animate-fade-in-up` | 350 ms | Entrada de vistas y secciones (ya usado por el router) |
| `animate-slide-in-right` | 300 ms | Paneles laterales (chat) |
| `animate-scale-in` | 200 ms | Popovers, menús |
| `animate-shimmer` | 1.6 s loop | Shimmer de skeletons |
| `.stagger-children` | 320 ms + 50 ms/hijo | Listas: hijos entran en cascada (hasta 8, luego tope 400 ms) |
| `.hover-lift` | 200 ms | Tarjetas interactivas: `translateY(-2px)` + `shadow-md` |
| `.skeleton` | 1.6 s loop | Estado de carga con shimmer sobre `--muted` |

`prefers-reduced-motion: reduce` desactiva toda animación y transición a nivel
global (ya en `@layer base`); no añadas excepciones.

## Dos y don'ts

**Sí:**

- Escaneabilidad primero: grupos compactos, separación generosa entre
  secciones, más espacio sobre un titular que bajo él.
- El ámbar `#F5B800` para señalar: insignia, racha activa, ítem de navegación
  activo, foco en el sidebar.
- El verde monitor solo para éxito/datos; el rojo solo para error/alerta.
- Texto secundario sobre superficies de color teñido desde ese color o el
  foreground — nunca gris neutro sobre color.
- Skeletons (`.skeleton`) en cargas; estados vacíos con copy en español que
  nombre la acción siguiente.
- Focus de teclado siempre visible (el anillo `--ring` ya está en base).

**No:**

- Fondo blanco puro ni negro puro; nada de gradientes de texto ni glass
  decorativo.
- Tarjetas dentro de tarjetas; mismas tarjetas icono+título+texto como
  estructura de página.
- `border-left`/`border-right` de color de más de 1px en tarjetas o alertas.
- Eyebrows en mayúsculas tracked sobre cada sección; números de sección
  "01 / 02" decorativos.
- Mono como estética; mono es para medir.
- Hex de marca fuera de los tokens (usa `text-brand`, `bg-brand-gold`,
  `bg-sidebar`); si una vista heredada los tiene, se migran al token al tocarla.
- Duraciones >350 ms, ease `linear` en UI (salvo shimmer), animaciones de
  entrada idénticas en cada sección.

## Accesibilidad

- Contraste: texto ≥4.5:1 (`--muted-foreground` cumple sobre background/card
  en ambos temas), texto grande ≥3:1. Verificar cualquier combinación nueva.
- Foco visible con `ring-2 ring-ring/50 ring-offset-2` (aplicado en base a
  `a`, `button`, inputs y `[role="button"]`).
- `prefers-reduced-motion` respetado globalmente.

## Componentes de contenido del curso (Reader 2.0)

Componentes del render Markdown del estudiante (`src/lib/course-content.tsx` →
`<CourseMarkdown>`), fieles al mundo "Instrumento de precisión":

- **Bloque de código** (`app/code-block.tsx`): panel de instrumento en tinta
  `#0A2540` (constante en ambos temas) con barra superior: lenguaje en mono
  uppercase y botón "Copiar". Resaltado hljs con tema propio en `globals.css`:
  tokens claros sobre tinta (≥4.5:1); el dorado UV solo en números/literales
  (datos) y el verde monitor en strings.
- **Callouts tipados** (`app/callout.tsx`): `> [!nota]` (azul brand, Info),
  `> [!advertencia]` (ámbar, TriangleAlert), `> [!seguridad]` (destructivo
  suave, Zap — seguridad eléctrica, tema central del curso), `> [!dato]`
  (verde monitor, Lightbulb), `> [!ejemplo]` (neutro, BookOpen). Caja de fondo
  suave + icono + etiqueta; **nunca** `border-left` de color grueso. Un
  blockquote sin marca conserva la caja ámbar genérica.
- **Tablas GFM**: tarjeta con hairline y scroll horizontal; cabecera
  `bg-muted`, filas separadas por hairline, `tabular-nums` para alinear datos.
- **Fórmulas KaTeX**: `$...$` inline y `$$...$$` en bloque con scroll
  horizontal; heredan `currentColor` (sirven en claro y oscuro).
- **Repaso rápido** (`app/quick-check.tsx`, fence ` ```repaso ` con `P:`/`R:`):
  tarjeta porcelana con pregunta, "Ver respuesta" y auto-reporte ("Lo tenía
  claro" verde monitor / "A repasar" ámbar). Es recall, no evaluación: sin envío.
- **Glosario** (`app/glossary-block.tsx`, fence ` ```glosario ` con
  `Término :: definición`): "Términos clave" en filas expandibles (click/
  teclado), chevron que rota; definición en texto secundario.
- **Imágenes** (`app/content-image.tsx`): click amplía en diálogo; el `alt`
  descriptivo (que no parezca nombre de archivo) se muestra como caption en
  mono xs.
- **Headings H2/H3**: ancla + botón `#` al hover que copia el enlace directo.

## Referencia de archivos

- Tokens y motion: `src/app/globals.css` (`@theme`, `@theme inline`, `:root`,
  `.dark`, keyframes, utilidades).
- Fuentes: `src/app/layout.tsx` (`next/font/google`: Archivo, Hanken Grotesk,
  JetBrains Mono).
- `tailwind.config.ts`: **inerte** (Tailwind v3 legacy); no editar.
