import type { AnalysisResult } from "./types";

/**
 * Realistic structured fixtures for the detail experience (Phase 4).
 * Shapes are the canonical AnalysisResult — Phase 6 replaces these with
 * live pipeline output. Verdicts obey the NO-BS contract (≤35 words,
 * evidence-cited, no filler, no insults). Exercise IDs exist in the
 * versioned exercise library.
 */

const VERSIONS = {
  model: "fixture",
  prompt: "0.0.0-fixture",
  rubric: "1.0.0",
  scoring: "1.0.0",
  targetProfile: "1.0.0",
  exerciseLibrary: "1.0.0",
  schema: "1.0.0",
};

const PROGRESSION =
  "Increase load after all sets reach the top of the range at the target effort for two consecutive sessions.";

export const ANALYSIS_FIXTURES: Record<string, AnalysisResult> = {
  "luke-2026-08-24": {
    status: "complete",
    qualityGate: {
      verdict: "pass",
      perView: [
        { view: "front", score: 88, issues: [] },
        { view: "left", score: 84, issues: [] },
        { view: "back", score: 82, issues: ["slightly low camera height"] },
        { view: "right", score: 85, issues: [] },
      ],
      retakeGuidance: [],
    },
    overall: 67,
    subscores: {
      development: 66,
      proportion: 64,
      symmetry: 78,
      conditioning: 72,
    },
    confidence: "high",
    strongest: {
      muscle: "abs",
      statement:
        "Visible upper and lower rows with even segmentation in the front view — ahead of every other group.",
    },
    bottlenecks: [
      {
        muscle: "lateral_delts",
        statement:
          "Shoulder line runs nearly straight into the upper arm in the front view — width is coming from your arms, not your delts.",
      },
      {
        muscle: "upper_chest",
        statement:
          "Clavicular line stays flat in the front and left views; the lower chest carries all of the pec shape.",
      },
    ],
    verdict:
      "Your abs are not the problem. Shoulder width is. Lateral delts trail your arms and waist, so they are the six-week priority — upper chest is second.",
    estBodyFat: { lowPct: 12, highPct: 15, confidence: "medium" },
    condition: {
      bodyFat: "12–15% estimated. Lean enough. Cutting further costs you size, not abs.",
      cardio: "Two 20-minute incline walks a week. That's it — more cardio steals recovery from the delt work.",
      target: "73.4kg now. Aim 75kg by early October at +0.25kg/week. Slower is fine, faster is fat.",
      weightTrend: "+1.2kg since 20 JUL with abs unchanged — the surplus is working. Keep it.",
    },
    muscles: [
      {
        muscle: "lateral_delts",
        anchor: "A1",
        score: 25,
        status: "red",
        confidence: 0.86,
        evidence: [
          {
            view: "front",
            observation:
              "Delt-to-arm transition is flat; no cap flare beyond the elbow line.",
          },
          {
            view: "back",
            observation: "Upper-arm silhouette exceeds delt width at rest.",
          },
        ],
      },
      {
        muscle: "upper_chest",
        anchor: "A2",
        score: 50,
        status: "red",
        confidence: 0.78,
        evidence: [
          {
            view: "front",
            observation: "Clavicular region flat relative to mid/lower pec.",
          },
          {
            view: "left",
            observation: "Chest profile drops off above the nipple line.",
          },
        ],
      },
      {
        muscle: "abs",
        anchor: "A4",
        score: 100,
        status: "green",
        confidence: 0.92,
        evidence: [
          {
            view: "front",
            observation: "Clear segmentation across all rows at rest.",
          },
        ],
      },
      {
        muscle: "chest",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.84,
        evidence: [
          { view: "front", observation: "Full mid-pec with defined lower line." },
        ],
      },
      {
        muscle: "biceps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.81,
        evidence: [
          {
            view: "front",
            observation: "Arm mass ahead of shoulder line at rest.",
          },
        ],
      },
      {
        muscle: "lats",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.74,
        evidence: [
          { view: "back", observation: "Visible taper from armpit to waist." },
        ],
      },
      {
        muscle: "upper_back",
        anchor: "A2",
        score: 50,
        status: "red",
        confidence: 0.66,
        evidence: [
          {
            view: "back",
            observation: "Mid-trap and rhomboid detail washed at rest.",
          },
        ],
      },
      {
        muscle: "traps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.7,
        evidence: [
          { view: "back", observation: "Upper trap slope present, not dominant." },
        ],
      },
      {
        muscle: "rear_delts",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.4,
        evidence: [
          {
            view: "back",
            observation: "Arm position hides the rear delt in this frame.",
          },
        ],
      },
      {
        muscle: "triceps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.72,
        evidence: [
          { view: "right", observation: "Clear horseshoe outline at rest." },
        ],
      },
      {
        muscle: "forearms",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.5,
        evidence: [],
      },
      {
        muscle: "glutes",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.35,
        evidence: [
          { view: "back", observation: "Waistband crops the glute line." },
        ],
      },
      {
        muscle: "quads",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [{ view: "front", observation: "Framing cuts mid-thigh." }],
      },
      {
        muscle: "hamstrings",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
      {
        muscle: "calves",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
    ],
    priorities: [
      {
        muscle: "lateral_delts",
        why: "Largest gap against the V-taper target, confirmed from two angles, and it caps perceived width more than any other group.",
        exercises: [
          {
            id: "single-arm-cable-lateral-raise",
            name: "Single-arm cable lateral raise",
            sets: 3,
            repRange: "12–20",
            frequencyPerWeek: 2,
            restSeconds: 60,
          },
          {
            id: "machine-lateral-raise",
            name: "Machine lateral raise",
            sets: 2,
            repRange: "10–15",
            frequencyPerWeek: 2,
            restSeconds: 60,
          },
        ],
        weeklyHardSets: 10,
        weeklyExposures: 2,
        rir: "1–2",
        progressionRule: PROGRESSION,
        reassessAt:
          "Six-week target: one anchor step (A1 → A2), same four angles.",
      },
      {
        muscle: "upper_chest",
        why: "Second-largest confirmed gap; lifting the clavicular line changes the whole front-view silhouette.",
        exercises: [
          {
            id: "incline-dumbbell-press",
            name: "Incline dumbbell press",
            sets: 3,
            repRange: "6–10",
            frequencyPerWeek: 2,
            restSeconds: 150,
          },
          {
            id: "low-to-high-cable-fly",
            name: "Low-to-high cable fly",
            sets: 2,
            repRange: "10–15",
            frequencyPerWeek: 2,
            restSeconds: 90,
          },
        ],
        weeklyHardSets: 10,
        weeklyExposures: 2,
        rir: "1–2",
        progressionRule: PROGRESSION,
        reassessAt:
          "Six-week target: a visible clavicular shelf in the left view, same four angles.",
      },
    ],
    presentationNotes: [
      "Framing crops at mid-thigh — step back so the full body is visible and the lower half becomes assessable.",
      "More skin contrast would improve visible definition in photographs.",
    ],
    versions: VERSIONS,
  },

  "rowan-2026-08-23": {
    status: "complete",
    qualityGate: {
      verdict: "pass",
      perView: [
        { view: "front", score: 84, issues: [] },
        { view: "left", score: 81, issues: ["light falls unevenly"] },
        { view: "back", score: 83, issues: [] },
        { view: "right", score: 80, issues: [] },
      ],
      retakeGuidance: [],
    },
    overall: 63,
    subscores: {
      development: 62,
      proportion: 60,
      symmetry: 74,
      conditioning: 68,
    },
    confidence: "high",
    strongest: {
      muscle: "chest",
      statement:
        "Full mid-pec with a defined lower line in the front view — clearly the most developed group.",
    },
    bottlenecks: [
      {
        muscle: "lats",
        statement:
          "The back view shows almost no armpit-to-waist flare; your torso reads straight from behind.",
      },
      {
        muscle: "rear_delts",
        statement:
          "The rear silhouette drops straight from trap to triceps — no posterior cap from either side view.",
      },
    ],
    verdict:
      "Your chest is carrying the physique. The back is not keeping up: lats show no flare and rear delts no cap, so back width is the six-week priority.",
    estBodyFat: { lowPct: 14, highPct: 17, confidence: "medium" },
    condition: {
      bodyFat: "14–17% estimated. Fine for building. Don't cut — you'd be cutting into a back that isn't built yet.",
      cardio: "One or two 20-minute walks weekly for health. Cardio is not your lever right now — back volume is.",
      target: "70.6kg now. Aim 72kg by mid-October at +0.2kg/week while the back catches up.",
      weightTrend: "+0.5kg since 26 JUL — slow and steady. Acceptable; don't chase the scale.",
    },
    muscles: [
      {
        muscle: "lats",
        anchor: "A1",
        score: 25,
        status: "red",
        confidence: 0.84,
        evidence: [
          {
            view: "back",
            observation: "No visible flare from armpit to waist at rest.",
          },
        ],
      },
      {
        muscle: "rear_delts",
        anchor: "A1",
        score: 25,
        status: "red",
        confidence: 0.75,
        evidence: [
          {
            view: "right",
            observation: "Posterior shoulder line is flat into the arm.",
          },
          {
            view: "left",
            observation: "Same flat transition on the opposite side.",
          },
        ],
      },
      {
        muscle: "chest",
        anchor: "A4",
        score: 100,
        status: "green",
        confidence: 0.9,
        evidence: [
          { view: "front", observation: "Full mid-pec, defined lower line." },
        ],
      },
      {
        muscle: "abs",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.85,
        evidence: [{ view: "front", observation: "Upper rows visible at rest." }],
      },
      {
        muscle: "lateral_delts",
        anchor: "A2",
        score: 50,
        status: "red",
        confidence: 0.72,
        evidence: [
          { view: "front", observation: "Modest cap, trails arm mass." },
        ],
      },
      {
        muscle: "biceps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.8,
        evidence: [{ view: "front", observation: "Clear peak at rest." }],
      },
      {
        muscle: "upper_chest",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.76,
        evidence: [
          { view: "left", observation: "Clavicular line holds into the profile." },
        ],
      },
      {
        muscle: "upper_back",
        anchor: "A2",
        score: 50,
        status: "red",
        confidence: 0.68,
        evidence: [
          { view: "back", observation: "Little mid-back detail at rest." },
        ],
      },
      {
        muscle: "traps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.71,
        evidence: [{ view: "back", observation: "Balanced upper-trap slope." }],
      },
      {
        muscle: "triceps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.7,
        evidence: [{ view: "left", observation: "Visible long-head mass." }],
      },
      {
        muscle: "forearms",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.45,
        evidence: [],
      },
      {
        muscle: "glutes",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.35,
        evidence: [],
      },
      {
        muscle: "quads",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
      {
        muscle: "hamstrings",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
      {
        muscle: "calves",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
    ],
    priorities: [
      {
        muscle: "lats",
        why: "Largest confirmed gap and the main reason the rear view reads narrow; direct driver of the V-taper target.",
        exercises: [
          {
            id: "neutral-grip-lat-pulldown",
            name: "Neutral-grip lat pulldown",
            sets: 3,
            repRange: "8–12",
            frequencyPerWeek: 2,
            restSeconds: 120,
          },
          {
            id: "single-arm-cable-lat-row",
            name: "Single-arm cable lat row",
            sets: 2,
            repRange: "10–15",
            frequencyPerWeek: 2,
            restSeconds: 120,
          },
        ],
        weeklyHardSets: 12,
        weeklyExposures: 2,
        rir: "1–2",
        progressionRule: PROGRESSION,
        reassessAt:
          "Six-week target: visible flare at rest in the back view, same four angles.",
      },
      {
        muscle: "rear_delts",
        why: "Confirmed from both side views; closing it rounds the shoulder line without adding pressing volume.",
        exercises: [
          {
            id: "reverse-pec-deck",
            name: "Reverse pec-deck fly",
            sets: 3,
            repRange: "12–20",
            frequencyPerWeek: 2,
            restSeconds: 60,
          },
          {
            id: "cross-body-cable-rear-delt-fly",
            name: "Cross-body cable rear-delt fly",
            sets: 2,
            repRange: "12–20",
            frequencyPerWeek: 2,
            restSeconds: 60,
          },
        ],
        weeklyHardSets: 10,
        weeklyExposures: 2,
        rir: "1–2",
        progressionRule: PROGRESSION,
        reassessAt:
          "Six-week target: one anchor step (A1 → A2), same four angles.",
      },
    ],
    presentationNotes: [
      "Lighting falls unevenly in the left view — face the light source squarely for consistent shadows.",
    ],
    versions: VERSIONS,
  },

  "luke-2026-08-17": {
    status: "limited",
    qualityGate: {
      verdict: "partial",
      perView: [{ view: "front", score: 76, issues: ["single view only"] }],
      retakeGuidance: [
        "Add LEFT, BACK and RIGHT from the same spot, same camera height, same lens.",
      ],
    },
    overall: null,
    subscores: null,
    confidence: "low",
    strongest: {
      muscle: "abs",
      statement: "Segmentation visible in the only captured view.",
    },
    bottlenecks: [
      {
        muscle: "lateral_delts",
        statement:
          "Front view shows the shoulder line running flat into the arm — same pattern as your last full set.",
      },
    ],
    verdict:
      "One angle only, so no overall score. From the front: abs lead, lateral delts still trail your arms. Shoot the full four-angle set to unlock a complete assessment.",
    estBodyFat: null,
    condition: null,
    muscles: [
      {
        muscle: "lateral_delts",
        anchor: "A1",
        score: 25,
        status: "red",
        confidence: 0.7,
        evidence: [
          { view: "front", observation: "Flat delt-to-arm transition." },
        ],
      },
      {
        muscle: "abs",
        anchor: "A4",
        score: 100,
        status: "green",
        confidence: 0.85,
        evidence: [
          { view: "front", observation: "Clear segmentation at rest." },
        ],
      },
      {
        muscle: "chest",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.75,
        evidence: [{ view: "front", observation: "Full mid-pec visible." }],
      },
      {
        muscle: "upper_chest",
        anchor: "A2",
        score: 50,
        status: "red",
        confidence: 0.65,
        evidence: [{ view: "front", observation: "Flat clavicular region." }],
      },
      {
        muscle: "biceps",
        anchor: "A3",
        score: 75,
        status: "green",
        confidence: 0.7,
        evidence: [{ view: "front", observation: "Arm mass ahead of delts." }],
      },
      {
        muscle: "lats",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.1,
        evidence: [],
      },
      {
        muscle: "upper_back",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.1,
        evidence: [],
      },
      {
        muscle: "rear_delts",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.1,
        evidence: [],
      },
      {
        muscle: "traps",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.2,
        evidence: [],
      },
      {
        muscle: "triceps",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
      {
        muscle: "forearms",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.3,
        evidence: [],
      },
      {
        muscle: "glutes",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.1,
        evidence: [],
      },
      {
        muscle: "quads",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.2,
        evidence: [],
      },
      {
        muscle: "hamstrings",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.1,
        evidence: [],
      },
      {
        muscle: "calves",
        anchor: null,
        score: null,
        status: "not_assessable",
        confidence: 0.1,
        evidence: [],
      },
    ],
    priorities: [],
    presentationNotes: [],
    versions: VERSIONS,
  },
};
