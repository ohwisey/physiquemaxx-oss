import type { ViewAngle } from "@/lib/types";
import {
  ANCHOR_SCORE,
  MUSCLE_GROUPS,
  MUSCLE_LABEL,
  type Anchor,
  type EvidenceItem,
  type MuscleAssessment,
  type MuscleGroup,
  type PrescribedExercise,
  type PriorityBlock,
  type QualityGate,
  type Subscores,
  type ViewQuality,
} from "@/lib/analysis/types";
import {
  ANCHOR_MEANING,
  ASYMMETRY_PENALTY,
  CONDITIONING_FIT_SCORE,
  CONFIDENCE_THRESHOLD,
  HARD_FAILURE_ISSUES,
  IMPORTANCE,
  MAX_PRIORITIES,
  OVERALL_WEIGHTS,
  PRIORITY_WEIGHTS,
  PROPORTION_FIT_SCORE,
  RED_ANCHORS,
  SESSION_MEAN_MIN,
  VIEW_MATRIX,
  VIEW_MIN_SCORE,
  VIEW_USABLE_SCORE,
  gapNorm,
  type AsymmetrySeverity,
  type ConditioningBand,
  type ProportionFit,
  type ProportionTargetId,
  type ViewRequirement,
} from "@/lib/analysis/rubric";
import { EXERCISE_LIBRARY } from "@/lib/analysis/exercise-library";

/**
 * STAGE 2 — deterministic scoring. Pure functions, zero model calls.
 * Same input ⇒ same output; versioned as SCORING_VERSION in rubric.ts.
 * Never alters, rounds up, or re-interprets Stage 1 anchors or confidence.
 */

const ALL_VIEWS: readonly ViewAngle[] = ["front", "left", "back", "right"];

// ---------------------------------------------------------------- quality gate

const ISSUE_TEXT: Record<string, string> = {
  severe_blur: "severe blur",
  cropped_body: "body cropped out of frame",
  lens_distortion: "lens distortion",
  pose_inconsistency: "pose inconsistent with the other views",
  filtered_or_edited: "filtered or edited image",
  mirror_selfie: "mirror selfie",
  portrait_blur: "portrait-mode blur",
  different_session: "shot in a different session",
};

const ISSUE_FIX: Record<string, string> = {
  severe_blur: "reshoot with the phone braced and the lens wiped",
  cropped_body: "step back until the full body is in frame",
  lens_distortion: "reshoot at chest height from the same distance as FRONT",
  pose_inconsistency: "repeat the same relaxed standardized pose as the other views",
  filtered_or_edited: "reshoot with no filter or edits",
  mirror_selfie: "point the camera directly at the body — no mirror",
  portrait_blur: "turn portrait mode off and reshoot",
  different_session: "reshoot every view in one session, same room and lighting",
};

function hardFailuresOf(q: ViewQuality): string[] {
  return q.issues.filter((i) =>
    (HARD_FAILURE_ISSUES as readonly string[]).includes(i),
  );
}

/** A view is valid when its score clears the floor and no hard failure applies. */
export function isViewValid(q: ViewQuality): boolean {
  return q.score >= VIEW_MIN_SCORE && hardFailuresOf(q).length === 0;
}

/**
 * A view is usable when its evidence can be trusted at all — muscles visible
 * in it get honest ratings even if the shot isn't full-score standard.
 */
export function isViewUsable(q: ViewQuality): boolean {
  return q.score >= VIEW_USABLE_SCORE && hardFailuresOf(q).length === 0;
}

/** Views whose evidence may be assessed — feeds the required-view matrix. */
export function usableViews(gate: QualityGate): ViewAngle[] {
  return gate.perView.filter(isViewUsable).map((q) => q.view);
}

/** Full-score-grade views (kept for pass verdict + spec compatibility). */
export function validViews(gate: QualityGate): ViewAngle[] {
  return gate.perView.filter(isViewValid).map((q) => q.view);
}

