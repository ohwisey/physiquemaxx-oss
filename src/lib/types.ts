export type Owner = "luke" | "rowan";
export type ViewAngle = "front" | "left" | "back" | "right";
export type Scope = "luke" | "rowan" | "us";
export type Gender = "male" | "female";

export interface Palette {
  top: string;
  mid: string;
  bottom: string;
}

export interface CheckIn {
  id: string;
  /** The SUBJECT depicted by this check-in (luke/rowan) — not necessarily the capturer */
  owner: Owner;
  /** Local date, YYYY-MM-DD */
  date: string;
  /** Row creation instant (ISO) — the append-only tiebreaker after `date` */
  createdAt: string;
  photos: Partial<Record<ViewAngle, string>>;
  palette: Palette;
  /** Body weight logged with this check-in (kg) — an analysis factor */
  weightKg: number | null;
  /** Overall physique rating 0–100, null when not yet analyzed or limited view */
  rating: number | null;
  /** Change vs the most recent comparable previous assessment */
  delta: number | null;
  analysisStatus: AnalysisStatus;
  /** The signed-in user is this check-in's CREATOR, so may trigger its analysis */
  canAnalyze: boolean;
}

/**
 * UI analysis state per the binding state matrix (§5):
 * - complete/limited: canonical persisted result statuses
 * - stale: current photo hashes differ from the latest analysis (score suppressed)
 * - retake_needed: canonical result status "failed" (zero usable views)
 * - error: request/transport/persistence failure — distinct from retake_needed
 * - archive_only: historical archive-only check-in (never scored/compared)
 * - none: no analysis yet
 */
export type AnalysisStatus =
  | "complete"
  | "limited"
  | "stale"
  | "retake_needed"
  | "error"
  | "archive_only"
  | "none";

/** Profile facts used by the analysis (settings sheet) */
export interface Profile {
  displayName: string;
  birthdate: string | null; // YYYY-MM-DD
  heightCm: number | null;
  gender: Gender | null;
}

export function angleCount(c: CheckIn): number {
  return Object.keys(c.photos).length;
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** "2026-08-24" → "24 AUG" */
export function mastheadDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function ageFrom(birthdate: string | null, today = new Date()): number | null {
  if (!birthdate) return null;
  const [y, m, d] = birthdate.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}
