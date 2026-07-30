// Tipos compartidos de la plataforma de aprendizaje adaptativo

export type Role = "student" | "teacher";

export type ViewKey =
  | "dashboard"
  | "units"
  | "unit-detail"
  | "lesson"
  | "activity"
  | "tutor"
  | "progress"
  | "achievements"
  | "teacher"
  | "course-builder"
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
  /** true cuando el estudiante saltó el diagnóstico (ve el contenido base). */
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

/** Respuesta de una pregunta de diagnóstico (par pregunta/respuesta). */
export interface DiagnosticAnswer {
  question: string;
  answer: string;
}

/** Reporte de error (panel docente de /api/report). */
export interface ErrorReportItem {
  id: string;
  source: "chat" | "activity" | "content";
  sourceId: string;
  reason: string;
  comment: string;
  status: "open" | "reviewed" | "resolved";
  reporterName: string;
  reporterEmail: string;
  createdAt: string;
}

export interface Lesson {
  id: string;
  unitId: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  durationMin: number;
  order: number;
  unit?: Pick<Unit, "title" | "color" | "icon" | "slug">;
  activities?: Activity[];
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

export interface Attempt {
  id: string;
  userId: string;
  activityId: string;
  answer: string;
  feedback: string | null;
  score: number | null;
  correct: boolean | null;
  timeSpent: number | null;
  createdAt: string;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold";
  awardedAt?: string;
}

export interface ProgressRecord {
  id: string;
  userId: string;
  unitId: string;
  completed: number;
  total: number;
  mastery: number;
  lastVisited: string | null;
  updatedAt: string;
}
