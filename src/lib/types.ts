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
  | "final-exam"
  | "about";

export type ActivityType =
  | "multiple_choice"
  | "guided_problem"
  | "case_analysis"
  | "progressive_exercise"
  | "self_assessment";

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
