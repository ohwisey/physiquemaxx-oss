import type { ViewAngle } from "@/lib/types";

/**
 * Canonical analysis shapes — the single source of truth shared by the
 * AI pipeline (Zod schemas mirror these), the deterministic scoring engine,
 * persistence, and the detail UI. See docs/AI_SCORING_SPEC.md.
 */

export const MUSCLE_GROUPS = [
  "lateral_delts",
  "rear_delts",
  "upper_chest",
  "chest",
  "lats",
  "upper_back",
  "traps",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "glutes",
  "quads",
  "hamstrings",
  "calves",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  lateral_delts: "SIDE DELTS",
  rear_delts: "REAR DELTS",
  upper_chest: "UPPER CHEST",
  chest: "CHEST",
  lats: "LATS",
  upper_back: "UPPER BACK",
  traps: "TRAPS",
  biceps: "BICEPS",
  triceps: "TRICEPS",
  forearms: "FOREARMS",
  abs: "ABS",
  glutes: "GLUTES",
  quads: "QUADS",
  hamstrings: "HAMSTRINGS",
  calves: "CALVES",
};

/** Stable anchors — never fake precision. */
export type Anchor = "A0" | "A1" | "A2" | "A3" | "A4";
export const ANCHOR_SCORE: Record<Anchor, 0 | 25 | 50 | 75 | 100> = {
  A0: 0,
  A1: 25,
  A2: 50,
  A3: 75,
  A4: 100,
};

export type MuscleStatus = "red" | "green" | "not_assessable";

export interface EvidenceItem {
  view: ViewAngle;
  observation: string;
}

export interface MuscleAssessment {
  muscle: MuscleGroup;
  anchor: Anchor | null;
  score: 0 | 25 | 50 | 75 | 100 | null;
  status: MuscleStatus;
  /** 0..1; below the rubric threshold → not_assessable */
  confidence: number;
  evidence: EvidenceItem[];
}

export interface PrescribedExercise {
  /** ID from the versioned exercise library — never invented */
  id: string;
  name: string;
  sets: number;
  repRange: string;
  frequencyPerWeek: number;
  restSeconds: number;
}

export interface PriorityBlock {
  muscle: MuscleGroup;
  why: string;
  exercises: PrescribedExercise[];
  /** target total weekly hard sets (labelled as target when history unknown) */
  weeklyHardSets: number;
  weeklyExposures: number;
  /** reps in reserve, e.g. "1–2" */
  rir: string;
  progressionRule: string;
  reassessAt: string;
}

export interface ViewQuality {
  view: ViewAngle;
  score: number; // 0..100
  issues: string[];
}

export interface QualityGate {
  verdict: "pass" | "partial" | "fail";
  perView: ViewQuality[];
  retakeGuidance: string[];
}

export interface Subscores {
  development: number;
  /** null when the capture carried no proportion evidence. */
  proportion: number | null;
  /** null when no view could show left/right balance. */
  symmetry: number | null;
  conditioning: number;
}

/** Visual estimate only — always a range, never a single "exact" number. */
export interface BodyFatEstimate {
  lowPct: number;
  highPct: number;
  confidence: "high" | "medium" | "low";
}

/**
 * Condition guidance built from weight trend (current vs past logs), height,
 * gender, age, and the visual body-fat estimate. Simple, direct, constructive.
 */
export interface ConditionGuidance {
  /** e.g. "12–15% — hold here; cutting further costs you size." */
  bodyFat: string;
  /** e.g. "2×20min incline walks weekly. You don't need more." */
  cardio: string;
  /** e.g. "72kg → aim 74kg by October at +0.25kg/week." */
  target: string;
  /** e.g. "+1.2kg since 20 JUL at steady leanness — keep the surplus." */
  weightTrend: string | null;
}

export interface AnalysisVersions {
  model: string;
  prompt: string;
  rubric: string;
  scoring: string;
  targetProfile: string;
  exerciseLibrary: string;
  schema: string;
}

export interface AnalysisResult {
  status: "complete" | "limited" | "failed";
  qualityGate: QualityGate;
  /** null only on a failed gate — a partial capture still scores. */
  overall: number | null;
  subscores: Subscores | null;
  confidence: "high" | "medium" | "low";
  strongest: { muscle: MuscleGroup; statement: string } | null;
  /** at most two */
  bottlenecks: { muscle: MuscleGroup; statement: string }[];
  /** ≤35 words, verdict-first, evidence-backed */
  verdict: string;
  muscles: MuscleAssessment[];
  /** at most two six-week specialization priorities */
  priorities: PriorityBlock[];
  /** visual estimate range from photos (never affects the muscle score) */
  estBodyFat: BodyFatEstimate | null;
  /** cardio / body-fat / weight-target guidance from profile + weight logs */
  condition: ConditionGuidance | null;
  /** presentation only — never affects the physique score */
  presentationNotes: string[];
  versions: AnalysisVersions;
}
