import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/analysis/types";

/**
 * Versioned curated exercise library — Stage 3 selects exercise IDs from
 * here and may never invent lifts or dosages (docs/AI_SCORING_SPEC.md §8).
 * Pure data + pure lookups; persisted per analysis as exercise_library_version.
 */

export const EXERCISE_LIBRARY_VERSION = "1.0.0";

export type Equipment = "cable" | "machine" | "dumbbell" | "barbell" | "bodyweight";

export interface RepRange {
  min: number;
  max: number;
}

export interface LibraryExercise {
  /** Stable kebab slug — never reused or repurposed across versions */
  id: string;
  name: string;
  equipment: Equipment;
  repRange: RepRange;
  /** Hard sets per session at the default two weekly exposures */
  defaultSets: number;
  restSeconds: number;
  notes?: string;
}

export interface PrescriptionTemplate {
  /** Target weekly total — labelled as target when training history is unknown */
  weeklyHardSets: number;
  weeklyExposures: number;
  /** Reps in reserve */
  rir: string;
  progressionRule: string;
  reassessWeeks: number;
}

export interface MuscleLibraryEntry {
  exercises: LibraryExercise[];
  prescription: PrescriptionTemplate;
}

/** The double-progression rule — verbatim from the master prompt example. */
const DOUBLE_PROGRESSION =
  "Increase load after all sets reach the top of the range at the target effort for two consecutive sessions.";

function prescription(weeklyHardSets: number): PrescriptionTemplate {
  return {
    weeklyHardSets,
    weeklyExposures: 2,
    rir: "1–2",
    progressionRule: DOUBLE_PROGRESSION,
    reassessWeeks: 6,
  };
}

/**
 * Invariant: every muscle's weeklyHardSets target is composable from two
 * library exercises at their defaultSets × 2 weekly exposures, mirroring the
 * master prompt's canonical block (3-set primary + 2-set secondary = 10;
 * lats 3 + 3 = 12). Stage 3 can therefore always emit a coherent block.
 */
