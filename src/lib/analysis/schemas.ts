import { z } from "zod";
import type { ViewAngle } from "@/lib/types";
import { MUSCLE_GROUPS } from "@/lib/analysis/types";
import {
  ASYMMETRY_PENALTY,
  CONDITIONING_FIT_SCORE,
  PROPORTION_FIT_SCORE,
  PROPORTION_TARGETS,
  type AsymmetrySeverity,
  type ConditioningBand,
  type ProportionFit,
  type ProportionTargetId,
} from "@/lib/analysis/rubric";

/**
 * Zod schemas for the two model calls — Stage 1 vision evidence and Stage 3
 * narration. These mirror the canonical shapes in types.ts and are the only
 * accepted model output; a failed parse triggers exactly one retry, then a
 * clean failure. Any change here bumps SCHEMA_VERSION (persisted per analysis).
 */

export const SCHEMA_VERSION = "1.1.0";

const VIEW_ANGLES = ["front", "left", "back", "right"] as const satisfies readonly ViewAngle[];

export const viewAngleSchema = z.enum(VIEW_ANGLES);
export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);
export const anchorSchema = z.enum(["A0", "A1", "A2", "A3", "A4"]);

export const evidenceItemSchema = z.object({
  view: viewAngleSchema,
  observation: z.string().min(1),
});

/**
 * Stage 1 — per-view quality. The prompt requires any hard failure (blur,
 * crop, filter, mirror selfie, mixed session…) to score below 70 and be named
 * first in issues, so the deterministic gate needs only score + issues.
 */
export const viewQualitySchema = z.object({
  view: viewAngleSchema,
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
});

/** Stage 1 — raw per-muscle observation. anchor null = not visible in the provided views. */
export const muscleObservationSchema = z
  .object({
    muscle: muscleGroupSchema,
    anchor: anchorSchema.nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(evidenceItemSchema),
  })
  .refine((m) => m.anchor === null || m.evidence.length > 0, {
    message: "an anchored muscle must cite at least one piece of visible evidence",
  });

// Enum values sourced from the rubric so schema and scoring can never drift.
const proportionTargetSchema = z.enum(
  PROPORTION_TARGETS.map((t) => t.id) as [ProportionTargetId, ...ProportionTargetId[]],
);
const proportionFitSchema = z.enum(
  Object.keys(PROPORTION_FIT_SCORE) as [ProportionFit, ...ProportionFit[]],
);
const asymmetrySeveritySchema = z.enum(
  Object.keys(ASYMMETRY_PENALTY) as [AsymmetrySeverity, ...AsymmetrySeverity[]],
);
const conditioningBandSchema = z.enum(
  Object.keys(CONDITIONING_FIT_SCORE) as [ConditioningBand, ...ConditioningBand[]],
);

/**
 * Proportion / symmetry / conditioning sub-inputs — a 0–100 score with cited
 * evidence, plus the rubric-enum findings the deterministic composite
 * consumes. Findings cover only relationships actually visible; evidence may
 * state what limited the read (e.g. "full body not visible in FRONT").
 */
const proportionInputSchema = z
  .object({
    score: z.number().min(0).max(100),
    evidence: z.array(evidenceItemSchema).min(1),
    findings: z.array(z.object({ target: proportionTargetSchema, fit: proportionFitSchema })),
  })
  .refine((p) => new Set(p.findings.map((f) => f.target)).size === p.findings.length, {
    message: "duplicate proportion targets",
  });

const symmetryInputSchema = z
  .object({
    score: z.number().min(0).max(100),
    evidence: z.array(evidenceItemSchema).min(1),
    asymmetries: z.array(z.object({ muscle: muscleGroupSchema, severity: asymmetrySeveritySchema })),
  })
  .refine((s) => new Set(s.asymmetries.map((a) => a.muscle)).size === s.asymmetries.length, {
    message: "duplicate asymmetry muscles",
  });

const conditioningInputSchema = z.object({
  score: z.number().min(0).max(100),
  evidence: z.array(evidenceItemSchema).min(1),
  band: conditioningBandSchema,
});

/**
 * Stage 1 — visual body-fat ESTIMATE. Always a plausible integer range
 * (2–6 points wide), never a single exact number; null when the torso is not
 * visible enough to estimate.
 */
