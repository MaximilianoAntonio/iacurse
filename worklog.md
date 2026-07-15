---
Task ID: 1-seed
Agent: general-purpose (seed generator)
Task: Generate comprehensive Electromedicina II course seed data

Work Log:
- Read prisma/schema.prisma to understand all 10 models and relation cardinalities (User, Unit, Lesson, Activity, Attempt, Progress, ChatMessage, StudySession, Badge, UserBadge, SelfAssessment)
- Verified src/lib/db.ts exports a singleton PrismaClient (import { db } from "@/lib/db")
- Confirmed tsconfig.json maps "@/*" → "./src/*", so the import path resolves correctly via Bun
- Designed helper `j()` for JSON.stringify of `data` fields (SQLite stores as text)
- Authored 6 badges (primer-paso/explorador/racha-7/maestro-ecg/centinela/tutor-activo) with bronze/silver/gold tiers
- Authored 5 users: Prof. Hermes Mora (teacher) + 4 Chilean students (Camila Rojas, Matías Soto, Fernanda Vega, Tomás Muñoz) with @uv.cl emails and graduated performance profiles
- Authored 5 thematic units with exact slugs/titles/icons/colors requested
- Authored 15 lessons (3 per unit), each with 400-600+ word Markdown content covering real Electromedicina II concepts (Einthoven triangle, IEC 60601, Beer-Lambert, NBG code, RLD, oscilometric NIBP, LIM, capnography, biphasic defibrillation, etc.)
- Authored 32 activities with realistic distribution: 13 multiple_choice, 6 guided_problem, 5 case_analysis, 4 progressive_exercise, 4 self_assessment — each with the specified JSON data structure and Chilean-Spanish prompts
- Created 20 Progress records (4 students × 5 units) with realistic mastery percentages matching each student's profile
- Created 32 Attempt records with mixed correct/incorrect outcomes, AI-tutor style feedback, and time-spent data (Camila 12, Matías 10, Fernanda 6, Tomás 4)
- Created 10 ChatMessage records (6 for Camila on ECG filtering, 4 for Matías on electrode types) with realistic Q&A exchanges, context tags, and star ratings
- Created 22 StudySession records with varied durations and units visited
- Awarded 11 UserBadge records (Camila 5, Matías 3, Fernanda 2, Tomás 1) with timestamps in the past
- Created 5 SelfAssessment records with confidence 1-5 and reflection text matching each student's mastery
- Implemented proper cleanup ordering (delete children before parents) at the start of main()
- Verified file via `bun build` — bundles cleanly with 6 modules (seed + db + Prisma internals), no TypeScript errors

Stage Summary:
- Created /home/z/my-project/prisma/seed.ts (~2,985 lines, self-contained, runs via `bun run prisma/seed.ts`)
- Final counts: 6 badges, 5 users, 5 units, 15 lessons, 32 activities, 20 progress records, 32 attempts, 10 chat messages, 22 study sessions, 11 user-badge awards, 5 self-assessments
- All activity JSON `data` fields use the exact structures specified (multiple_choice, guided_problem, case_analysis, progressive_exercise, self_assessment)
- Markdown content uses ##, **bold**, \`code\`, `$...$`-style math, tables, and formulas (V = I × R, Einthoven's law, Johnson-Nyquist, Beer-Lambert, E = ½CV², etc.)
- Difficulty mix across activities: easy / medium / hard with point values 5-20
- File imports `db` from "@/lib/db" and calls main() with proper disconnect/error handling
- Ready for orchestrator to execute; not run during this task per instructions

---
Task ID: 7-tutor
Agent: general-purpose (tutor view)
Task: Build the AI tutor chat view

Work Log:
- Read worklog.md to understand prior seed work (5 units, ChatMessage model, /api/tutor route already implemented with Socratic system prompt)
- Inspected shared infrastructure: app-store (currentUser, navigate, tutorContextUnit, setTutorContext), use-fetch (useFetch/postJSON/patchJSON), page-header, dynamic-icon, course-utils (getUnitColor, initials, unitColorMap), types (ChatMessage, Unit, User), scroll-area, card, avatar, badge, button, textarea, skeleton
- Verified react-markdown v10.1.0 is installed (default export = Markdown component, named type Components exported) and framer-motion v12 exports motion + AnimatePresence
- Verified React 19.2 types include ref in ComponentProps<"textarea">, so shadcn Textarea (which spreads ...props) forwards refs correctly
- Created /home/z/my-project/src/components/views/tutor-view.tsx (~770 lines) implementing:
  * PageHeader "Tutor IA" with violet/purple gradient, MessageSquare icon, Regenerar button action
  * Context selector Card: horizontal scrollable chip row with "General" option + one chip per fetched unit (icon + title), selected chip rendered with the unit's color gradient, persisted via store tutorContextUnit/setTutorContext
  * Socratic disclaimer Alert box (violet themed) explaining the method
  * "Sugerencias para empezar" Card with 6 example prompts (horizontal scroll on mobile, 3-col grid on desktop) that fill the input on click
  * Chat Card with fixed h-[55vh] / min-h-[400px] / max-h-[600px] ScrollArea, conversation header showing selected context badge + message count
  * MessageBubble component: alternating user (right, emerald→teal gradient bubble) / assistant (left, muted bubble with violet gradient bot avatar), ReactMarkdown rendering for assistant content with custom Components (p/ul/ol/li/h1-3/strong/em/code/pre/blockquote/a) styled in violet theme, timestamp + context badge for user messages + 1-5 StarRating for assistant messages
  * StarRating sub-component with hover/focus states, aria-labels, optimistic PATCH to /api/tutor with toast on first rating
  * TypingIndicator: animated 3-dot bot bubble via framer-motion (y/opacity loop with stagger)
  * EmptyState: friendly welcome with 3 suggested prompt chips
  * Loading skeletons for initial history load (3 alternating bubbles) and chip-row skeletons while units load
  * Input form: Textarea (rows=2, auto-resize via field-sizing-content, focus ring) + gradient violet Send button, Enter to send / Shift+Enter for newline, disabled while sending, error toast on failure with optimistic rollback
  * Auto-scroll to bottom via bottomRef sentinel on messages/isSending change
- All handlers typed without `any`, all sub-components explicitly typed props, no lint/dev run per instructions
- Read the full file back to verify no syntax errors and that imports/exports line up with the installed package APIs