export const EXERCISE_LIBRARY: Record<MuscleGroup, MuscleLibraryEntry> = {
  lateral_delts: {
    exercises: [
      {
        // Canonical pair from the master prompt — do not alter dosage.
        id: "single-arm-cable-lateral-raise",
        name: "Single-arm cable lateral raise",
        equipment: "cable",
        repRange: { min: 12, max: 20 },
        defaultSets: 3,
        restSeconds: 60,
        notes: "Cable behind the body keeps tension in the lengthened bottom position.",
      },
      {
        id: "machine-lateral-raise",
        name: "Machine lateral raise",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
      {
        id: "dumbbell-lateral-raise",
        name: "Dumbbell lateral raise",
        equipment: "dumbbell",
        repRange: { min: 12, max: 20 },
        defaultSets: 3,
        restSeconds: 60,
        notes: "Lean slightly away from the working side to load the stretch.",
      },
      {
        id: "cable-y-raise",
        name: "Cable Y-raise",
        equipment: "cable",
        repRange: { min: 12, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
    ],
    prescription: prescription(10),
  },

  rear_delts: {
    exercises: [
      {
        id: "reverse-pec-deck",
        name: "Reverse pec-deck fly",
        equipment: "machine",
        repRange: { min: 12, max: 20 },
        defaultSets: 3,
        restSeconds: 60,
      },
      {
        id: "cross-body-cable-rear-delt-fly",
        name: "Cross-body cable rear-delt fly",
        equipment: "cable",
        repRange: { min: 12, max: 20 },
        defaultSets: 2,
        restSeconds: 60,
        notes: "Single arm; start with the hand across the body for a full stretch.",
      },
      {
        id: "chest-supported-dumbbell-reverse-fly",
        name: "Chest-supported dumbbell reverse fly",
        equipment: "dumbbell",
        repRange: { min: 12, max: 20 },
        defaultSets: 3,
        restSeconds: 60,
      },
      {
        id: "rope-face-pull",
        name: "Rope face pull",
        equipment: "cable",
        repRange: { min: 12, max: 20 },
        defaultSets: 2,
        restSeconds: 60,
      },
    ],
    prescription: prescription(10),
  },

  upper_chest: {
    exercises: [
      {
        id: "incline-barbell-press",
        name: "Incline barbell press",
        equipment: "barbell",
        repRange: { min: 6, max: 10 },
        defaultSets: 3,
        restSeconds: 180,
        notes: "30–45° bench; touch the upper chest without bouncing.",
      },
      {
        id: "low-to-high-cable-fly",
        name: "Low-to-high cable fly",
        equipment: "cable",
        repRange: { min: 12, max: 15 },
        defaultSets: 2,
        restSeconds: 75,
      },
      {
        id: "incline-dumbbell-press",
        name: "Incline dumbbell press",
        equipment: "dumbbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
        notes: "Deep controlled stretch at the bottom of every rep.",
      },
      {
        id: "incline-machine-press",
        name: "Incline machine press",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
      },
    ],
    prescription: prescription(10),
  },

  chest: {
    exercises: [
      {
        id: "flat-barbell-bench-press",
        name: "Flat barbell bench press",
        equipment: "barbell",
        repRange: { min: 5, max: 8 },
        defaultSets: 3,
        restSeconds: 180,
      },
      {
        id: "pec-deck-fly",
        name: "Pec-deck fly",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 90,
        notes: "Set the range so the pecs reach a full stretch each rep.",
      },
      {
        id: "flat-dumbbell-press",
        name: "Flat dumbbell press",
        equipment: "dumbbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
        notes: "Full stretch at the bottom; dumbbells travel below bench level.",
      },
      {
        id: "machine-chest-press",
        name: "Machine chest press",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
      },
    ],
    prescription: prescription(10),
  },

  lats: {
    exercises: [
      {
        id: "neutral-grip-lat-pulldown",
        name: "Neutral-grip lat pulldown",
        equipment: "cable",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
      },
      {
        id: "weighted-pull-up",
        name: "Weighted pull-up",
        equipment: "bodyweight",
        repRange: { min: 5, max: 10 },
        defaultSets: 3,
        restSeconds: 180,
        notes: "Full hang at the bottom; add load only with clean full-range reps.",
      },
      {
        id: "single-arm-cable-lat-row",
        name: "Single-arm cable lat row",
        equipment: "cable",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Row low toward the hip; let the shoulder reach forward for the stretch.",
      },
      {
        id: "machine-pullover",
        name: "Machine pullover",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Loads the lats hardest at long muscle length.",
      },
    ],
    prescription: prescription(12),
  },

  upper_back: {
    exercises: [
      {
        id: "chest-supported-machine-row",
        name: "Chest-supported machine row",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
      },
      {
        id: "chest-supported-dumbbell-row",
        name: "Chest-supported dumbbell row",
        equipment: "dumbbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 2,
        restSeconds: 120,
        notes: "Full protraction at the bottom of every rep.",
      },
      {
        id: "seated-cable-row",
        name: "Seated cable row",
        equipment: "cable",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
      },
      {
        id: "barbell-row",
        name: "Barbell row",
        equipment: "barbell",
        repRange: { min: 6, max: 10 },
        defaultSets: 3,
        restSeconds: 180,
      },
    ],
    prescription: prescription(10),
  },

  traps: {
    exercises: [
      {
        id: "dumbbell-shrug",
        name: "Dumbbell shrug",
        equipment: "dumbbell",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 60,
        notes: "Let the shoulders drop into a full stretch between reps.",
      },
      {
        id: "cable-shrug",
        name: "Cable shrug",
        equipment: "cable",
        repRange: { min: 12, max: 20 },
        defaultSets: 2,
        restSeconds: 60,
      },
      {
        id: "barbell-shrug",
        name: "Barbell shrug",
        equipment: "barbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
      },
    ],
    prescription: prescription(10),
  },

  biceps: {
    exercises: [
      {
        id: "incline-dumbbell-curl",
        name: "Incline dumbbell curl",
        equipment: "dumbbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Incline bench puts the biceps under load at long length.",
      },
      {
        id: "behind-body-cable-curl",
        name: "Behind-the-body cable curl",
        equipment: "cable",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
      {
        id: "machine-preacher-curl",
        name: "Machine preacher curl",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Control the bottom — tension in the stretched position drives growth.",
      },
      {
        id: "barbell-curl",
        name: "Barbell curl",
        equipment: "barbell",
        repRange: { min: 6, max: 10 },
        defaultSets: 3,
        restSeconds: 90,
      },
    ],
    prescription: prescription(10),
  },

  triceps: {
    exercises: [
      {
        id: "overhead-cable-triceps-extension",
        name: "Overhead cable triceps extension",
        equipment: "cable",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 75,
        notes: "Overhead position trains the long head at long muscle length.",
      },
      {
        id: "cable-rope-pressdown",
        name: "Cable rope pressdown",
        equipment: "cable",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
      {
        id: "ez-bar-skull-crusher",
        name: "EZ-bar skull crusher",
        equipment: "barbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Lower behind the head to keep the long head stretched.",
      },
      {
        id: "seated-dip-machine",
        name: "Seated dip machine",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
      },
    ],
    prescription: prescription(10),
  },

  forearms: {
    exercises: [
      {
        id: "dumbbell-wrist-curl",
        name: "Dumbbell wrist curl",
        equipment: "dumbbell",
        repRange: { min: 12, max: 20 },
        defaultSets: 3,
        restSeconds: 45,
      },
      {
        id: "cable-reverse-wrist-curl",
        name: "Cable reverse wrist curl",
        equipment: "cable",
        repRange: { min: 12, max: 20 },
        defaultSets: 2,
        restSeconds: 45,
      },
      {
        id: "barbell-reverse-curl",
        name: "Barbell reverse curl",
        equipment: "barbell",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 60,
        notes: "Targets the brachioradialis — the visible top of the forearm.",
      },
    ],
    prescription: prescription(10),
  },

  abs: {
    exercises: [
      {
        id: "cable-crunch",
        name: "Cable crunch",
        equipment: "cable",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 60,
        notes: "Flex the spine — do not turn it into a hip hinge.",
      },
      {
        id: "machine-crunch",
        name: "Machine crunch",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
      {
        id: "hanging-leg-raise",
        name: "Hanging leg raise",
        equipment: "bodyweight",
        repRange: { min: 8, max: 15 },
        defaultSets: 3,
        restSeconds: 90,
      },
      {
        id: "ab-wheel-rollout",
        name: "Ab wheel rollout",
        equipment: "bodyweight",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
      },
    ],
    prescription: prescription(10),
  },

  glutes: {
    exercises: [
      {
        id: "barbell-hip-thrust",
        name: "Barbell hip thrust",
        equipment: "barbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
      },
      {
        id: "cable-pull-through",
        name: "Cable pull-through",
        equipment: "cable",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 90,
      },
      {
        id: "dumbbell-bulgarian-split-squat",
        name: "Dumbbell Bulgarian split squat",
        equipment: "dumbbell",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 120,
        notes: "Slight forward lean and deep range bias the glutes at length.",
      },
      {
        id: "glute-biased-back-extension",
        name: "Glute-biased back extension",
        equipment: "bodyweight",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Round the upper back slightly and tuck the pelvis to keep the glutes working.",
      },
    ],
    prescription: prescription(10),
  },

  quads: {
    exercises: [
      {
        id: "high-bar-back-squat",
        name: "High-bar back squat",
        equipment: "barbell",
        repRange: { min: 5, max: 8 },
        defaultSets: 3,
        restSeconds: 180,
        notes: "Full depth — quads grow most from the deep stretched position.",
      },
      {
        id: "leg-extension",
        name: "Leg extension",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
      {
        id: "hack-squat",
        name: "Hack squat",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 180,
      },
      {
        id: "leg-press",
        name: "Leg press",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 120,
      },
    ],
    prescription: prescription(10),
  },

  hamstrings: {
    exercises: [
      {
        id: "barbell-romanian-deadlift",
        name: "Barbell Romanian deadlift",
        equipment: "barbell",
        repRange: { min: 6, max: 10 },
        defaultSets: 3,
        restSeconds: 180,
        notes: "Hinge until the hamstrings reach a full stretch; do not round the back.",
      },
      {
        id: "seated-leg-curl",
        name: "Seated leg curl",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 90,
        notes: "Hip-flexed seated position trains the hamstrings at longer length than lying.",
      },
      {
        id: "lying-leg-curl",
        name: "Lying leg curl",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 60,
      },
      {
        id: "nordic-ham-curl",
        name: "Nordic ham curl",
        equipment: "bodyweight",
        repRange: { min: 5, max: 10 },
        defaultSets: 2,
        restSeconds: 120,
      },
    ],
    prescription: prescription(10),
  },

  calves: {
    exercises: [
      {
        id: "standing-calf-raise",
        name: "Standing calf raise",
        equipment: "machine",
        repRange: { min: 8, max: 12 },
        defaultSets: 3,
        restSeconds: 90,
        notes: "Pause in the deep stretch at the bottom of every rep.",
      },
      {
        id: "seated-calf-raise",
        name: "Seated calf raise",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
        notes: "Bent knee shifts load to the soleus.",
      },
      {
        id: "leg-press-calf-press",
        name: "Leg-press calf press",
        equipment: "machine",
        repRange: { min: 10, max: 15 },
        defaultSets: 3,
        restSeconds: 60,
      },
      {
        id: "single-leg-dumbbell-calf-raise",
        name: "Single-leg dumbbell calf raise",
        equipment: "dumbbell",
        repRange: { min: 10, max: 15 },
        defaultSets: 2,
        restSeconds: 60,
      },
    ],
    prescription: prescription(10),
  },
};

/** id → exercise, built once from the library — ids are globally unique. */
const EXERCISE_INDEX: ReadonlyMap<string, LibraryExercise> = new Map(
  MUSCLE_GROUPS.flatMap((muscle) =>
    EXERCISE_LIBRARY[muscle].exercises.map((e) => [e.id, e] as const),
  ),
);

export function getExercise(id: string): LibraryExercise | undefined {
  return EXERCISE_INDEX.get(id);
}

export function exercisesFor(muscle: MuscleGroup): LibraryExercise[] {
  return EXERCISE_LIBRARY[muscle].exercises;
}

export function prescriptionFor(muscle: MuscleGroup): PrescriptionTemplate {
  return EXERCISE_LIBRARY[muscle].prescription;
}