/** What capturing a given view unlocks — used for additive guidance. */
const VIEW_UNLOCKS: Record<ViewAngle, string> = {
  front: "side delts, chest, upper chest, abs, biceps, forearms and quads",
  back: "lats, upper back, traps, rear delts, glutes, hamstrings and calves",
  left: "triceps and left-side depth",
  right: "triceps and right-side depth",
};

/**
 * Session verdict (rubric v1.1) — photos are additive context, never a wall:
 *   pass    → all four views valid and session mean ≥ threshold (full score).
 *   partial → at least one usable view: assess everything visible, no overall.
 *   fail    → nothing usable at all — retake guidance only.
 */
export function applyQualityGate(perView: ViewQuality[]): QualityGate {
  const byView = new Map<ViewAngle, ViewQuality>();
  for (const q of perView) if (!byView.has(q.view)) byView.set(q.view, q);

  const valid = new Set<ViewAngle>();
  const usable = new Set<ViewAngle>();
  for (const [view, q] of byView) {
    if (isViewValid(q)) valid.add(view);
    if (isViewUsable(q)) usable.add(view);
  }

  const allFourValid = ALL_VIEWS.every((v) => valid.has(v));
  const sessionMean = allFourValid
    ? ALL_VIEWS.reduce((sum, v) => sum + (byView.get(v)?.score ?? 0), 0) / 4
    : 0;

  let verdict: QualityGate["verdict"];
  if (allFourValid && sessionMean >= SESSION_MEAN_MIN) {
    verdict = "pass";
  } else if (usable.size > 0) {
    verdict = "partial";
  } else {
    verdict = "fail";
  }

  const retakeGuidance: string[] = [];
  for (const view of ALL_VIEWS) {
    const label = view.toUpperCase();
    const q = byView.get(view);
    if (!q) {
      retakeGuidance.push(
        `Add ${label} — unlocks ${VIEW_UNLOCKS[view]}. Same camera height, distance and lighting as your other shots.`,
      );
      continue;
    }
    const hard = hardFailuresOf(q);
    if (hard.length > 0) {
      const named = hard.map((h) => ISSUE_TEXT[h] ?? h).join(", ");
      retakeGuidance.push(
        `${label} unusable: ${named} — ${ISSUE_FIX[hard[0]] ?? "reshoot this view"}.`,
      );
    } else if (q.score < VIEW_USABLE_SCORE) {
      const detail = q.issues.length > 0 ? ` (${q.issues.join(", ")})` : "";
      retakeGuidance.push(
        `${label} too rough to assess (quality ${Math.round(q.score)})${detail} — reshoot it to unlock ${VIEW_UNLOCKS[view]}.`,
      );
    } else if (q.score < VIEW_MIN_SCORE) {
      const detail = q.issues.length > 0 ? ` (${q.issues.join(", ")})` : "";
      retakeGuidance.push(
        `${label} was assessed, but at quality ${Math.round(q.score)}${detail} it doesn't count toward the overall score — reshoot it standardized to unlock the full rating.`,
      );
    }
  }
  if (verdict !== "pass" && allFourValid && sessionMean < SESSION_MEAN_MIN) {
    const weakest = [...ALL_VIEWS]
      .sort((a, b) => (byView.get(a)?.score ?? 0) - (byView.get(b)?.score ?? 0))
      .slice(0, 2)
      .map((v) => v.toUpperCase())
      .join(" and ");
    retakeGuidance.push(
      `Session quality mean ${Math.round(sessionMean)} is below ${SESSION_MEAN_MIN} — reshoot the weakest views (${weakest}) in the same conditions to unlock the overall score.`,
    );
  }

  return { verdict, perView, retakeGuidance };
}

// ------------------------------------------------------------ status resolution

/** Stage 1 output per muscle, before any status exists. anchor null = NOT_VISIBLE. */
export interface RawAssessment {
  muscle: MuscleGroup;
  anchor: Anchor | null;
  /** 0..1 straight from Stage 1 — never adjusted here */
  confidence: number;
  evidence: EvidenceItem[];
}

function requirementMet(req: ViewRequirement, avail: Set<ViewAngle>): boolean {
  if (req === "side") return avail.has("left") || avail.has("right");
  return avail.has(req);
}

