/**
 * Versioned form-card library — reference photos, numbered steps and coaching
 * cues for a subset of the curated exercise library, keyed by exercise id.
 * Sourced from the Vitality reference cards; pure data + pure lookups.
 * Photos live at /form-cards/{id}/0.jpg and 1.jpg ("images" counts how many
 * exist — a card with 0 simply hides its photo section).
 */

export const FORM_CARDS_VERSION = "1.0.0";

export interface FormCard {
  name: string;
  muscles: string[];
  /** 1 = heaviest compound builders, 3 = isolation */
  tier: number;
  equipment: string;
  /** One-sentence what-this-is */
  gist: string;
  steps: string[];
  cues: string[];
  /** How many of 0.jpg / 1.jpg exist under /form-cards/{id}/ */
  images: number;
}

export const FORM_CARDS: Record<string, FormCard> = {
  // vitality: ab_wheel
  "ab-wheel-rollout": {
    name: "Ab wheel rollout",
    muscles: ["Core"],
    tier: 3,
    equipment: "barbell",
    gist: "Barbell core rollout.",
    steps: [
      "Pushup position on a light bar",
      "Roll the bar toward your feet",
      "Pause, then roll back out",
    ],
    cues: [
      "Keep abs tight, back set",
      "Arms perpendicular to the floor",
      "Brace hard, ribs down. Roll out as far as you can keep tension.",
    ],
    images: 2,
  },
  // vitality: bb_curl
  "barbell-curl": {
    name: "Barbell curl",
    muscles: ["Biceps"],
    tier: 2,
    equipment: "barbell",
    gist: "The barbell biceps builder.",
    steps: [
      "Bar at shoulder width, palms up",
      "Curl up, elbows pinned",
      "Lower slow to the start",
    ],
    cues: [
      "Upper arms stay still",
      "Only the forearms move",
      "Elbows at sides. No swinging. Squeeze biceps hard at top.",
    ],
    images: 2,
  },
  // vitality: hip_thrust
  "barbell-hip-thrust": {
    name: "Barbell hip thrust",
    muscles: ["Glutes", "Hamstrings"],
    tier: 2,
    equipment: "barbell",
    gist: "Barbell glute builder.",
    steps: [
      "Upper back on bench, bar on hips",
      "Drive hips up through the bar",
      "Lower to the start",
    ],
    cues: [
      "Squeeze glutes at the top",
      "Weight on blades and feet",
      "Bench at upper back. Drive heels through floor. Squeeze glutes at the top, ribs down.",
    ],
    images: 2,
  },
  // vitality: rdl
  "barbell-romanian-deadlift": {
    name: "Romanian deadlift",
    muscles: ["Hamstrings", "Glutes", "Mid back"],
    tier: 1,
    equipment: "barbell",
    gist: "Romanian hamstring builder.",
    steps: [
      "Grip bar, shins vertical",
      "Hinge hips back, bar close",
      "Drive hips to stand",
    ],
    cues: [
      "Back and arms straight",
      "Chest up, move steady",
      "Hinge at hips, soft knees. Bar against legs. Stretch hamstrings, drive hips through.",
    ],
    images: 2,
  },
  // vitality: bb_row
  "barbell-row": {
    name: "Barbell row",
    muscles: ["Mid back", "Lats", "Biceps", "Rear delts"],
    tier: 1,
    equipment: "barbell",
    gist: "Bent-over barbell back row.",
    steps: [
      "Hinge to about 45 degrees, back flat",
      "Pull the bar to your lower chest",
      "Lower slow, keep it close",
    ],
    cues: [
      "Lead with your elbows",
      "Squeeze your back at the top",
    ],
    images: 0,
  },
  // vitality: cable_crunch
  "cable-crunch": {
    name: "Cable crunch",
    muscles: ["Core"],
    tier: 3,
    equipment: "cable",
    gist: "Kneeling cable ab work.",
    steps: [
      "Kneel, rope by your face",
      "Crunch elbows to thighs",
      "Return slow",
    ],
    cues: [
      "Constant tension on abs",
      "Do not pull with low back",
    ],
    images: 2,
  },
  // vitality: tri_pushdown
  "cable-rope-pressdown": {
    name: "Tricep rope pushdown",
    muscles: ["Triceps"],
    tier: 3,
    equipment: "cable",
    gist: "Rope triceps pushdown.",
    steps: [
      "Rope at high pulley, elbows in",
      "Push down to your thighs",
      "Return slow",
    ],
    cues: [
      "Upper arms by your sides",
      "Only the forearms move",
    ],
    images: 2,
  },
  // vitality: chest_supp_row
  "chest-supported-dumbbell-row": {
    name: "Chest-supported DB row",
    muscles: ["Mid back", "Lats", "Biceps", "Rear delts"],
    tier: 2,
    equipment: "dumbbell",
    gist: "Chest-supported upper-back row.",
    steps: [
      "Lean into an incline bench",
      "Row dumbbells to your sides",
      "Pause, then lower",
    ],
    cues: [
      "Neutral grip",
      "Squeeze blades at the top",
      "Bench at 30 degrees, lay flat. Drive elbows up and back. Squeeze, no bounce.",
    ],
    images: 2,
  },
  // vitality: rear_delt_fly
  "cross-body-cable-rear-delt-fly": {
    name: "Rear delt cable fly",
    muscles: ["Rear delts"],
    tier: 3,
    equipment: "cable",
    gist: "Cable rear-delt fly.",
    steps: [
      "Cross grip, pulleys high",
      "Pull arms back and out",
      "Return slow",
    ],
    cues: [
      "Keep arms straight",
      "Motion from the shoulders",
    ],
    images: 2,
  },
  // vitality: bulgarian_ss
  "dumbbell-bulgarian-split-squat": {
    name: "Bulgarian split squat",
    muscles: ["Quads", "Glutes", "Hamstrings"],
    tier: 2,
    equipment: "other",
    gist: "Rear-foot-up quad builder.",
    steps: [
      "Rear foot in the strap",
      "Drop into the front knee",
      "Drive back up",
    ],
    cues: [
      "Weight on your front heel",
      "Chest up throughout",
    ],
    images: 2,
  },
  // vitality: db_lat_raise
  "dumbbell-lateral-raise": {
    name: "DB lateral raise",
    muscles: ["Side delts"],
    tier: 3,
    equipment: "dumbbell",
    gist: "Dumbbell side-delt raise.",
    steps: [
      "Dumbbells at your sides, soft elbows",
      "Raise out to shoulder height",
      "Lower slow",
    ],
    cues: [
      "Lead with your elbows",
      "Stay tall, no swinging",
    ],
    images: 0,
  },
  // vitality: skullcrushers
  "ez-bar-skull-crusher": {
    name: "Skullcrushers",
    muscles: ["Triceps"],
    tier: 3,
    equipment: "e-z curl bar",
    gist: "EZ-bar triceps extension.",
    steps: [
      "Lie down, arms vertical",
      "Lower bar to your forehead",
      "Extend back up",
    ],
    cues: [
      "Upper arms stay still",
      "Move only at the elbows",
      "Lower behind the head, not at the forehead. Keeps tension on the long head.",
    ],
    images: 2,
  },
  // vitality: bench_bb
  "flat-barbell-bench-press": {
    name: "Barbell bench",
    muscles: ["Chest", "Front delts", "Triceps"],
    tier: 1,
    equipment: "barbell",
    gist: "The barbell chest builder.",
    steps: [
      "Unrack over your chest",
      "Lower slow to your neck",
      "Press up and squeeze",
    ],
    cues: [
      "Lower slower than you press",
      "Squeeze chest at lockout",
      "Wrists stacked over elbows. Tuck the elbows slightly, drive into the bar, hold the arch.",
    ],
    images: 2,
  },
  // vitality: flat_db_press
  "flat-dumbbell-press": {
    name: "Flat DB press",
    muscles: ["Chest", "Front delts", "Triceps"],
    tier: 2,
    equipment: "dumbbell",
    gist: "Flat dumbbell chest press.",
    steps: [
      "Dumbbells at your chest, palms forward",
      "Press up over your chest",
      "Lower slow to a stretch",
    ],
    cues: [
      "Wrists stacked over elbows",
      "Lower slower than you press",
    ],
    images: 0,
  },
  // vitality: hack_squat
  "hack-squat": {
    name: "Hack squat",
    muscles: ["Quads", "Glutes"],
    tier: 2,
    equipment: "machine",
    gist: "Machine quad squat.",
    steps: [
      "Back on pad, feet on platform",
      "Drop below parallel",
      "Push through your heels",
    ],
    cues: [
      "Head up, back on pad",
      "Knees track over toes",
    ],
    images: 2,
  },
  // vitality: hang_leg_raise
  "hanging-leg-raise": {
    name: "Hanging leg raise",
    muscles: ["Core"],
    tier: 3,
    equipment: "body only",
    gist: "Hanging ab raise.",
    steps: [
      "Hang, legs straight",
      "Raise legs to 90 degrees",
      "Lower slow",
    ],
    cues: [
      "No swinging",
      "Control the descent",
      "Strict, no swing. Curl the pelvis up, not just the legs.",
    ],
    images: 2,
  },
  // vitality: back_squat
  "high-bar-back-squat": {
    name: "Barbell back squat",
    muscles: ["Quads", "Glutes", "Hamstrings"],
    tier: 1,
    equipment: "barbell",
    gist: "The barbell leg builder.",
    steps: [
      "Bar on your upper back",
      "Sit down and back, chest up",
      "Drive through your heels",
    ],
    cues: [
      "Knees track over your toes",
      "Chest up, back flat",
      "Bar on traps or rear delts. Knees track over toes. Hip and knee bend together.",
    ],
    images: 2,
  },
  // vitality: incl_bb_bench
  "incline-barbell-press": {
    name: "Incline barbell bench",
    muscles: ["Chest", "Front delts", "Triceps"],
    tier: 1,
    equipment: "barbell",
    gist: "Incline barbell upper-chest press.",
    steps: [
      "Unrack over upper chest",
      "Lower slow to upper chest",
      "Press up and squeeze",
    ],
    cues: [
      "Lower slower than you press",
      "Squeeze chest at lockout",
      "30 degree incline max. Any higher and it becomes shoulder press. Touch upper chest.",
    ],
    images: 2,
  },
  // vitality: incl_db_curl
  "incline-dumbbell-curl": {
    name: "Incline DB curl",
    muscles: ["Biceps"],
    tier: 3,
    equipment: "dumbbell",
    gist: "Incline dumbbell biceps curl.",
    steps: [
      "Lie back, arms hanging, palms forward",
      "Curl up to shoulders",
      "Lower slow",
    ],
    cues: [
      "Upper arms stay still",
      "Only the forearms move",
      "Bench at 45 degrees, let arms hang straight. Full stretch on the long head.",
    ],
    images: 2,
  },
  // vitality: incl_db_press
  "incline-dumbbell-press": {
    name: "Incline DB press",
    muscles: ["Chest", "Front delts", "Triceps"],
    tier: 2,
    equipment: "dumbbell",
    gist: "Incline dumbbell upper-chest press.",
    steps: [
      "Dumbbells at shoulder width, palms forward",
      "Press up with your chest",
      "Lower slow",
    ],
    cues: [
      "Lower slower than you press",
      "Stay in full control",
      "30 degree incline. Lower DBs to upper chest. Squeeze pecs at top.",
    ],
    images: 2,
  },
  // vitality: leg_ext
  "leg-extension": {
    name: "Leg extension",
    muscles: ["Quads"],
    tier: 3,
    equipment: "machine",
    gist: "Single-leg quad extension.",
    steps: [
      "Pad on lower shin",
      "Extend one leg fully",
      "Return without resting",
    ],
    cues: [
      "Keep tension on the quad",
      "Pause at the top",
    ],
    images: 2,
  },
  // vitality: leg_press
  "leg-press": {
    name: "Leg press",
    muscles: ["Quads", "Glutes"],
    tier: 2,
    equipment: "machine",
    gist: "Machine quad press.",
    steps: [
      "Feet shoulder width on platform",
      "Lower to 90 degrees",
      "Push through your heels",
    ],
    cues: [
      "Do not lock your knees",
      "Lock the pins when done",
      "Feet shoulder-width. Do not lock knees at top. Full ROM, no lower back lift.",
    ],
    images: 2,
  },
  // vitality: machine_chest
  "machine-chest-press": {
    name: "Machine chest press",
    muscles: ["Chest", "Front delts", "Triceps"],
    tier: 2,
    equipment: "machine",
    gist: "Machine chest press.",
    steps: [
      "Upper arms parallel, palms down",
      "Press the handles out",
      "Return slow",
    ],
    cues: [
      "Hold the squeeze a beat",
      "Back flat on the pad",
    ],
    images: 2,
  },
  // vitality: preacher_curl
  "machine-preacher-curl": {
    name: "Preacher curl",
    muscles: ["Biceps"],
    tier: 3,
    equipment: "barbell",
    gist: "Preacher biceps curl.",
    steps: [
      "Arms on the pad, bar up",
      "Lower to a full stretch",
      "Curl up and squeeze",
    ],
    cues: [
      "Upper arms stay on pad",
      "Squeeze a beat at the top",
      "Pads in the armpits, elbows fixed. Slow eccentric, no relaxing at the bottom.",
    ],
    images: 2,
  },
  // vitality: lat_pulldown
  "neutral-grip-lat-pulldown": {
    name: "Lat pulldown",
    muscles: ["Lats", "Biceps", "Mid back"],
    tier: 2,
    equipment: "cable",
    gist: "Lat pulldown.",
    steps: [
      "Grip handle overhand",
      "Pull elbow to your side",
      "Return slow",
    ],
    cues: [
      "Keep tension on the lats",
      "Drive the elbow down",
      "Slight lean back, drive elbows down and back. Stop at upper chest.",
    ],
    images: 2,
  },
  // vitality: oh_tri_ext
  "overhead-cable-triceps-extension": {
    name: "Overhead cable tri ext",
    muscles: ["Triceps"],
    tier: 3,
    equipment: "cable",
    gist: "Overhead cable triceps extension.",
    steps: [
      "Rope overhead, elbows in",
      "Lower behind your head",
      "Extend back up",
    ],
    cues: [
      "Upper arms stay still",
      "Full stretch at the bottom",
    ],
    images: 2,
  },
  // vitality: pec_deck
  "pec-deck-fly": {
    name: "Pec deck",
    muscles: ["Chest"],
    tier: 3,
    equipment: "machine",
    gist: "Machine chest fly.",
    steps: [
      "Back flat, grip handles",
      "Push together, squeeze chest",
      "Return for a stretch",
    ],
    cues: [
      "Upper arms parallel to floor",
      "Squeeze in the middle",
    ],
    images: 2,
  },
  // vitality: reverse_pec
  "reverse-pec-deck": {
    name: "Reverse pec deck",
    muscles: ["Rear delts"],
    tier: 3,
    equipment: "machine",
    gist: "Machine rear-delt fly.",
    steps: [
      "Handles at shoulder level",
      "Pull out and back",
      "Return slow",
    ],
    cues: [
      "Motion at the shoulders",
      "Slight bend in arms",
    ],
    images: 2,
  },
  // vitality: face_pull
  "rope-face-pull": {
    name: "Cable face pull",
    muscles: ["Rear delts", "Mid back"],
    tier: 3,
    equipment: "cable",
    gist: "Cable rear-delt pull.",
    steps: [
      "Face a high pulley",
      "Pull to your face, hands apart",
      "Return slow",
    ],
    cues: [
      "Upper arms parallel to floor",
      "Rope high, pull to ears. External rotation at end. High reps, light weight.",
    ],
    images: 2,
  },
  // vitality: seated_cable_row
  "seated-cable-row": {
    name: "Seated cable row",
    muscles: ["Mid back", "Lats", "Biceps"],
    tier: 2,
    equipment: "cable",
    gist: "Seated cable back row.",
    steps: [
      "Chest up, grab the handle",
      "Pull it to your stomach",
      "Return with control",
    ],
    cues: [
      "Drive your elbows back",
      "Squeeze your shoulder blades",
    ],
    images: 0,
  },
  // vitality: calf_raise
  "seated-calf-raise": {
    name: "Calf raise",
    muscles: ["Calves"],
    tier: 3,
    equipment: "machine",
    gist: "Seated machine calf builder.",
    steps: [
      "Toes on platform, pad on thighs",
      "Lower heels for a stretch",
      "Press up high",
    ],
    cues: [
      "Hold the top a second",
      "Full stretch at the bottom",
      "Full stretch at the bottom, full contraction at the top. Slow.",
    ],
    images: 2,
  },
  // vitality: seated_leg_curl
  "seated-leg-curl": {
    name: "Seated leg curl",
    muscles: ["Hamstrings"],
    tier: 3,
    equipment: "machine",
    gist: "Machine hamstring curl.",
    steps: [
      "Legs over the lever, pad on thighs",
      "Curl down by bending knees",
      "Return slow",
    ],
    cues: [
      "Keep your torso still",
      "Hold the bottom a beat",
    ],
    images: 2,
  },
  // vitality: cable_lat_raise
  "single-arm-cable-lateral-raise": {
    name: "Cable lateral raise",
    muscles: ["Side delts"],
    tier: 3,
    equipment: "cable",
    gist: "Seated cable side-delt raise.",
    steps: [
      "Sit between pulleys, cross grip",
      "Bend forward over thighs",
      "Raise arms out to sides",
    ],
    cues: [
      "Arms perpendicular to torso",
      "Fixed slight elbow bend",
      "Cable from far side, behind body. Sweep across body and up.",
    ],
    images: 2,
  },
  // vitality: pullup_weighted
  "weighted-pull-up": {
    name: "Weighted pull-ups",
    muscles: ["Lats", "Biceps", "Mid back"],
    tier: 1,
    equipment: "other",
    gist: "Weighted lat builder.",
    steps: [
      "Weight on belt, overhand grip",
      "Pull chin above the bar",
      "Lower to a full hang",
    ],
    cues: [
      "Drive blades down and back",
      "Full lat stretch at bottom",
      "Dead hang start. Drive elbows down and back. Chin clears the bar, full lockout below.",
    ],
    images: 2,
  },
};

export function getFormCard(id: string): FormCard | null {
  return FORM_CARDS[id] ?? null;
}
