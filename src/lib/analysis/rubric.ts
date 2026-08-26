import type { ViewAngle } from "@/lib/types";
import type { Anchor, MuscleGroup } from "@/lib/analysis/types";

/**
 * RUBRIC v1 — every deterministic constant Stage 2 scores against.
 * See docs/AI_SCORING_SPEC.md §2–§7. Values here may change only with a
 * version bump; scores from incompatible MAJOR rubric versions are never
 * silently compared.
 */

export const RUBRIC_VERSION = "1.1.0";
export const SCORING_VERSION = "1.1.0";
export const TARGET_PROFILE_VERSION = "1.0.0";

/** Stage-1 confidence below this ⇒ NOT ASSESSABLE (spec §5). */
export const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Photo quality tiers (v1.1 — photos are additive context, never a wall):
 * ≥ VIEW_MIN_SCORE   → "valid": counts toward the full overall score.
 * ≥ VIEW_USABLE_SCORE → "usable": muscles visible in it get honest ratings.
 * below / hard-failed → excluded, with exact retake guidance.
 * The overall score still requires all four views valid (spec §2) — fewer or
 * rougher photos give a LIMITED VIEW assessment, not a refusal.
 */
export const VIEW_MIN_SCORE = 70;
export const VIEW_USABLE_SCORE = 40;
export const SESSION_MEAN_MIN = 80;

/**
 * Issue slugs that make a view's EVIDENCE untrustworthy — only these
 * invalidate a view outright. Everything else is a standardization note.
 */
export const HARD_FAILURE_ISSUES = ["severe_blur", "filtered_or_edited"] as const;
export type HardFailureIssue = (typeof HARD_FAILURE_ISSUES)[number];

/**
 * Standardization notes — recognized slugs that reduce a view's quality score
 * and per-muscle confidence but never erase visible evidence. A sharp,
 * well-lit mirror selfie is still an assessable photograph.
 */
export const STANDARDIZATION_ISSUES = [
  "mirror_selfie",
  "portrait_blur",
  "pose_inconsistency",
  "different_session",
  "lens_distortion",
  "cropped_body",
] as const;
export type StandardizationIssue = (typeof STANDARDIZATION_ISSUES)[number];

/** "side" is satisfied by either left or right (spec §4). */
export type ViewRequirement = ViewAngle | "side";

interface ViewMatrixRow {
  required: ViewRequirement[];
  supporting: ViewRequirement[];
}

/** Required-view matrix — spec §4, verbatim. */
export const VIEW_MATRIX: Record<MuscleGroup, ViewMatrixRow> = {
  lateral_delts: { required: ["front"], supporting: ["back", "side"] },
  rear_delts: { required: ["back"], supporting: ["side"] },
  upper_chest: { required: ["front"], supporting: ["side"] },
  chest: { required: ["front"], supporting: ["side"] },
  lats: { required: ["back"], supporting: ["front"] },
  upper_back: { required: ["back"], supporting: [] },
  traps: { required: ["back"], supporting: ["front", "side"] },
  biceps: { required: ["front"], supporting: ["side"] },
  triceps: { required: ["side"], supporting: ["back"] },
  forearms: { required: ["front"], supporting: ["side"] },
  abs: { required: ["front"], supporting: ["side"] },
  glutes: { required: ["back"], supporting: ["side"] },
  quads: { required: ["front"], supporting: ["side"] },
  hamstrings: { required: ["back"], supporting: ["side"] },
  calves: { required: ["back"], supporting: ["side"] },
};

/** Importance to the balanced athletic / V-taper goal — spec §7, v1 table. */
export const IMPORTANCE: Record<MuscleGroup, number> = {
  lateral_delts: 1.0,
  lats: 1.0,
  upper_chest: 0.9,
  chest: 0.85,
  upper_back: 0.85,
  quads: 0.8,
  glutes: 0.75,
  hamstrings: 0.75,
  rear_delts: 0.7,
  traps: 0.65,
  triceps: 0.65,
  biceps: 0.6,
  calves: 0.55,
  abs: 0.5,
  forearms: 0.4,
};

/** priorityScore = 0.40·gap + 0.30·importance + 0.20·confidence + 0.10·crossAngle */
export const PRIORITY_WEIGHTS = {
  gap: 0.4,
  importance: 0.3,
  confidence: 0.2,
  crossAngle: 0.1,
} as const;

/** At most two specialization priorities per six-week block. */
export const MAX_PRIORITIES = 2;

/** Overall composite weights — spec §6, verbatim from the master prompt. */
export const OVERALL_WEIGHTS = {
  development: 0.5,
  proportion: 0.25,
  symmetry: 0.15,
  conditioning: 0.1,
} as const;

/**
 * Proportion target profile v1 — the anchor relationships the balanced
 * athletic / V-taper goal is judged against. Stage 1 reports one fit per
 * target it can see; Stage 2 maps fits to a 0–100 subscore.
 */
export const PROPORTION_TARGETS = [
  { id: "shoulder_to_waist", label: "Shoulder width vs waist (V-taper)" },
  { id: "back_to_chest", label: "Back thickness vs chest balance" },
  { id: "arms_to_shoulders", label: "Arm size vs shoulder width" },
  { id: "upper_to_lower", label: "Upper body vs lower body balance" },
  { id: "quads_to_hamstrings", label: "Quad vs hamstring balance" },
] as const;
export type ProportionTargetId = (typeof PROPORTION_TARGETS)[number]["id"];

export type ProportionFit =
  | "on_target"
  | "slight_miss"
  | "clear_miss"
  | "major_miss";
export const PROPORTION_FIT_SCORE: Record<ProportionFit, number> = {
  on_target: 100,
  slight_miss: 75,
  clear_miss: 40,
  major_miss: 0,
};

/** Symmetry: 100 minus summed penalties, floored at 0 (spec §6). */
export type AsymmetrySeverity = "slight" | "clear" | "major";
export const ASYMMETRY_PENALTY: Record<AsymmetrySeverity, number> = {
  slight: 8,
  clear: 18,
  major: 32,
};

/**
 * Conditioning rewards closeness to the balanced athletic target — never
 * "leaner is always better". Deviation direction is irrelevant to the score.
 */
export type ConditioningBand =
  | "on_target"
  | "slightly_off"
  | "clearly_off"
  | "far_off";
export const CONDITIONING_FIT_SCORE: Record<ConditioningBand, number> = {
  on_target: 100,
  slightly_off: 75,
  clearly_off: 45,
  far_off: 15,
};

/** Numeric gap used for priority ranking: A0=1, A1=2/3, A2=1/3. */
export function gapNorm(anchorValue: number): number {
  return (75 - anchorValue) / 75;
}

/** Anchor labels considered lagging (RED when confident). */
export const RED_ANCHORS: readonly Anchor[] = ["A0", "A1", "A2"];

/** Anchor vocabulary — the only rating language the product speaks (spec §3). */
export const ANCHOR_MEANING: Record<Anchor, string> = {
  A0: "major visible development gap",
  A1: "clear lag materially harming the target proportions",
  A2: "slight but actionable lag",
  A3: "target met; maintain",
  A4: "standout development",
};