/**
 * RED / GREEN / NOT ASSESSABLE per spec §5. Returns all 15 groups in canonical
 * order; anything unassessable is published with a null anchor and score so no
 * unsupported rating leaks to the UI (raw Stage 1 output persists separately).
 */
export function resolveStatuses(
  raw: RawAssessment[],
  gateVerdict: QualityGate["verdict"],
  availableViews: ViewAngle[],
): MuscleAssessment[] {
  const avail = new Set(availableViews);
  const byMuscle = new Map<MuscleGroup, RawAssessment>();
  for (const r of raw) if (!byMuscle.has(r.muscle)) byMuscle.set(r.muscle, r);

  return MUSCLE_GROUPS.map((muscle) => {
    const r = byMuscle.get(muscle);
    const confidence = r?.confidence ?? 0;
    const evidence = r?.evidence ?? [];
    const anchor = r?.anchor ?? null;

    if (
      gateVerdict === "fail" ||
      anchor === null ||
      confidence < CONFIDENCE_THRESHOLD ||
      !VIEW_MATRIX[muscle].required.every((req) => requirementMet(req, avail))
    ) {
      return {
        muscle,
        anchor: null,
        score: null,
        status: "not_assessable" as const,
        confidence,
        evidence,
      };
    }
    return {
      muscle,
      anchor,
      score: ANCHOR_SCORE[anchor],
      status: RED_ANCHORS.includes(anchor) ? ("red" as const) : ("green" as const),
      confidence,
      evidence,
    };
  });
}

// --------------------------------------------------------------- overall score

export interface ProportionFinding {
  target: ProportionTargetId;
  fit: ProportionFit;
}

export interface AsymmetryFinding {
  muscle: MuscleGroup;
  severity: AsymmetrySeverity;
}

/** Stage 1's structured proportion/symmetry/conditioning evidence, mapped to rubric enums. */
export interface OverallInputs {
  proportions: ProportionFinding[];
  asymmetries: AsymmetryFinding[];
  conditioning: ConditioningBand;
}

/**
 * 50% development + 25% proportion + 15% symmetry + 10% conditioning fit.
 * Published ONLY on a pass gate — partial and fail never get an overall score.
 * Photo quality, lighting, grooming, posing, pump, tanning: zero weight.
 */
export function computeOverall(
  assessments: MuscleAssessment[],
  inputs: OverallInputs,
  gateVerdict: QualityGate["verdict"],
): { overall: number | null; subscores: Subscores | null } {
  if (gateVerdict !== "pass") return { overall: null, subscores: null };

  const scored = assessments.filter((a) => a.score !== null);
  // A pass capture with no assessable group or no proportion evidence is
  // pathological Stage 1 output — refuse to fabricate a composite.
  if (scored.length === 0 || inputs.proportions.length === 0) {
    return { overall: null, subscores: null };
  }

  const development =
    scored.reduce((sum, a) => sum + (a.score as number), 0) / scored.length;
  const proportion =
    inputs.proportions.reduce((sum, p) => sum + PROPORTION_FIT_SCORE[p.fit], 0) /
    inputs.proportions.length;
  const symmetry = Math.max(
    0,
    100 - inputs.asymmetries.reduce((sum, a) => sum + ASYMMETRY_PENALTY[a.severity], 0),
  );
  const conditioning = CONDITIONING_FIT_SCORE[inputs.conditioning];

  const overall = Math.round(
    OVERALL_WEIGHTS.development * development +
      OVERALL_WEIGHTS.proportion * proportion +
      OVERALL_WEIGHTS.symmetry * symmetry +
      OVERALL_WEIGHTS.conditioning * conditioning,
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    subscores: {
      development: Math.round(development),
      proportion: Math.round(proportion),
      symmetry: Math.round(symmetry),
      conditioning: Math.round(conditioning),
    },
  };
}

// ------------------------------------------------------------ priority ranking

