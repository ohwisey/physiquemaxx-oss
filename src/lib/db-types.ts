import type { Palette, ViewAngle } from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * Hand-written Row shapes for the six physiquemaxx_* tables — the exact
 * column set of supabase/migrations/20260824000001_physiquemaxx.sql.
 * Timestamps arrive as ISO strings from supabase-js; dates as "YYYY-MM-DD".
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface ProfileRow {
  /** = auth.users.id */
  id: string;
  display_name: string;
  /** lowercase [a-z0-9_], unique — never hard-coded anywhere */
  handle: string;
  /** optional condition-guidance facts — "YYYY-MM-DD" */
  birthdate: string | null;
  height_cm: number | null;
  gender: "male" | "female" | null;
  created_at: string;
}

export interface PairRow {
  id: string;
  active: boolean;
  created_at: string;
}

export interface PairMemberRow {
  pair_id: string;
  user_id: string;
  active: boolean;
  created_at: string;
}

/** Photo provenance, declared by the client at upload time. */
export type SourceKind = "live_capture" | "historical_import";
/** Check-in rollup of its photos' provenance — trigger-maintained, never client-written. */
export type CaptureKind = "live_capture" | "historical_import" | "mixed";

export interface CheckinRow {
  id: string;
  /** the CREATOR (capturer) = auth.uid() at insert; immutable */
  user_id: string;
  /**
   * WHO the photos depict. Equals user_id for a self-capture; the partner's id
   * when the creator captured them. Analysis context (profile/weight/age/
   * history) resolves from this id, never the capturer. Immutable after insert.
   */
  subject_user_id: string;
  /**
   * Client-generated per-capture-session UUID, frozen at capture start. The
   * save idempotency key — a new session is a new check-in; a retry with the
   * same id resumes the same row. UNIQUE; immutable after insert.
   */
  submission_id: string;
  /** set → readable by active pair members; null → owner-only */
  pair_id: string | null;
  /** owner's local calendar date. No per-day uniqueness — history is append-only */
  local_date: string;
  /** optional same-day body weight in kg */
  weight_kg: number | null;
  /** server-maintained from the photos' source_kind (DB trigger) */
  capture_kind: CaptureKind;
  /** historical archive-only: never scored, never in deltas or momentum */
  archive_only: boolean;
  /** owner attested the photos are standardized enough to compare; null → never in a delta */
  comparison_attested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoRow {
  id: string;
  checkin_id: string;
  /** UNIQUE (checkin_id, view) — re-capturing an angle updates this row */
  view: ViewAngle;
  /** object key in the private bucket: {user_id}/{checkin_id}/{view}.{ext} */
  storage_path: string;
  /** input image hash, persisted for analysis versioning */
  sha256: string;
  width: number | null;
  height: number | null;
  /** precomputed ambient palette for the deck background */
  palette: Palette | null;
  /** provenance declared at upload: live capture vs historical import */
  source_kind: SourceKind;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRow {
  id: string;
  checkin_id: string;
  status: AnalysisResult["status"];
  /** deterministic score; non-null exactly when status === "complete" */
  overall: number | null;
  confidence: AnalysisResult["confidence"];
  /** view → sha256 of the exact inputs this analysis saw */
  image_hashes: Partial<Record<ViewAngle, string>>;
  model: string;
  prompt_version: string;
  rubric_version: string;
  scoring_version: string;
  target_profile_version: string;
  exercise_library_version: string;
  schema_version: string;
  /** raw stage-1 vision evidence, kept verbatim */
  raw_evidence: Json;
  /** full AnalysisResult after deterministic scoring */
  result: AnalysisResult;
  created_at: string;
}

/**
 * Card-sized slice of an analyses row — everything the library list needs
 * (status, score, staleness + comparability inputs) WITHOUT the heavy
 * `result`/`raw_evidence` jsonb. Full results load on demand per check-in.
 */
export type AnalysisSummaryRow = Pick<
  AnalysisRow,
  | "id"
  | "checkin_id"
  | "status"
  | "overall"
  | "confidence"
  | "image_hashes"
  | "rubric_version"
  | "created_at"
>;

/** Column list matching {@link AnalysisSummaryRow} for supabase selects. */
export const ANALYSIS_SUMMARY_COLUMNS =
  "id, checkin_id, status, overall, confidence, image_hashes, rubric_version, created_at";

/** Table name → Row, for typed supabase-js query helpers. */
export interface PhysiquemaxxTables {
  physiquemaxx_profiles: ProfileRow;
  physiquemaxx_pairs: PairRow;
  physiquemaxx_pair_members: PairMemberRow;
  physiquemaxx_checkins: CheckinRow;
  physiquemaxx_photos: PhotoRow;
  physiquemaxx_analyses: AnalysisRow;
}

/** Private bucket — signed-URL access only, never public. */
export const PHOTOS_BUCKET = "physiquemaxx-photos";

/** Canonical object path; storage RLS keys on the leading user_id segment. */
export function photoStoragePath(
  userId: string,
  checkinId: string,
  view: ViewAngle,
  ext: string,
): string {
  return `${userId}/${checkinId}/${view}.${ext}`;
}

/**
 * Versioned object path — replacement uploads go to a NEW key (upload-new →
 * repoint row → delete-old), never an in-place overwrite of a fixed key.
 */
export function photoStoragePathVersioned(
  userId: string,
  checkinId: string,
  view: ViewAngle,
  version: number,
  ext: string,
): string {
  return `${userId}/${checkinId}/${view}.v${version}.${ext}`;
}

/**
 * Version number of an object key: `.../front.v3.jpg` → 3; the original
 * unversioned `.../front.jpg` shape → 0; unrecognizable → 0.
 */
export function photoPathVersion(storagePath: string): number {
  const match = /\.v(\d{1,6})\.[A-Za-z0-9]+$/.exec(storagePath);
  return match ? Number(match[1]) : 0;
}
