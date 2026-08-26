import type { AnalysisStatus, ViewAngle } from "@/lib/types";
import type { CaptureKind } from "@/lib/db-types";

/**
 * Pure data rules shared by the client data layer (src/lib/data.ts), the
 * server analysis route, and the tests. No DOM, no supabase, no side effects
 * — everything here is deterministic on its inputs so the invariants
 * (front-first saves, as-of-date context, staleness, comparability, momentum,
 * failure cleanup) are unit-testable without a network.
 */

export const VIEW_ORDER: readonly ViewAngle[] = ["front", "left", "back", "right"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Structural YYYY-MM-DD check with a plausible calendar range. */
export function isValidLocalDate(date: string): boolean {
  if (!ISO_DATE.test(date)) return false;
  const [, m, d] = date.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/** Image media type implied by a storage object key's extension. */
export function mediaTypeForPath(
  storagePath: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const ext = storagePath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

// ------------------------------------------------------- as-of-date context

export interface WeightEntry {
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
}

/**
 * The weight log visible to an analysis of a check-in dated `asOf`: only
 * entries with date <= asOf, newest first. Never leaks future data into a
 * historical analysis.
 */
export function weightLogAsOf(entries: readonly WeightEntry[], asOf: string): WeightEntry[] {
  return entries
    .filter((e) => e.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Nearest logged weight at or before `asOf`; null when nothing precedes it. */
export function nearestWeightAsOf(
  entries: readonly WeightEntry[],
  asOf: string,
): number | null {
  return weightLogAsOf(entries, asOf)[0]?.weightKg ?? null;
}

/** Age on `asOf` (both YYYY-MM-DD) — never "age today" for historical rows. */
export function ageAsOf(birthdate: string | null, asOf: string): number | null {
  if (!birthdate || !isValidLocalDate(birthdate) || !isValidLocalDate(asOf)) return null;
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [ay, am, ad] = asOf.split("-").map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age--;
  return age >= 0 ? age : null;
}

// ------------------------------------------------------------ save validity

export type SaveValidation =
  | { ok: true }
  | { ok: false; code: "no_photos" | "front_required" | "invalid_date" | "future_date" };

/**
 * FRONT invariant + date rules for saveCheckIn:
 * - every save must carry at least one photo;
 * - CREATING a check-in (live or historical) requires the front angle —
 *   optional-angle-only saves are allowed only when updating a check-in that
 *   already has a front photo;
 * - an explicit (historical) date must be a valid YYYY-MM-DD and never in the
 *   future relative to the caller's local today.
 */
export function validateSaveRequest(args: {
  isNewCheckin: boolean;
  views: readonly ViewAngle[];
  /** angles already stored on the existing check-in (update case) */
  existingViews?: readonly ViewAngle[];
  /** explicit historical date, if any */
  date?: string;
  /** the caller's local today, YYYY-MM-DD */
  today: string;
}): SaveValidation {
  if (args.views.length === 0) return { ok: false, code: "no_photos" };
  if (args.date !== undefined) {
    if (!isValidLocalDate(args.date)) return { ok: false, code: "invalid_date" };
    if (args.date > args.today) return { ok: false, code: "future_date" };
  }
  const hasFront =
    args.views.includes("front") ||
    (!args.isNewCheckin && (args.existingViews ?? []).includes("front"));
  if (!hasFront) return { ok: false, code: "front_required" };
  return { ok: true };
}

// ------------------------------------------------- append-only save decisions

/**
 * Idempotency decision, keyed ONLY on submission_id. A capture session's UUID
 * is looked up first: found → resume that exact check-in row; not found →
 * create a brand-new one. History is append-only, so the local date is NEVER
 * consulted to decide insert-vs-update — a second session on the same day is a
 * new check-in, and a retry of the same session resumes rather than duplicates.
 */
export function saveModeFor(existing: { id: string } | null | undefined): "resume" | "create" {
  return existing ? "resume" : "create";
}

/**
 * The angles a save must actually upload: incoming views not already stored on
 * the (resumed) check-in, in canonical order. Append-only — a view already
 * present is left untouched (never overwritten, never storage.remove'd), so a
 * resumed session only fills the gaps and an exact replay uploads nothing.
 */
export function pendingUploadViews(
  existingViews: readonly ViewAngle[],
  incomingViews: readonly ViewAngle[],
): ViewAngle[] {
  const existing = new Set(existingViews);
  return incomingViews
    .filter((v) => !existing.has(v))
    .sort((a, b) => VIEW_ORDER.indexOf(a) - VIEW_ORDER.indexOf(b));
}

/** True when a check-in belongs to a subject's individual scope (NOT the creator's). */
export function inSubjectScope(
  row: { subjectUserId: string },
  subjectUserId: string,
): boolean {
  return row.subjectUserId === subjectUserId;
}

/**
 * Total append-only ordering key: newest local_date first, then newest
 * created_at, then id — a stable tiebreaker that keeps every distinct check-in
 * a distinct entry (no same-day merge/dedupe).
 */
export interface RecencyKey {
  date: string;
  createdAt: string;
  id: string;
}

export function compareRecencyDesc(a: RecencyKey, b: RecencyKey): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
  return b.id.localeCompare(a.id);
}

/** What a save call changes: which angles are replaced vs added, and the total after. */
export function mergePlanFor(
  existingViews: readonly ViewAngle[],
  incomingViews: readonly ViewAngle[],
): { replacedAngles: ViewAngle[]; addedAngles: ViewAngle[]; angleCountAfter: number } {
  const existing = new Set(existingViews);
  const replacedAngles = incomingViews.filter((v) => existing.has(v));
  const addedAngles = incomingViews.filter((v) => !existing.has(v));
  return {
    replacedAngles,
    addedAngles,
    angleCountAfter: existing.size + addedAngles.length,
  };
}

// -------------------------------------------------------- failure cleanup

export interface AttemptUpload {
  /** storage object key uploaded by THIS attempt */
  path: string;
  /** true once the photo row points at this object */
  committed: boolean;
}

/**
 * Compensating cleanup after a failed save attempt. Only ever touches what
 * this attempt produced:
 * - attempt created the check-in → the row goes (cascading its photo rows),
 *   so every object this attempt uploaded is deleted;
 * - attempt updated an existing check-in → only uploads whose photo row was
 *   NOT repointed are deleted; committed replacements stay consistent.
 * Pre-existing objects are never listed.
 */
export function cleanupPlanFor(args: {
  createdCheckin: boolean;
  uploads: readonly AttemptUpload[];
}): { deletePaths: string[]; deleteCheckinRow: boolean } {
  if (args.createdCheckin) {
    return { deletePaths: args.uploads.map((u) => u.path), deleteCheckinRow: true };
  }
  return {
    deletePaths: args.uploads.filter((u) => !u.committed).map((u) => u.path),
    deleteCheckinRow: false,
  };
}

// ------------------------------------------------------ staleness + status

export type HashesByView = Partial<Record<ViewAngle, string>>;

/** Canonical angle-sorted key for a view→sha256 map. */
export function sortedHashKey(hashes: HashesByView): string {
  return Object.entries(hashes)
    .filter((e): e is [string, string] => typeof e[1] === "string")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([view, sha]) => `${view}:${sha}`)
    .join("|");
}

export function hashesEqual(a: HashesByView, b: HashesByView): boolean {
  return sortedHashKey(a) === sortedHashKey(b);
}

/**
 * An analysis is stale when the check-in's CURRENT photo hashes differ from
 * the hashes that analysis saw. No analysis → not stale (it is "none").
 */
export function isStale(
  currentPhotoHashes: HashesByView,
  analysis: { image_hashes: HashesByView } | null,
): boolean {
  if (analysis === null) return false;
  return !hashesEqual(currentPhotoHashes, analysis.image_hashes);
}

export function hasAllFourViews(hashes: HashesByView): boolean {
  return VIEW_ORDER.every((v) => typeof hashes[v] === "string");
}

export interface LatestAnalysisFacts {
  status: "complete" | "limited" | "failed";
  image_hashes: HashesByView;
}

/**
 * Binding state matrix (§5) mapping for a check-in card. Persisted facts
 * only: request/transport errors ("error") are a client-runtime overlay, and
 * "analyzing" is a transient UI state — neither is derived here.
 */
export function analysisStatusFor(args: {
  archiveOnly: boolean;
  latest: LatestAnalysisFacts | null;
  currentPhotoHashes: HashesByView;
}): AnalysisStatus {
  if (args.archiveOnly) return "archive_only";
  if (args.latest === null) return "none";
  if (isStale(args.currentPhotoHashes, args.latest)) return "stale";
  if (args.latest.status === "failed") return "retake_needed";
  return args.latest.status;
}

// ------------------------------------------------------------ comparability

/** Never compare scores across incompatible major rubric versions. */
export function rubricMajor(version: string): string {
  return version.split(".")[0];
}

export interface DeltaCandidate {
  /** check-in local_date */
  date: string;
  /**
   * The depicted subject. A delta only ever compares records of the SAME
   * subject — a Rowan check-in never draws its prior from a Luke one, even
   * within the merged US timeline. Optional so pre-subject callers/tests keep
   * their meaning (undefined compares equal to undefined).
   */
  subjectUserId?: string;
  archiveOnly: boolean;
  /** checkins.comparison_attested_at */
  attestedAt: string | null;
  status: "complete" | "limited" | "failed";
  overall: number | null;
  rubricVersion: string;
  /** hashes the analysis saw */
  imageHashes: HashesByView;
  /** the check-in's current photo hashes */
  currentPhotoHashes: HashesByView;
}

/**
 * A record may participate in a delta only when it is a complete, four-view,
 * non-stale, comparison-attested, non-archive analysis. Historical, limited,
 * stale and archive-only records never silently join a comparison (§9).
 */
export function isComparable(c: DeltaCandidate): boolean {
  return (
    !c.archiveOnly &&
    c.attestedAt !== null &&
    c.status === "complete" &&
    c.overall !== null &&
    hasAllFourViews(c.imageHashes) &&
    hashesEqual(c.currentPhotoHashes, c.imageHashes)
  );
}

/**
 * Score change vs the nearest EARLIER comparable record of the same owner
 * under the same major rubric — or null, which the UI renders as
 * "NO COMPARABLE PRIOR". `candidates` may arrive in any order and may
 * include the current record itself (same-date rows are never "earlier").
 */
export function computeDelta(
  current: DeltaCandidate,
  candidates: readonly DeltaCandidate[],
): number | null {
  if (!isComparable(current) || current.overall === null) return null;
  const prior = candidates
    .filter((c) => c.date < current.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(
      (c) =>
        // Same subject only — a delta never crosses Luke↔Rowan.
        (c.subjectUserId ?? null) === (current.subjectUserId ?? null) &&
        isComparable(c) &&
        rubricMajor(c.rubricVersion) === rubricMajor(current.rubricVersion),
    );
  if (!prior || prior.overall === null) return null;
  return current.overall - prior.overall;
}

// ----------------------------------------------------------------- momentum

export interface MomentumRecord {
  /** check-in local_date */
  date: string;
  captureKind: CaptureKind;
  archiveOnly: boolean;
  hasFront: boolean;
}

/** `date` minus `days`, in YYYY-MM-DD (UTC arithmetic on date-only values). */
export function dateDaysBefore(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Momentum: live-capture check-ins WITH a front photo in the trailing
 * `windowDays` (inclusive of today). Historical imports, mixed sets,
 * archive-only rows and the partner's data never count.
 */
export function momentumFrom(
  records: readonly MomentumRecord[],
  today: string,
  windowDays = 90,
): number {
  const cutoff = dateDaysBefore(today, windowDays);
  return records.filter(
    (r) =>
      r.captureKind === "live_capture" &&
      !r.archiveOnly &&
      r.hasFront &&
      r.date > cutoff &&
      r.date <= today,
  ).length;
}
