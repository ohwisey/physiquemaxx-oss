/**
 * Pure timing math for the result-reveal choreography.
 *
 * Binding numbers from VISUAL_MOTION_AND_STATE_SPEC §7 ("Result ready"):
 * ≤700ms total — photo dims, 140ms hold, score/limited label clips in,
 * verdict rises, rows group-reveal at 35–45ms per group, and a long result
 * reveal is capped near 500ms. §8: reduced motion transitions are ≤150ms.
 *
 * All values are milliseconds. No DOM, no React — unit-testable in node.
 */

export const HOLD_MS = 140; // quiet beat before the score clips in
export const SCORE_CLIP_MS = 320; // score/limited label clip-in duration
export const GROUP_RISE_MS = 240; // each group's rise+fade duration
export const STAGGER_MS = 40; // default per-group stagger (spec band 35–45)
export const GROUP_PHASE_START_MS = 220; // groups begin as the score settles
export const SEQUENCE_CAP_MS = 700; // spec: whole sequence ≤700ms
export const LONG_LIST_CAP_MS = 500; // spec: cap a long reveal near 500ms
export const REDUCED_FADE_MS = 120; // reduced-motion single fade (spec ≤150)

/** Standard exit ease — mirrors --pm-ease-out in globals.css. */
export const PM_EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Delay budget between the first and last group start times. */
const SPAN_BUDGET_MS = SEQUENCE_CAP_MS - GROUP_PHASE_START_MS - GROUP_RISE_MS;

function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.floor(count));
}

/**
 * Per-group stagger for a reveal of `count` groups. Stays at STAGGER_MS for
 * typical result lists; compresses for long lists so the final group still
 * starts inside the sequence budget (never expands past the 35–45ms band).
 */
export function cappedStagger(count: number): number {
  const groups = normalizeCount(count);
  if (groups === 1) return STAGGER_MS;
  return Math.min(STAGGER_MS, SPAN_BUDGET_MS / (groups - 1));
}

/**
 * Absolute start delay for group `index` (0-based) in a reveal of `count`
 * groups, measured from the moment the reveal begins (the 140ms hold is
 * inside GROUP_PHASE_START_MS). `count` defaults so `groupDelay(i)` alone
 * behaves as "group i of i+1".
 */
export function groupDelay(index: number, count: number = index + 1): number {
  const groups = normalizeCount(count);
  const i = Math.min(Math.max(0, Math.floor(index)), groups - 1);
  return GROUP_PHASE_START_MS + i * cappedStagger(groups);
}

/**
 * Full sequence length for `count` groups: at least the hold + score clip,
 * at most SEQUENCE_CAP_MS. Drives onDone timing in ResultReveal.
 */
export function totalRevealMs(count: number): number {
  const groups = normalizeCount(count);
  const groupsDone = groupDelay(groups - 1, groups) + GROUP_RISE_MS;
  const scoreDone = HOLD_MS + SCORE_CLIP_MS;
  return Math.min(SEQUENCE_CAP_MS, Math.max(scoreDone, groupsDone));
}