function crossAngleRatio(a: MuscleAssessment, avail: Set<ViewAngle>): number {
  const supporting = VIEW_MATRIX[a.muscle].supporting.filter((req) =>
    requirementMet(req, avail),
  );
  if (supporting.length === 0) return 0;
  const cited = new Set(a.evidence.map((e) => e.view));
  const corroborating = supporting.filter((req) =>
    req === "side" ? cited.has("left") || cited.has("right") : cited.has(req),
  );
  return corroborating.length / supporting.length;
}

/** priorityScore per spec §7 — exposed for transparency and tests. */
export function priorityScore(
  a: MuscleAssessment,
  availableViews: ViewAngle[],
): number {
  const avail = new Set(availableViews);
  return (
    PRIORITY_WEIGHTS.gap * gapNorm(a.score as number) +
    PRIORITY_WEIGHTS.importance * IMPORTANCE[a.muscle] +
    PRIORITY_WEIGHTS.confidence * a.confidence +
    PRIORITY_WEIGHTS.crossAngle * crossAngleRatio(a, avail)
  );
}

/**
 * Rank RED groups by gap, V-taper importance, confidence, cross-angle
 * evidence; cap at MAX_PRIORITIES. Ties break by confidence, then importance,
 * then canonical muscle order so the result is fully deterministic.
 */
export function rankPriorities(
  assessments: MuscleAssessment[],
  availableViews: ViewAngle[],
): MuscleAssessment[] {
  const reds = assessments.filter(
    (a) => a.status === "red" && a.score !== null,
  );
  const score = new Map(reds.map((a) => [a.muscle, priorityScore(a, availableViews)]));
  const canonical = new Map(MUSCLE_GROUPS.map((m, i) => [m, i]));

  return [...reds]
    .sort((a, b) => {
      const byScore = (score.get(b.muscle) as number) - (score.get(a.muscle) as number);
      if (byScore !== 0) return byScore;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (IMPORTANCE[b.muscle] !== IMPORTANCE[a.muscle]) {
        return IMPORTANCE[b.muscle] - IMPORTANCE[a.muscle];
      }
      return (canonical.get(a.muscle) as number) - (canonical.get(b.muscle) as number);
    })
    .slice(0, MAX_PRIORITIES);
}

// ------------------------------------------------------------- priority blocks

function formatRange(min: number, max: number): string {
  return `${min}–${max}`;
}

function buildWhy(a: MuscleAssessment, weeklyHardSets: number): string {
  const label = MUSCLE_LABEL[a.muscle];
  const meaning = a.anchor ? ` — ${ANCHOR_MEANING[a.anchor]}` : "";
  const cited = a.evidence
    .slice(0, 2)
    .map((e) => `${e.observation} (${e.view.toUpperCase()})`)
    .join("; ");
  const evidencePart = cited ? ` Evidence: ${cited}.` : "";
  return `${label} rated ${a.anchor ?? "RED"}${meaning}.${evidencePart} ${weeklyHardSets} weekly hard sets is a target total, not volume added on top of current training.`;
}

/**
 * Deterministic six-week specialization blocks from the versioned library's
 * per-muscle template: first two exercises, template dosage, weeklyHardSets
 * labelled a target total. Stage 3 may rewrite "why" but nothing else.
 */
export function buildPriorityBlocks(ranked: MuscleAssessment[]): PriorityBlock[] {
  return ranked.slice(0, MAX_PRIORITIES).map((a) => {
    const entry = EXERCISE_LIBRARY[a.muscle];
    const { prescription } = entry;
    const exercises: PrescribedExercise[] = entry.exercises
      .slice(0, 2)
      .map((e) => ({
        id: e.id,
        name: e.name,
        sets: e.defaultSets,
        repRange: formatRange(e.repRange.min, e.repRange.max),
        frequencyPerWeek: prescription.weeklyExposures,
        restSeconds: e.restSeconds,
      }));

    return {
      muscle: a.muscle,
      why: buildWhy(a, prescription.weeklyHardSets),
      exercises,
      weeklyHardSets: prescription.weeklyHardSets,
      weeklyExposures: prescription.weeklyExposures,
      rir: prescription.rir,
      progressionRule: prescription.progressionRule,
      reassessAt: `Reassess in ${prescription.reassessWeeks} weeks with a full four-view capture under identical conditions.`,
    };
  });
}