export const bodyFatEstimateSchema = z
  .object({
    lowPct: z.number().int().min(3).max(50),
    highPct: z.number().int().min(3).max(50),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .refine((b) => b.lowPct < b.highPct, { message: "lowPct must be below highPct" })
  .refine((b) => b.highPct - b.lowPct >= 2 && b.highPct - b.lowPct <= 6, {
    message: "estimate range must be 2-6 points wide",
  });

export const visionEvidenceSchema = z
  .object({
    quality: z.array(viewQualitySchema).min(1),
    muscles: z.array(muscleObservationSchema),
    proportion: proportionInputSchema,
    symmetry: symmetryInputSchema,
    conditioning: conditioningInputSchema,
    estBodyFat: bodyFatEstimateSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    const seen = new Set(v.muscles.map((m) => m.muscle));
    if (seen.size !== v.muscles.length) {
      ctx.addIssue({ code: "custom", message: "duplicate muscle entries", path: ["muscles"] });
    }
    for (const group of MUSCLE_GROUPS) {
      if (!seen.has(group)) {
        ctx.addIssue({ code: "custom", message: `missing muscle group "${group}"`, path: ["muscles"] });
      }
    }
    if (new Set(v.quality.map((q) => q.view)).size !== v.quality.length) {
      ctx.addIssue({ code: "custom", message: "duplicate view quality entries", path: ["quality"] });
    }
  });

export type VisionEvidence = z.infer<typeof visionEvidenceSchema>;
export type MuscleObservation = z.infer<typeof muscleObservationSchema>;

/**
 * NO-BS contract enforcement — literal phrases plus pattern checks for
 * body-fat percentage claims and medical/hormonal conclusions. Matching any
 * of these fails the narration parse and triggers the single retry.
 */
export const FORBIDDEN_PHRASES = [
  "it's over",
  "its over",
  "it’s over",
  "pathetic",
  "disgusting",
  "bad genetics",
  "stay consistent",
  "eat clean",
  "keep working hard",
] as const;

const FORBIDDEN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\d+(?:\.\d+)?\s*%\s*(?:body\s*fat|bf\b)/i, label: "body-fat percentage claim" },
  { re: /body\s*fat\s*(?:of\s+|around\s+|near\s+|at\s+)?\d+(?:\.\d+)?\s*%/i, label: "body-fat percentage claim" },
  { re: /\b(?:testosterone|hormonal|hormones?|cortisol|thyroid|medical(?:ly)?|diagnos\w*)\b/i, label: "medical or hormonal claim" },
];

export function forbiddenPhraseIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) return `"${phrase}"`;
  }
  for (const { re, label } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Stage 3 — narration. Built per-request: `allowedNumbers` is the set of
 * digit runs that literally appeared in the payload shown to the model, so
 * the narration can never contain a number it was not given.
 */
export function narrationSchema(allowedNumbers: ReadonlySet<string>) {
  const narrated = (label: string) =>
    z
      .string()
      .min(1)
      .superRefine((text, ctx) => {
        const forbidden = forbiddenPhraseIn(text);
        if (forbidden) {
          ctx.addIssue({ code: "custom", message: `${label} contains forbidden ${forbidden}` });
        }
        for (const digits of text.match(/\d+/g) ?? []) {
          if (!allowedNumbers.has(digits)) {
            ctx.addIssue({
              code: "custom",
              message: `${label} contains the number ${digits}, which was not in the input`,
            });
          }
        }
      });

  // Condition guidance — same forbidden-language contract as the verdict plus
  // a 26-word cap, but NOT the digit whitelist: the target is COMPUTED from
  // current weight and trend, so derived digits (target weight, weekly rate)
  // cannot appear in the payload. Exact single-number body-fat claims and
  // medical/hormonal language still fail via forbiddenPhraseIn.
  const conditionText = (label: string) =>
    z
      .string()
      .min(1)
      .superRefine((text, ctx) => {
        const forbidden = forbiddenPhraseIn(text);
        if (forbidden) {
          ctx.addIssue({ code: "custom", message: `${label} contains forbidden ${forbidden}` });
        }
        if (wordCount(text) > 26) {
          ctx.addIssue({ code: "custom", message: `${label} must be at most 26 words` });
        }
      });

  return z.object({
    verdict: narrated("verdict").refine((s) => wordCount(s) <= 35, {
      message: "verdict must be at most 35 words",
    }),
    strongest: z
      .object({ muscle: muscleGroupSchema, statement: narrated("strongest statement") })
      .nullable(),
    bottlenecks: z
      .array(z.object({ muscle: muscleGroupSchema, statement: narrated("bottleneck statement") }))
      .max(2),
    priorityWhy: z
      .array(z.object({ muscle: muscleGroupSchema, why: narrated("priority why") }))
      .max(2),
    presentationNotes: z.array(narrated("presentation note")),
    condition: z.object({
      bodyFat: conditionText("condition.bodyFat"),
      cardio: conditionText("condition.cardio"),
      target: conditionText("condition.target"),
      weightTrend: conditionText("condition.weightTrend").nullable(),
    }),
  });
}

export type Narration = z.infer<ReturnType<typeof narrationSchema>>;
