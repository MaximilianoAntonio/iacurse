// Tipos compartidos de la plataforma de aprendizaje adaptativo

export type Role = "student" | "teacher";

export type ViewKey =
  | "dashboard"
  | "units"
  | "unit-detail"
  | "lesson"
  | "activity"
  | "progress"
  | "achievements"
  | "bookmarks"
  | "teacher"
  | "course-builder"
  | "course-diagnostic"
  | "final-exam"
  | "about";

export type ActivityType =
  | "multiple_choice"
  | "guided_problem"
  | "case_analysis"
  | "progressive_exercise"
  | "self_assessment"
  | "short_answer"
  | "scale_rating";

export type Difficulty = "easy" | "medium" | "hard";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar: string | null;
  points: number;
  streak: number;
  weeklyGoalMin: number;
  lastActive: string | null;
  /** Código anonimizado (solo estudiantes; null en docentes). */
  studentCode?: string | null;
  /** true obliga a cambiar la contraseña antes de usar la app. */
  mustChangePassword: boolean;
}

export interface Unit {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  lessonCount?: number;
  activityCount?: number;
  /** true cuando el estudiante ya tiene una PersonalizedUnit (diagnóstico
   *  respondido o saltado) para esta unidad. */
  hasAdaptedContent?: boolean;
  /** true cuando el estudiante saltó la personalización (continúa sin contenido adaptado). */
  diagnosticSkipped?: boolean;
  /** true cuando la unidad está bloqueada por el desbloqueo secuencial
   *  (requiere completar la unidad anterior; los docentes nunca la ven en true). */
  locked?: boolean;
  lessons?: {
    id: string;
    slug: string;
    title: string;
    durationMin?: number;
    order?: number;
  }[];
  progress?: {
    completed: number;
    total: number;
    mastery: number;
    lastVisited: string | null;
  } | null;
}

/** Estado del diagnóstico general y de la prueba de cierre (GET /api/course/status). */
export interface CourseStatus {
  diagnosticCompleted: boolean;
  /** True si el docente configuró preguntas de diagnóstico. */
  diagnosticConfigured: boolean;
  /** Preguntas del diagnóstico general (solo presente si está pendiente). */
  diagnosticQuestions?: string[];
  allUnitsCompleted: boolean;
  finalExam: {
    configured: boolean;
    passed: boolean;
    bestScore: number | null;
    attemptsUsed: number;
    maxAttempts: number;
    passScore: number;
  };
  /** Consentimiento informado electrónico (solo estudiantes). */
  consent?: ConsentStatus;
}

/** Estado del consentimiento informado del estudiante (uso científico de datos). */
export interface ConsentStatus {
  completed: boolean;
  /** True si autorizó y no ha retirado la autorización. */
  authorized: boolean;
  decision: "authorized" | "rejected" | null;
  revokedAt: string | null;
  /** Fecha ISO límite para retirar la autorización. */
  revokeDeadline: string;
  /** Versión del documento de consentimiento registrada como evidencia. */
  version: string;
}

/** Pregunta de la prueba de cierre (sin la respuesta correcta). */
export interface FinalExamQuestion {
  question: string;
  options: string[];
}

/** Resultado de un intento de la prueba de cierre (POST /api/course/final-exam). */
export interface FinalExamResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  attemptsUsed: number;
  maxAttempts: number;
}

/** Reporte de error (panel docente de /api/report). */
export interface ErrorReportItem {
  id: string;
  source: "activity" | "content" | "platform";
  sourceId: string;
  reason: string;
  comment: string;
  status: "open" | "reviewed" | "resolved";
  /** Código anonimizado cuando el reportante es estudiante (null si es docente). */
  reporterCode: string | null;
  /** Nombre del docente reportante (null si es estudiante anonimizado). */
  reporterName: string | null;
  createdAt: string;
}

/** Nivel de andamiaje CAAMI (ayuda progresiva A1–A5). */
export type ScaffoldLevel = "A1" | "A2" | "A3" | "A4" | "A5";

/**
 * Intervención de ayuda progresiva (andamiaje CAAMI). Llega en la respuesta de
 * POST /api/activities/<id>/help (campo `help`) o dentro del resultado del
 * intento (campo `scaffold` de POST /api/activities/<id>/attempt).
 * `errorType` y `source` son metadatos internos: no se muestran al estudiante.
 */
export interface ScaffoldHelp {
  level: ScaffoldLevel;
  supportType: string;
  /** Texto de la intervención (en A5, la explicación completa). */
  message: string;
  /** Pasos de la secuencia guiada (solo A4). */
  steps?: { step: number; prompt: string }[] | null;
  keyConcepts?: string[] | null;
  errorType?: string;
  source?: "ai" | "fallback";
  verificationRequired?: boolean;
}

export interface Activity {
  id: string;
  lessonId: string;
  type: ActivityType;
  title: string;
  prompt: string;
  /** Datos del tipo de actividad: objeto JSON (Django) o string serializado (legacy). */
  data: unknown;
  points: number;
  difficulty: Difficulty;
  order: number;
  /** Intentos máximos permitidos (0 = ilimitado). */
  maxAttempts?: number;
  /** Umbral de aprobación en % (0 = sin umbral explícito). */
  masteryThreshold?: number;
  /** Tipo de evaluación pedagógica (diagnostic, formative, ...). */
  assessmentType?: string;
  /** Nivel cognitivo de Bloom (remember, understand, ...). */
  bloomLevel?: string;
}

// Estructuras de los datos JSON de actividades
export interface MultipleChoiceData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hints: string[];
}

export interface GuidedProblemData {
  scenario: string;
  steps: { prompt: string; answer: string; hint: string }[];
  finalAnswer: string;
  explanation: string;
}

export interface CaseAnalysisData {
  case: string;
  questions: { prompt: string; answer: string; explanation: string }[];
}

export interface ProgressiveExerciseData {
  levels: { prompt: string; answer: string; explanation: string }[];
}

export interface SelfAssessmentData {
  prompt: string;
  rubric: string[];
  autoGradeKeywords: string[];
}

export interface ShortAnswerData {
  question: string;
  /** Límite de palabras de la respuesta (default 30). */
  maxWords?: number;
  /** Palabras clave para corrección automática (vacío = participación). */
  keywords?: string[];
  /** Respuesta modelo (pauta; solo visible post-envío). */
  modelAnswer?: string;
  explanation?: string;
}

export interface ScaleRatingData {
  question: string;
  /** Extremos de la escala (defaults 1 y 5). */
  min?: number;
  max?: number;
  /** Etiquetas de los extremos de la escala. */
  minLabel?: string;
  maxLabel?: string;
  /** Valor correcto (null = pregunta de opinión, todo valor en rango es correcto). */
  correctValue?: number | null;
  explanation?: string;
}