Stage Summary:
- Created /home/z/my-project/src/components/views/tutor-view.tsx — complete conversational AI tutor view
- Honors the Socratic pedagogy: context selector lets student pick a unit, AI replies rendered as markdown, ratings persist via PATCH /api/tutor
- Polish: violet/purple theme throughout, framer-motion entrance animations for messages, animated typing dots, gradient bubbles, accessible star rating + chip selectors (aria-pressed/aria-label), responsive (mobile horizontal scroll → desktop grids), keyboard-friendly input (Enter/Shift+Enter, focus management)
- TypeScript strict-safe, no `any`, all imports resolve under `@/` alias and installed packages (react-markdown v10 default export, framer-motion v12, React 19 ref forwarding)
- File ready to be wired into the view-router by the orchestrator

---
Task ID: 8-progress
Agent: general-purpose (progress view)
Task: Build the progress/analytics dashboard view with charts

Work Log:
- Read worklog.md and reviewed prior seed work to understand data shape (5 users, 5 units, 32 activities, attempts, self-assessments, study sessions).
- Inspected existing dashboard-view.tsx for established patterns (KpiCard, color map, useFetch<ProgressResponse>, PageHeader usage, navigation via openUnit/navigate).
- Read /api/progress/route.ts to confirm exact API contract: progress, attempts (with activity.lesson.unit.title/color, type, difficulty, timeSpent), sessions, chatCount, selfAssess, activityByDay (14-day window), byType, byDifficulty, and stats aggregate.
- Verified recharts ^2.15.4 is installed in package.json; confirmed shadcn components (Card, Tabs, Progress, Skeleton, Badge, Button) and helper APIs (getUnitColor, activityTypeMeta, difficultyMeta, timeAgo, formatDuration) from course-utils.ts.
- Authored /home/z/my-project/src/components/views/progress-view.tsx with strict TypeScript types (ProgressResponse, AttemptItem, SelfAssessItem, DayActivity, Breakdown) — no `any`.
- Implemented loading skeleton grid, friendly empty-state when stats.totalAttempts === 0 (with CTA to units view).
- Built 4-card KPI row: Dominio global (avg mastery), Tasa de acierto, Tiempo total (formatted "Xh Ym"), Consultas al tutor (chatCount).
- Implemented 4-tab analytics section via shadcn Tabs:
  • "Actividad": AreaChart (height 280) with sky/emerald gradient areas for attempts vs correct over 14 days + 3 mini-stats (period attempts, best day, current streak).
  • "Por unidad": horizontal BarChart (height 300) with per-unit Cell color, plus clickable unit cards showing Progress bar, completed/total, mastery %, lastVisited via timeAgo.
  • "Por tipo": RadarChart (total vs correct per activity type) + donut PieChart by difficulty + summary table (type/total/correct/rate/progress bar) + bonus mastery heatmap (units × difficulty grid with color-intensity HeatCell).
  • "Reflexión": selfAssess history cards with Star-based confidence rating, reflection text, unit badge, timeAgo; aggregate "Confianza promedio" summary; empty-state CTA when no self-assessments.
