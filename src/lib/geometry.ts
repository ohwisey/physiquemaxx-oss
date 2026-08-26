/**
 * Deck geometry — the continuous position function for the layered stack.
 *
 * Every mounted card derives its transform from a single float:
 *   rel = cardIndex - virtualIndex
 * where virtualIndex animates between integers on commit. Anchors (from
 * MASTER_PROMPT.md / MOTION_SPEC §2, transform-origin: center top):
 *
 *   rel -1 : exited below viewport, scale 0.90 (observed exit shrink)
 *   rel  0 : y 42,  scale 1.00   (current)
 *   rel  1 : y 20,  scale 0.93   (next / older)
 *   rel  2 : y  0,  scale 0.83   (next+2)
 *   rel  3 : y -14, scale 0.75, opacity 0 (hidden next+3)
 */

export const CARD_ASPECT = 0.624; // width / height
export const CARD_RADIUS = 28;

/** Rubber-band: full-rate travel until `limit`, diminishing returns beyond. */
export function rubberBand(d: number, limit: number, factor = 0.35): number {
  const abs = Math.abs(d);
  if (abs <= limit) return d;
  return Math.sign(d) * (limit + (abs - limit) * factor);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export interface CardPose {
  y: number;
  scale: number;
  opacity: number;
  /** 0..1 darkness of the black depth overlay */
  dark: number;
  z: number;
}

/**
 * Continuous pose for a card at relative position `rel`.
 * `exitY` is the y at which a card has fully left the viewport (rel = -1).
 *
 * Segment [1, 0] → [0, -1] is linear in y so that during a drag the active
 * card tracks the finger 1:1 (virtualIndex = active + dragPx / (exitY - 42)).
 * The incoming card's scale is eased ahead of its y (observed: the incoming
 * card reaches ~95% size within the first ~40% of the transition).
 */
export function cardPose(rel: number, exitY: number): CardPose {
  let y: number;
  let scale: number;
  let opacity = 1;
  let dark = 0;

  if (rel <= -1) {
    y = exitY;
    scale = 0.9;
  } else if (rel < 0) {
    // exiting / previous rising: t = 1 at current slot, 0 fully exited
    const t = rel + 1;
    y = lerp(exitY, 42, t);
    scale = lerp(0.9, 1, t);
  } else if (rel < 1) {
    // next → current promotion
    y = lerp(42, 20, rel);
    // ease scale ahead: at 60% of the way promoted (rel 0.4) be at ~95%
    const promo = 1 - rel; // 0 at rest slot, 1 fully promoted
    const eased = 1 - Math.pow(1 - promo, 1.6);
    scale = lerp(0.93, 1, eased);
    dark = lerp(0, 0.22, rel);
  } else if (rel < 2) {
    y = lerp(20, 0, rel - 1);
    scale = lerp(0.93, 0.83, rel - 1);
    dark = lerp(0.22, 0.38, rel - 1);
  } else if (rel < 3) {
    y = lerp(0, -14, rel - 2);
    scale = lerp(0.83, 0.75, rel - 2);
    opacity = lerp(1, 0, rel - 2);
    dark = lerp(0.38, 0.46, rel - 2);
  } else {
    y = -14;
    scale = 0.75;
    opacity = 0;
    dark = 0.46;
  }

  const z = clamp(Math.round(50 - rel * 10), 4, 64);
  return { y, scale, opacity, dark, z };
}

/** Gesture thresholds (MOTION_SPEC §1) */
export const COMMIT_DISTANCE = 72;
export const COMMIT_VELOCITY = 720;
export const COMMIT_MIN_TRAVEL = 18;
export const RUBBER_LIMIT = 160;
export const WHIP_DURATION = 0.72;
export const WHIP_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const CANCEL_DURATION = 0.32;
export const AMBIENT_TRIGGER = 0.3;
