import type {
  AnalysisResult,
  AnalysisVersions,
  MuscleAssessment,
  PriorityBlock,
  QualityGate,
  Subscores,
} from "@/lib/analysis/types";
import type { Narration } from "@/lib/analysis/schemas";

/**
 * Pure assembly helpers — map the deterministic Stage 2 result plus the Stage
 * 3 narration into the canonical AnalysisResult. No model calls, no I/O.
 */

/** Stage 2 output the assembly consumes — structurally satisfied by the scoring engine. */
export interface Stage2Data {
  qualityGate: QualityGate;
  muscles: MuscleAssessment[];
  overall: number | null;
  subscores: Subscores | null;
  confidence: AnalysisResult["confidence"];
  priorities: PriorityBlock[];
}

/**
 * Digit runs that literally appeared in the payload shown to the narration
 * model — the only numbers its prose is allowed to reuse.
 */
export function allowedNumbersIn(payload: string): Set<string> {
  return new Set(payload.match(/\d+/g) ?? []);
}

/**
 * Deterministic analysis-level confidence. "high" needs a pass gate, a mean
 * per-muscle confidence ≥ 0.8, and most groups assessable; a partial/limited
 * capture can never exceed "medium".
 */
export function overallConfidence(
  muscles: MuscleAssessment[],
  gateVerdict: QualityGate["verdict"],
): AnalysisResult["confidence"] {
  const assessed = muscles.filter((m) => m.status !== "not_assessable");
  if (gateVerdict === "fail" || assessed.length === 0) return "low";
  const mean = assessed.reduce((sum, m) => sum + m.confidence, 0) / assessed.length;
  const coverage = assessed.length / muscles.length;
  if (gateVerdict === "pass" && mean >= 0.8 && coverage >= 0.6) return "high";
  return mean >= 0.7 ? "medium" : "low";
}

/**
 * Merge narration into the deterministic result. Narration can never widen
 * the criticism surface: bottlenecks are kept only for Stage 2 priority
 * muscles, "strongest" only if Stage 2 rated that muscle green, and why-texts
 * attach to existing priority blocks — everything numeric stays Stage 2's.
 */
export function assembleAnalysisResult(
  stage2: Stage2Data,
  narration: Narration,
  versions: AnalysisVersions,
  extras?: Pick<AnalysisResult, "estBodyFat" | "condition">,
): AnalysisResult {
  const complete = stage2.qualityGate.verdict === "pass";
  const priorityMuscles = new Set(stage2.priorities.map((p) => p.muscle));
  const greenMuscles = new Set(
    stage2.muscles.filter((m) => m.status === "green").map((m) => m.muscle),
  );

  const whyByMuscle = new Map(narration.priorityWhy.map((w) => [w.muscle, w.why]));

  return {
    status: complete ? "complete" : "limited",
    qualityGate: stage2.qualityGate,
    // A partial capture keeps its score (rubric v1.2) — the retake guidance
    // still tells the user which views would sharpen it.
    overall: stage2.overall,
    subscores: stage2.subscores,
    confidence: stage2.confidence,
    strongest:
      narration.strongest && greenMuscles.has(narration.strongest.muscle)
        ? narration.strongest
        : null,
    bottlenecks: narration.bottlenecks
      .filter((b) => priorityMuscles.has(b.muscle))
      .slice(0, 2),
    verdict: narration.verdict,
    muscles: stage2.muscles,
    priorities: stage2.priorities.map((p) => ({
      ...p,
      why: whyByMuscle.get(p.muscle) ?? p.why,
    })),
    estBodyFat: extras?.estBodyFat ?? null,
    condition: extras?.condition ?? null,
    presentationNotes: narration.presentationNotes,
    versions,
  };
}

/**
 * Gate failure — retake guidance only. No scores, no assessments, no invented
 * criticism; the fixed verdict states the failure without judging the physique.
 */
export function assembleFailedResult(
  qualityGate: QualityGate,
  versions: AnalysisVersions,
): AnalysisResult {
  return {
    status: "failed",
    qualityGate,
    overall: null,
    subscores: null,
    confidence: "low",
    strongest: null,
    bottlenecks: [],
    verdict:
      "This photo set failed the quality gate, so nothing was assessed. Follow the per-view retake guidance and log the check-in again.",
    muscles: [],
    priorities: [],
    estBodyFat: null,
    condition: null,
    presentationNotes: [],
    versions,
  };
}