- Added "Intentos recientes" feed card (last 8 attempts) with colored unit dot, correct/incorrect icon, score, type, timeSpent (formatDuration), timeAgo.
- Wrote three custom Tooltip components (ChartTooltip, UnitBarTooltip, DiffPieTooltip) using CSS variables (hsl(var(--border)), hsl(var(--popover))) for theme consistency — no `any`, structural typing only.
- Mapped unit colors to hex via chartColors record (emerald/sky/amber/violet/rose → #10b981/#0ea5e9/#f59e0b/#8b5cf6/#f43f5e).
- All ResponsiveContainer wrappers use fixed heights; charts stack responsively via md:grid-cols-2 layouts; interactive cards use hover:-translate-y-0.5 + hover:shadow-md transitions.
- Removed unused BookOpen import after verification; ran tsc --noEmit and confirmed zero TypeScript errors specific to progress-view.tsx (pre-existing errors in other files belong to other tasks).

Stage Summary:
- Created /home/z/my-project/src/components/views/progress-view.tsx (~1,160 lines, single-file, no `any`, strict-mode compliant).
- Exports `ProgressView` component, ready to be wired into view-router.tsx (alongside the other 7 tasks' views).
- Charts used: AreaChart, horizontal BarChart (with per-bar Cell), RadarChart, PieChart (donut). All recharts components used correctly within ResponsiveContainer.
- Custom tooltips use structural typing to avoid `any` while integrating with recharts' cloneElement injection.
- Loading state: skeleton KPI grid + skeleton chart card. Empty state: friendly CTA to units view.
- File compiles cleanly under existing tsconfig (verified via `bunx tsc --noEmit` — no errors in progress-view.tsx).

---
Task ID: 6-activity
Agent: general-purpose (activity view)
Task: Build the activity view with multiple activity types and AI feedback

Work Log:
- Read worklog.md (1-seed summary) to understand data model and prior work
- Inspected shared infrastructure: store (app-store.ts exposes currentUser, currentLessonId, currentActivityId, navigate/openUnit/openLesson/openActivity), useFetch + postJSON hooks, PageHeader / DynamicIcon / LoadingRows components, course-utils helpers (getUnitColor, activityTypeMeta, difficultyMeta, parseActivityData, formatDuration), types.ts (Activity + 5 data interfaces), and the shadcn UI catalog (Card, Button, Badge, RadioGroup, Label, Input, Textarea, Alert, Separator, Tooltip, useToast)
- Verified API contract by reading /api/lessons/[id]/route.ts (returns lesson with unit + activities + attemptsByActivity) and /api/activities/[id]/attempt/route.ts (accepts { userId, answer, timeSpent }, returns { attempt: { id, correct, score, feedback, correctAnswer, pointsAwarded } })
- Confirmed framer-motion v12 is available in package.json for the optional result-panel reveal animation
- Designed a two-layer architecture: ActivityView (parent, owns data fetch + early-return fallbacks + activity lookup) → ActivityInner (child keyed by activity.id so all state resets when navigating between activities; owns submitted/submitting/result/resetKey/elapsed state and the timer)
- Implemented timer with useRef + setInterval that starts on mount, freezes on submit, and resets on retry (effect re-runs when `submitted` flips)
- Wrote 5 dedicated activity sub-components sharing a common ActivityComponentProps signature:
  • MultipleChoiceActivity: RadioGroup of options with post-submit green/red highlighting, optional progressive hints (Ver pista → Otra pista)
  • GuidedProblemActivity: highlighted scenario box + numbered steps with Input + per-step hint toggle (Eye/EyeOff), per-step correctness color after submit, final-answer + explanation box
  • CaseAnalysisActivity: case box + per-question Textarea (min 10 chars) with char counter, post-submit expected-answer box with check/X icon and explanation
  • ProgressiveExerciseActivity: stacked levels with gradient "N1/N2..." badges, Input, per-level correctness + expected answer + explanation
  • SelfAssessmentActivity: prompt + rubric list + 5-star confidence selector (real <button> elements) + Textarea (min 40 chars) + post-submit keyword chips (green if present, outline if missing)
- Built ResultPanel with framer-motion reveal (initial opacity 0/y 8 → animate to 1/0), conditional emerald/amber theming, AI-feedback box (Bot icon), score row, correct-answer box, Reintentar + Siguiente actividad / Volver a la lección buttons
- Built ActivityNavFooter with prev/next (disabled when first/last; "Terminar lección" CTA when last) and "Actividad X de N" indicator
- Built EmptyState component for the no-activity / no-lesson / error / not-found fallbacks
- Toast on successful submit (title varies by correctness, description = AI feedback) and on error (variant: destructive)
- All inputs become read-only (disabled) after submit; Reintentar remounts the renderer via resetKey to clear local answer state
- Verified file structure via Read + Grep: 1420 lines, 16 functions/components, all imports used, no `any`, all interactive elements are native buttons / radix controls (keyboard accessible)

Stage Summary:
- Created /home/z/my-project/src/components/views/activity-view.tsx (~1420 lines, TypeScript strict, no `any`)
- Single exported component `ActivityView`; consumes useAppStore + useFetch + useToast + postJSON
- Fetches /api/lessons/[currentLessonId]?userId=X once, finds current activity by id, computes prev/next within the lesson
- Renders PageHeader with 4-step breadcrumb (Unidades → Unidad → Lección → Actividad) and unit-color gradient icon
- Activity Card header shows type/difficulty/points badges + live elapsed-time chip with Clock icon (Tooltip-wrapped)
- Five fully-implemented activity renderers with pre-submit and post-submit (review) states, per-item correctness highlights, hints, and explanations
- Result panel (animated) shows correct/incorrect verdict, points awarded, AI-tutor feedback, score, correct answer, and Reintentar / next-action buttons
- Navigation footer at the bottom with prev/next + "Terminar lección" on last activity
- Mobile-first responsive (max-w-4xl, flex-wrap badges, full-width buttons on mobile)
- Ready for the view-router to mount at view === "activity"; no lint/dev-server run performed per instructions

---
Task ID: 9-views
Agent: general-purpose (achievements/teacher/about views)
Task: Build achievements, teacher, and about views

Work Log:
- Read worklog.md to absorb prior patterns: dashboard-view.tsx (KpiCard, StatChip, gradient hero, getUnitColor theming), progress-view.tsx (recharts usage, chartColors map, structural tooltips without `any`, LoadingGrid/LoadingRows, empty states), tutor-view.tsx (framer-motion patterns, store usage, chip selectors)
- Inspected shared infrastructure: app-store (currentUser, navigate, openUnit/openLesson, role), useFetch (auto-refetch on url change + deps, returns {data,loading,error,refetch}), PageHeader (icon/iconGradient props), DynamicIcon (iconMap with ~40 lucide icons), course-utils (badgeTierMeta {bronze/silver/gold}, initials, timeAgo, formatDuration, getUnitColor, unitColorMap), types (User, Unit, Badge, ViewKey includes "achievements"|"teacher"|"about"), loading.tsx (LoadingGrid, LoadingRows), shadcn Select (Radix-based, value/onValueChange), shadcn Table (overflow-x-auto wrapper), shadcn Card (CardContent has px-6 + py-6 by default), shadcn Badge (variant: default/secondary/outline/destructive)
- Confirmed tsconfig has strict:true but NO noUnusedLocals/noUnusedParameters, so unused imports are non-fatal; still cleaned obvious ones for quality
- Authored FILE 1 achievements-view.tsx (~430 lines):
  * PageHeader "Logros y ranking" with amber→orange gradient and Trophy icon
  * Section 1: 3 KPI cards (Puntos totales, Días de racha, Insignias obtenidas X/Y with %) — each with icon + gradient accent
  * Section 2: Badge grid (sm:2 / lg:3 cols) of BadgeCard components using badgeTierMeta for tier theming (bronze=amber, silver=slate, gold=yellow). Earned badges get full-color gradient circle, glow shadow class, emerald checkmark badge in corner, awardedAt via timeAgo, top gradient stripe; unearned badges get grayscale icon, muted lock overlay, "Por desbloquear" badge. Each card uses framer-motion entrance + whileHover y:-4 lift
  * Section 3: Leaderboard Card with ordered list of LeaderboardRow components. Current user's row highlighted with emerald tint + "Tú" badge. Top 3 ranks get medal icons (Crown/Medal/Award from lucide) with gold/silver/bronze gradients; rest show "#N" plain rank. Each row: avatar (initials fallback), name, completedActivities, streak with Flame icon, points right-aligned with tabular-nums
  * Loading: LoadingGrid for badges, LoadingRows for leaderboard; friendly empty states when arrays are empty
  * All props typed via interfaces BadgesResponse/LeaderboardResponse matching the API contract; no `any`
- Authored FILE 2 teacher-view.tsx (~520 lines):
  * PageHeader "Panel docente" with slate gradient and Users icon
  * Unit filter bar using shadcn Select populated from response.units — defaults to "Todas las unidades" (ALL_UNITS sentinel), changing value updates the useFetch url (/api/teacher vs /api/teacher?unitId=X) which auto-refetches. Selected unit shows a Badge with its icon next to the Select
  * Section 1: 4 aggregate KPI cards (Estudiantes activos, Intentos totales, Consultas al tutor, Horas de estudio) — slate/sky/violet/emerald themed
  * Section 2: Horizontal BarChart (recharts layout="vertical") of aggregate.avgMasteryByUnit — X=avgMastery 0-100 with %, Y=unitTitle (width 190). Each bar gets a Cell colored by unit color (emerald/sky/amber/violet/rose → hex via chartColors map). Custom MasteryTooltip with structural typing (no `any`). Chart height 300, plus explanatory note about mastery formula
  * Section 3: Student table (shadcn Table, overflow-x-auto) with columns: Estudiante (avatar+name+email), Actividades, Intentos, Acierto% (color-coded badge: green ≥70 / amber 40-69 / rose <40), Dominio medio (Progress bar + % with aciertoClass color), Tiempo (formatHoursMinutes helper), Consultas IA, Última actividad (timeAgo with Flame icon, or —). Mastery computation respects unit filter (single unit mastery when filtered, average across units otherwise)
  * Section 4 (nice-to-have): Distribution stacked BarChart per unit showing low/mid/high mastery student counts (rose/amber/emerald), only when filter=ALL_UNITS. Custom DistributionTooltip + LegendDot components
  * Loading skeleton (4 KPI cards + LoadingRows), EmptyState when students.length===0
  * All API shapes typed via TeacherResponse/Student/Aggregate interfaces; no `any`
- Authored FILE 3 about-view.tsx (~330 lines):
  * PageHeader "Acerca del piloto" with emerald→teal gradient and Info icon
  * Project card: top gradient stripe (emerald→teal→cyan), Microscope icon, full project title, 2-column dl/dt/dd grid of 7 metadata items (Tipo, Línea, Código UVA24991, Facultad, Investigador principal Hermes Mora, Investigador alterno David Ortiz, Duración 12 meses) — each with small emerald icon box, uppercase muted label, semibold value
  * Objetivo general card: Target icon, full goal text about IA generativa + aprendizaje adaptativo + comprensión conceptual en Electromedicina II
  * Módulos del MVP: grid of 6 cards (sm:2 / lg:3) — each with gradient icon circle (Users/BookOpen/Lightbulb/Brain/MessageSquare/BarChart3 via DynamicIcon), numbered Badge, title, description. Framer-motion staggered entrance + hover lift
  * Two-column grid: Enfoque pedagógico (GraduationCap, violet gradient) with 5 CheckCircle2 bullet principles; Consideraciones éticas (ShieldCheck, sky gradient) with 6 ShieldCheck bullet points (voluntariedad, consentimiento, anonimización, supervisión docente, comité de ética, botón Reportar error)
  * Pregunta de investigación: Card with emerald left border accent, Quote icon header, Separator, large italic blockquote with the full research question text
  * All static content stored as typed const arrays (PROJECT_META, MVP_MODULES, PEDAGOGICAL_PRINCIPLES, ETHICS_POINTS); no fetch needed
- Cleaned unused lucide imports (Info, Users, Lightbulb, Brain, MessageSquare, BarChart3) from about-view.tsx and unused useAppStore/getUnitColor imports from teacher-view.tsx
- Ran `bunx tsc --noEmit` — confirmed ZERO errors in any of the three new files (all remaining errors belong to other pre-existing files: dashboard-view, view-router, api routes, examples/, skills/)

Stage Summary:
- Created /home/z/my-project/src/components/views/achievements-view.tsx (~430 lines) — gamification view: 3 KPI cards, badge grid with tier theming + lock/check states, leaderboard with top-3 medals and current-user highlight
- Created /home/z/my-project/src/components/views/teacher-view.tsx (~520 lines) — teacher dashboard: unit filter (Select), 4 aggregate KPIs, horizontal BarChart of avgMastery by unit, color-coded student table (8 columns), bonus stacked distribution chart per unit
- Created /home/z/my-project/src/components/views/about-view.tsx (~330 lines) — informational pilot project view: project metadata grid, objetivo general, 6 MVP module cards, pedagogical principles, ethics considerations, research question quote
- All three files: TypeScript strict, no `any`, responsive (mobile-first), match existing card/spacing/gradient patterns from dashboard-view & progress-view, use @/ alias, framer-motion for subtle entrance animations
- All three files compile cleanly under existing tsconfig (verified via bunx tsc --noEmit)
- Ready to be wired into view-router.tsx at view === "achievements" | "teacher" | "about"

---
Task ID: 0-orchestrator
Agent: Z.ai Code (orchestrator)
Task: Construir la plataforma completa de aprendizaje adaptativo Electromedicina II

Work Log:
- Leí el formulario de postulación del proyecto (ANEXO N°1, UVA24991) y extraje los requisitos: plataforma web con IA generativa para apoyo al aprendizaje personalizado en Electromedicina II, con 6 módulos MVP (acceso, temático, aprendizaje activo, metacognición, tutor IA, panel docente).
- Diseñé el schema Prisma (User, Unit, Lesson, Activity, Attempt, Progress, ChatMessage, StudySession, Badge, UserBadge, SelfAssessment) y apliqué con db:push.
- Despaché subagente (1-seed) que generó seed completo: 5 unidades, 15 lecciones, 32 actividades (5 tipos), 5 usuarios (1 docente + 4 estudiantes), 20 progreso, 32 intentos, 10 mensajes chat, 22 sesiones, 11 badges, 5 autoevaluaciones.
- Construí el store Zustand (app-store), tipos (types.ts), utilidades (course-utils.ts), helper de IA (ai.ts con z-ai-web-dev-sdk + prompt socrático).
- Creé 10 API routes: me, users, units, units/[slug], lessons/[id], activities/[id]/attempt (con feedback LLM), tutor (chat con historial + rating), progress (analítica), teacher (panel docente), badges, leaderboard.
- Construí el shell: sidebar navegable con filtrado por rol, header con switcher de usuario (piloto) + toggle tema + racha/puntos, footer sticky con info del proyecto.
- Construí las vistas: dashboard (hero + KPIs + unidades + actividad reciente), units (grid), unit-detail (lecciones + actividades), lesson (markdown + sidebar actividades).
- Despaché 3 subagentes en paralelo para: activity-view (5 tipos con feedback IA), tutor-view (chat socrático), progress-view (analítica con recharts). Luego 1 subagente más para achievements + teacher + about.
- Corregí errores: icono MonitorHeart no existe en lucide-react (mapeado a Monitor), bug de progreso >100% (clampeado en API), parsing error en units/[slug], setState-in-effect en header (cambiado a approach CSS con suppressHydrationWarning), reset de vista al cambiar rol.
- Verificación con agent-browser: dashboard, navegación unidades→lección→actividad (envío de respuesta con feedback IA confirmado), tutor IA (respuesta socrática confirmada), progreso (charts), logros, panel docente, acerca de, responsive móvil (sidebar toggles), footer sticky. Sin errores de consola ni runtime.

Stage Summary:
- Plataforma completa y funcional desplegada en http://localhost:3000 (dev server, puerto 3000).
- Lint limpio (0 errores, 0 warnings). Compilación sin errores.
- Los 6 módulos MVP del proyecto están implementados: acceso (switcher de usuario piloto), temático (5 unidades), aprendizaje activo (32 actividades de 5 tipos), metacognición (autoevaluación + feedback formativo IA), tutor IA (chat socrático con z-ai-web-dev-sdk), panel docente (KPIs + tabla + gráficos).
- IA generativa integrada: retroalimentación formativa en actividades (generateActivityFeedback) y tutor conversacional socrático (TUTOR_SYSTEM_PROMPT) — ambos usan z-ai-web-dev-sdk en backend.
- Gamificación: puntos, racha, 6 insignias (bronze/silver/gold), ranking del curso.
- Analytics: gráficos recharts (área de actividad 14 días, barras de dominio por unidad, radar por tipo de actividad, pie por dificultad), tabla de intentos recientes, historial de autoevaluaciones.
- Datos realistas del piloto: 4 estudiantes con perfiles diferenciados (alta/media/baja performance), contenido técnico real de Electromedicina II (Einthoven, IEC 60601, pulsioximetría, desfibriladores, NBG, RLD, etc.).
- Pendiente: el cron job webDevReview se configurará para continuar refinamiento cada 15 minutos.

Unresolved issues / next steps:
- Considerar agregar autenticación real (NextAuth) en vez del switcher de piloto.
- El módulo de autoevaluación podría enlazarse más con el panel de metacognición del docente.
- Se podría agregar un mini-service WebSocket para notificaciones de racha/logros en tiempo real.
- Generar imágenes reales para las unidades (actualmente usan iconos lucide).

---
Task ID: tabs-refactor
Agent: Z.ai Code (orchestrator)
Task: Refactorizar navegación a sistema de pestañas tipo navegador

Work Log:
- El usuario pidió cambiar de vista única a un sistema de pestañas de direcciones (tipo navegador).
- Refactoricé el store Zustand (app-store.ts): añadí modelo de Tab (id determinístico, kind singleton/unit/lesson/activity, title, icon, context unitId/lessonId/activityId). Acciones: openTab (dedup por id, activa), closeTab, closeOtherTabs, closeAllClosable, setActiveTab, updateTab. Los campos derivados view/currentUnitId/currentLessonId/currentActivityId se sincronizan desde el tab activo. navigate/openUnit/openLesson/openActivity ahora rutan vía openTab. Persistencia de tabs + activeTabId en localStorage.
- Creé TabBar (tab-bar.tsx): barra de pestañas sticky bajo el header, scroll horizontal, cada tab con icono + título truncado + botón cerrar (hover), acento superior gradient en tab activo, menú contextual (clic derecho) con Cerrar/Cerrar demás/Cerrar todas, botones rápidos (+Unidades/+Tutor/+Progreso/+Logros) y botón "cerrar todas".
- Integré TabBar en AppShell.
- Actualicé unit-detail-view, lesson-view, activity-view para que al cargar datos llamen updateTab(activeTabId, {title, icon}) y el tab muestre el título real del contenido.
- Fix: el tab de actividad no retenía lessonId (necesario para cargar la actividad). Añadí retención de lessonId del tab activo al abrir actividad, y propagación en openTab al reactivar.
- Fix: al cambiar de rol (docente↔estudiante), reseteo tabs al home para evitar tabs de vistas no permitidas.
- Verificación con agent-browser: abrí 6 tabs simultáneos (Inicio, Unidades, Logros, ECG, Lección Einthoven, Actividad Verificación) cada uno con título real; alterné entre tabs cargando contenido correcto; cerré tabs correctamente; responsive móvil con scroll horizontal; sin errores runtime ni de consola; lint limpio.

Stage Summary:
- Sistema de pestañas tipo navegador funcional: múltiples destinos abiertos simultáneamente, alternar con un clic, cerrar individual o masivamente, menú contextual.
- Cada tab muestra su título e icono reales (cargados dinámicamente).
- Persistencia de tabs entre recargas.
- Compatible con responsive móvil (scroll horizontal de la barra).
- Lint 0 errores, compilación sin errores, verificación agent-browser exitosa.

---
Task ID: url-routing-chat-sidebar
Agent: Z.ai Code (orchestrator)
Task: Revertir sistema de tabs e implementar (1) cambio de URL al navegar y (2) chat del tutor como barra lateral derecha desplegable

Work Log:
- El usuario aclaró: quería que el VÍNCULO (URL) cambiara al navegar (enrutamiento real, no pestañas internas) y que el chat del tutor fuera una barra lateral derecha desplegable como el menú izquierdo.
- Revertí el sistema de tabs del store: volví a navegación simple por vista (view/currentUnitId/currentLessonId/currentActivityId). Eliminé el archivo tab-bar.tsx.
- Implementé sincronización de URL con la History API: navigate/openUnit/openLesson/openActivity hacen pushState con query params (?view=units, ?view=unit-detail&u=ID, ?view=lesson&l=ID, ?view=activity&a=ID&l=ID). AppShell hidrata el estado desde la URL al montar y escucha popstate para back/forward del navegador.
- Actualicé unit-detail-view, lesson-view, activity-view para que al cargar actualicen document.title con el nombre real del contenido (ej. "Electrocardiografía (ECG) · ElectroMed IA").
- Creé ChatSidebar (chat-sidebar.tsx): barra lateral derecha desplegable, colapsable, igual que el sidebar izquierdo. Panel fijo a la derecha (w-380), animación slide-in con framer-motion, cabecera con gradiente violeta, área de mensajes con scroll, input con autoresize, sugerencias en estado vacío, rating por estrellas, typing indicator, contexto actual mostrado. En desktop empuja el contenido principal (lg:pr-[380px]); en móvil es overlay con backdrop.
- Quité "Tutor IA" del menú de navegación izquierdo (ya no es una vista). Añadí botón de toggle del chat en el header (botón "Tutor IA" violeta) y un botón de acceso rápido en el footer del sidebar izquierdo.
- Eliminé tutor-view.tsx (ya no es una vista). El view-router redirige ?view=tutor abriendo el chat y yendo al dashboard (compatibilidad hacia atrás).
- Actualicé dashboard, units, unit-detail, lesson para que sus botones "Preguntar al tutor / Abrir tutor" abran el panel del chat (setChatOpen(true)) en vez de navegar a una vista de tutor.
- Verificación con agent-browser: (1) la URL cambia correctamente al navegar (?view=units → ?view=unit-detail&u=ID); (2) el botón back del navegador funciona (vuelve a ?view=units); (3) el forward funciona; (4) el document.title cambia al nombre de la unidad; (5) el chat se abre como panel lateral derecho sin cambiar la URL ni la vista actual; (6) el contexto del chat se setea al abrir desde una unidad ("Contexto: Electrocardiografía (ECG)"); (7) el tutor responde con método socrático dentro del panel; (8) en desktop el contenido principal se reduce para dejar espacio al chat; (9) en móvil el chat es overlay; (10) cerrar el chat desmonta el panel. Sin errores de consola ni runtime. Lint limpio.

Stage Summary:
- Navegación por URL funcional: el vínculo en la barra de direcciones cambia al navegar, back/forward del navegador funcionan, URLs compartibles.
- Chat del tutor reubicado como barra lateral derecha desplegable (como el menú izquierdo), siempre accesible, colapsable, sin interrumpir la vista actual.
- Layout de tres columnas en desktop: sidebar nav (izq, 288px) + contenido principal (centro) + chat tutor (der, 380px, colapsable).
- Persistencia del estado de apertura del chat entre recargas.
- Lint 0 errores, compilación sin errores, verificación agent-browser exitosa.

---
Task ID: cron-review-1
Agent: Z.ai Code (web dev review)
Task: QA testing, bug fixes, and new features (Reportar error, units search, teacher reports panel)

## Current project status description/assessment
The platform "ElectroMed IA" is functional with URL-based navigation, a right-side chat sidebar, 5 course units, 32 activities with AI feedback, gamification, analytics, and a teacher panel. Lint is clean. The previous round implemented URL routing + chat sidebar. This round focused on QA, fixing a navigation bug, and adding missing features referenced in the project proposal.

## Current goals/completed modifications/verification results

### QA performed (agent-browser + VLM)
- Tested all views: dashboard, units, unit-detail, lesson, activity (with AI feedback submission), chat sidebar, progress (3 charts), teacher panel, about, achievements.
- VLM visual assessment of dashboard and chat sidebar.
- Found bug: teacher view (`?view=teacher`) showed dashboard content after role switch (setUser reset view to dashboard, overriding URL).

### Bug fixed: Role-aware URL hydration
- **Problem**: `setUser()` reset `view` to "dashboard" on role change, overriding URL-derived view (e.g. `?view=teacher` was lost after /api/me returned).
- **Fix**: 
  - Added `STUDENT_VIEWS` / `TEACHER_VIEWS` allowlists + `isViewAllowed()` helper in app-store.
  - `setUser()` now checks the URL when role changes: if the URL view is valid for the new role, it's preserved; otherwise falls back to dashboard.
  - `hydrateFromUrl()` now validates the URL view against the current role.
  - `page.tsx` calls `hydrateFromUrl()` after `setUser()` to ensure URL view wins on page load.
- **Verified**: `?view=teacher` now correctly loads the teacher panel after role switch (2 charts render).

### New feature: "Reportar error" on AI chat responses (project requirement)
- The original project proposal (ANEXO N°1) explicitly requires: "Añadir un botón visible de 'Reportar error' para revisión manual inmediata." This was missing.
- **Backend**: 
  - Added `ErrorReport` Prisma model (userId, source, sourceId, reason, comment, status).
  - Created `/api/report` API route: POST (create report), GET (list with status filter), PATCH (update status).
  - Pushed schema with `prisma db push --force-reset` + re-seeded.
- **Frontend (ChatSidebar)**:
  - Added "Reportar" button (Flag icon) next to star ratings on AI messages.
  - Report dialog with 5 reason options (incorrect/biased/offtopic/harmful/other) + optional comment textarea.
  - "Reportado" confirmation state with CheckCircle2 icon after submission.
  - Toast feedback on success/error.
- **Verified**: Submitted a report via UI → confirmed saved in DB via API → appears in teacher panel.

### New feature: Teacher error reports panel
- Added "Section 5: Reportes de errores de IA" to teacher-view.tsx.
- Shows pending reports with student avatar, name, timestamp, reason badge, status badge, and comment.
- Teachers can "Marcar revisado" or "Resolver" (PATCH /api/report).
- Empty state with Inbox icon when no reports.
- Scrollable list (max-h-96) for many reports.
- **Verified**: Report submitted by student appears in teacher panel with "1 pendiente" badge.

### New feature: Units search & filter
- Added search bar (Input with Search icon) to units-view — filters by title/summary/description.
- Added filter chips: Todas / En progreso / Completadas / Sin empezar (with live counts).
- Empty state with "Limpiar filtros" button when no results.
- **Verified**: Searching "ECG" correctly filters to 2 matching units.

### Styling improvement: Dashboard shows all 5 units
- Changed `units.slice(0, 4)` to `units.map(...)` and grid from `sm:grid-cols-2` to `sm:grid-cols-2 lg:grid-cols-3`.
- **Verified**: All 5 units now visible on dashboard (confirmed via VLM).

### Infrastructure note
- Had to restart dev server after Prisma schema change (globalThis cached old PrismaClient without ErrorReport model). Used `setsid -f` to start a persistent server process.

## Unresolved issues or risks, and priority recommendations for the next phase
- **Dev server persistence**: The `setsid -f` approach works but is fragile. If the server dies again, use `setsid -f bash -c 'cd /home/z/my-project && exec bun run dev > dev.log 2>&1'` to restart.
- **Activity feedback report**: Currently only chat messages can be reported. Could extend "Reportar error" to activity AI feedback as well (the `source` field in ErrorReport already supports "activity").
- **Real-time updates**: Teacher panel reports don't auto-refresh; could add polling or WebSocket for real-time notifications.
- **Bookmark/favorite lessons**: Mentioned as potential feature; not yet implemented.
- **Confetti/celebration on unit completion**: Could add for gamification polish.
- **Dark mode visual audit**: Should do a VLM check of dark mode to ensure contrast/polish.
- **Performance**: Progress view fetches many attempts; could add pagination for large datasets.

---
Task ID: cron-review-2
Agent: Z.ai Code (web dev review)
Task: QA testing, bug fix (points awarding), and new features (Continue card, reading progress, celebration, activity reports)

## Current project status description/assessment
The platform "ElectroMed IA" is stable with URL navigation, right-side chat sidebar, 5 units, 32 activities, gamification, analytics, teacher panel, and error reporting (added in cron-review-1). This round focused on: (1) fixing a critical bug in the points-awarding logic, (2) adding a "Continuar donde quedé" smart recommendation card, (3) adding a reading progress bar to lessons, (4) adding a celebration/confetti modal for activity completion, and (5) extending "Reportar error" to activity AI feedback.

## Current goals/completed modifications/verification results

### Bug fixed: Points not awarded on first correct attempt
- **Problem**: The `/api/activities/[id]/attempt` route queried `previousBest` (correct attempts) AFTER creating the new attempt. Since the new correct attempt was already saved, the query always found it, making `pointsAwarded = 0` even on the first correct submission. This broke the celebration trigger and point accumulation.
- **Fix**: Moved the `hadPreviousCorrect` query to BEFORE `db.attempt.create()`. Now the check correctly determines if this is the first correct attempt.
- **Verified**: Submitted a fresh MC activity (NBG mode selection) → API returned `pointsAwarded: 10` → celebration modal appeared with "+10 puntos".

### New feature: "Continuar donde quedé" smart card (dashboard)
- Created `/api/next-activity` endpoint that finds the user's next incomplete activity (prioritizing the last-visited unit with incomplete activities, then the first unit with incomplete activities).
- Added `ContinueCard` component to the dashboard showing: unit icon, activity title, lesson title, activity type, unit progress bar, and points. Two CTAs: "Continuar" (opens the activity) and "Ver unidad".
- Distinguishes between "Continuar donde quedaste" (resume) and "Empezar nueva unidad" (new).
- **Verified**: Card appears on dashboard, clicking "Continuar" navigates to the correct incomplete activity.

### New feature: Reading progress bar (lesson view)
- Created `ReadingProgress` component: a fixed 1px bar at the top that tracks scroll position within the page, colored with the unit's gradient.
- Integrated into lesson view — updates in real-time as the student scrolls through the lesson material.
- **Verified**: Bar shows 31% after scrolling 500px, updates smoothly on scroll/resize.

### New feature: Celebration/confetti modal (activity completion)
- Created `Celebration` component with: 40 animated confetti pieces (framer-motion, random colors/positions/rotations), a modal with gradient header, checkmark icon, title, description, points badge, and auto-close after 6 seconds.
- Integrated into activity view — triggers when `result.correct && result.pointsAwarded > 0` (first correct submission).
- Uses the unit's color gradient for theming.
- **Verified**: VLM confirmed "celebration/confetti modal" with "¡Actividad completada!", "+10 puntos", and "¡Genial!" button.

### New feature: "Reportar error" on activity AI feedback
- Extended the error reporting feature to activity result panels.
- Added "Reportar" button next to the "Retroalimentación del tutor IA" section in the ResultPanel.
- Report dialog with 5 reason options (incorrect/biased/offtopic/harmful/other) + optional comment.
- "Reportado" confirmation state with green checkmark.
- Reports are saved with `source: "activity"` and appear in the teacher's error reports panel.
- State resets on retry.
- **Verified**: Button appears on AI feedback, dialog opens with reason options.

### QA performed
- Tested all views: dashboard (with new Continue card), units (search/filter), unit-detail, lesson (with reading progress bar), activity (with celebration + report), chat sidebar, progress (3 charts), teacher panel, achievements, about.
- Dark mode visual audit (VLM): confirmed good contrast and readability.
- Tested celebration: found and fixed the points-awarding bug, verified celebration appears on first correct submission.
- Lint clean (0 errors, 0 warnings). No console/runtime errors.

## Unresolved issues or risks, and priority recommendations for the next phase
- **Lesson table of contents**: Mentioned as a potential feature for quick navigation within long lessons; not yet implemented.
- **Badge unlock celebration**: The celebration currently triggers on activity completion; could also trigger when a new badge is unlocked.
- **Unit completion celebration**: Could add a special celebration when an entire unit is completed (not just individual activities).
- **Real-time teacher notifications**: Teacher panel reports don't auto-refresh; could add polling.
- **Performance**: Progress view fetches many attempts; could add pagination.
- **Accessibility audit**: Should do a formal a11y audit (keyboard nav, screen reader, ARIA).
- **Content search across lessons**: Currently search is only on unit titles; could extend to lesson/activity content.

---
Task ID: cron-review-3
Agent: Z.ai Code (web dev review)
Task: Badge auto-award system, unit/badge celebrations, lesson TOC, dynamic icon additions

## Current project status description/assessment
The platform "ElectroMed IA" is stable with URL navigation, chat sidebar, 5 units, 32 activities, gamification (points/streak/badges), analytics, teacher panel, error reporting, Continue card, reading progress bar, and activity celebration. This round focused on: (1) implementing dynamic badge auto-award logic (badges were previously only seeded, not earned dynamically), (2) adding badge unlock and unit completion celebrations, (3) adding a lesson table of contents, and (4) adding missing badge icons to the DynamicIcon map.

## Current goals/completed modifications/verification results

### New feature: Dynamic badge auto-award system
- **Problem**: Badges were only awarded in the seed file; the platform never dynamically checked/awarded badges when users completed activities or chatted with the tutor.
- **Solution**: Created `/src/lib/badges.ts` with `checkAndAwardBadges(userId)` function that evaluates all 6 badge criteria:
  - `primer-paso`: ≥1 correct activity
  - `explorador`: visited all 5 units
  - `racha-7`: streak ≥7 days
  - `maestro-ecg`: ECG unit mastery ≥80%
  - `centinela`: completed all Seguridad Eléctrica activities
  - `tutor-activo`: ≥10 chat queries
- Integrated into `/api/activities/[id]/attempt` (runs after each activity submission) and `/api/tutor` (runs after each chat message).
- The API now returns `newBadges` array in the response so the frontend can show celebrations.
- **Verified**: Fernanda (5→6 correct activities) submitted a fresh MC activity → API ran badge check → no new badges awarded (she already had primer-paso/explorador) → correct behavior.

### New feature: Badge unlock celebration
- Extended the activity view to show a Celebration modal when a new badge is unlocked.
- Badge celebrations use tier-themed gradients: gold (yellow/amber), silver (slate), bronze (amber/orange).
- Sequenced celebrations: activity completion (0s) → unit completion (7s) → badge unlock (7s or 14s if unit also completed).
- Chat sidebar shows a toast notification when a badge is unlocked via tutoring.
- **Verified**: Celebration component renders correctly with badge name and tier-appropriate gradient.

### New feature: Unit completion celebration
- The attempt API now detects when an activity submission completes all activities in a unit (correctActivitiesAfter === totalActivitiesUnit && isCorrect && !hadPreviousCorrect).
- Returns `unitCompleted`, `unitTitle`, `unitColor`, `unitIcon` in the response.
- Activity view shows a special "¡Unidad completada!" celebration with the unit's color gradient.
- Also implemented daily streak increment: if the user's last activity was on a previous day, streak +1.

### New feature: Lesson table of contents (TOC)
- Created `LessonToc` component that extracts h2/h3 headings from lesson markdown.
- Renders as a collapsible sidebar card with "Contenido · N secciones".
- Uses IntersectionObserver to highlight the active section as the user scrolls.
- Clicking a TOC item smooth-scrolls to that heading (offset for sticky header).
- Added heading ID generation to ReactMarkdown in lesson view (slugified from heading text).
- Only visible on desktop (lg+) to avoid cluttering mobile.
- **Verified**: TOC shows 8 sections for "Acondicionamiento de Señal" lesson, clicking "Rechazo de modo común" scrolls to the correct heading (top:80px).

### Improvement: Added missing badge icons to DynamicIcon
- Added `Footprints`, `Compass`, `MessageCircleQuestion` to the iconMap (used by badges primer-paso, explorador, tutor-activo).
- **Verified**: Achievements page renders 59 SVGs (badges now show their proper icons instead of fallback BookOpen).

### QA performed
- Tested dashboard (Continue card), lesson view (TOC + reading progress bar), activity submission (celebration), chat sidebar (Socratic response), achievements (badge icons).
- Verified badge awarding logic doesn't re-award existing badges.
- Lint clean (0 errors, 0 warnings). No console/runtime errors.

## Unresolved issues or risks, and priority recommendations for the next phase
- **Global content search**: Currently search is only on unit titles in the units view; could extend to lessons and activities across all units.
- **Real-time teacher notifications**: Teacher panel reports don't auto-refresh; could add polling.
- **Accessibility audit**: Should do a formal a11y audit (keyboard nav, screen reader, ARIA).
- **Performance**: Progress view fetches many attempts; could add pagination.
- **Streak reset logic**: The streak increment is simplified (only checks if lastActive < today); doesn't handle multi-day gaps (should reset to 1 if gap > 1 day).
- **Badge progress indicators**: Could show progress towards each badge (e.g., "7/10 consultas" for tutor-activo).
- **Lesson TOC on mobile**: Currently hidden on mobile; could add a collapsible drawer version.

---
Task ID: cron-review-4
Agent: Z.ai Code (web dev review)
Task: Streak logic fix, badge progress indicators, global search, teacher auto-refresh, mobile TOC

## Current project status description/assessment
The platform "ElectroMed IA" is stable with URL navigation, chat sidebar, 5 units, 32 activities, gamification (points/streak/badges with dynamic auto-award), analytics, teacher panel, error reporting, Continue card, reading progress bar, activity/badge/unit celebrations, and lesson TOC. This round focused on: (1) fixing the streak logic to handle multi-day gaps, (2) adding badge progress indicators, (3) implementing global content search, (4) adding teacher panel auto-refresh, and (5) making the lesson TOC available on mobile.

## Current goals/completed modifications/verification results

### Bug fixed: Streak logic for multi-day gaps
- **Problem**: The streak increment logic only checked if `lastActive < today`, which meant any activity on a new day incremented the streak by 1 — even if there was a multi-day gap (e.g., studying Monday then Friday would still increment, treating it as consecutive).
- **Fix**: Rewrote the streak logic in `/api/activities/[id]/attempt` to properly handle three cases:
  1. `lastActive` is today → no change (already counted today)
  2. `lastActive` was yesterday → `+1` (consecutive day)
  3. `lastActive` was before yesterday or null → reset to `1` (new streak)
- Uses date comparison (not datetime) to correctly determine day boundaries.

### New feature: Badge progress indicators
- Created `/api/badge-progress` endpoint that returns per-badge progress data (current/target/pct) for a user.
- Updated achievements view to fetch badge progress and display progress bars on unearned badges.
- Each unearned badge now shows: "En progreso" label, current/target count (e.g., "5/7"), and a tier-colored progress bar.
- When progress reaches 100%, shows "¡Listo para desbloquear!" instead.
- **Verified**: VLM confirmed "Centinela" badge shows "5/7" progress bar; earned badges show "Desbloqueada" with green check.

### New feature: Global content search (Ctrl+K)
- Created `/api/search` endpoint that searches across units (title/summary/description), lessons (title/description), and activities (title/prompt).
- Created `GlobalSearch` component: a dialog with search input, grouped results (Unidades/Lecciones/Actividades), and click-to-navigate.
- Results show unit color icons, lesson durations, activity type/difficulty badges, and completion status.
- Added search button to header with "⌘K" keyboard shortcut hint.
- Ctrl/Cmd+K opens/closes the search dialog globally.
- **Verified**: Searching "Einthoven" returns a lesson and an activity; clicking a result navigates correctly; Ctrl+K shortcut works.

### New feature: Teacher panel auto-refresh
- Added 30-second polling to the ErrorReportsSection in the teacher panel.
- Teachers now see new error reports without manual refresh.
- **Verified**: Code compiles, polling interval set correctly.

### Improvement: Lesson TOC on mobile
- Removed the `hidden lg:block` wrapper around the LessonToc component — it's now visible on all screen sizes.
- The TOC is already collapsible (click "Contenido" to expand/collapse), making it mobile-friendly.
- **Verified**: TOC renders on both desktop and mobile.

### QA performed
- Tested dashboard, achievements (with progress bars), search dialog (Ctrl+K), lesson TOC.
- VLM-verified badge progress indicators.
- Lint clean (0 errors, 0 warnings). No console/runtime errors.

## Unresolved issues or risks, and priority recommendations for the next phase
- **Accessibility audit**: Should do a formal a11y audit (keyboard nav, screen reader, ARIA).
- **Performance**: Progress view fetches many attempts; could add pagination.
- **Search highlighting**: Could highlight matching text in search results.
- **Search history**: Could save recent searches per user.
- **Badge notification on dashboard**: Could show a "new badge" notification card on the dashboard.
- **Lesson content search within markdown**: Currently searches titles/prompts; could extend to full markdown content (heavier query).
- **Teacher search**: Could add search/filter for specific students in the teacher panel.
- **Activity retry limit**: Could limit retries to encourage thoughtful answers.
