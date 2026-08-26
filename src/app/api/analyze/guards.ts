import type { ViewAngle } from "@/lib/types";
import { hashesEqual, type HashesByView } from "@/lib/data-rules";

/**
 * Pure request guards for POST /api/analyze — every authorization, input and
 * throttling decision as a deterministic function of already-loaded rows, so
 * each failure class is unit-testable without auth, a database or a network.
 * The route maps each refusal 1:1 onto its HTTP response.
 */

export type GuardRefusal =
  | { kind: "unauthenticated"; status: 401; error: "unauthenticated" }
  | { kind: "unknown"; status: 404; error: "unknown_checkin" }
  | { kind: "not_owner"; status: 403; error: "not_owner" }
  | { kind: "no_photos"; status: 422; error: "no_photos" }
  | { kind: "cooldown"; status: 409; error: "cooldown"; retryAfterSeconds: number };

/** 401 unless a verified auth user exists. */
export function checkAuthenticated(userId: string | null | undefined): GuardRefusal | null {
  if (!userId) return { kind: "unauthenticated", status: 401, error: "unauthenticated" };
  return null;
}

/**
 * RLS already filtered what the caller may read: an unreadable or nonexistent
 * check-in arrives as null → 404 (indistinguishable by design). A readable
 * row that belongs to the pair partner → 403: readable, but only the owner
 * may trigger analysis.
 */
export function checkCheckinAccess(
  checkin: { user_id: string } | null,
  userId: string,
): GuardRefusal | null {
  if (checkin === null) return { kind: "unknown", status: 404, error: "unknown_checkin" };
  if (checkin.user_id !== userId) return { kind: "not_owner", status: 403, error: "not_owner" };
  return null;
}

/** 422 for a photo-less check-in — there is nothing to analyze. */
export function checkHasPhotos(
  photos: readonly { view: ViewAngle; sha256: string }[],
): GuardRefusal | null {
  if (photos.length === 0) return { kind: "no_photos", status: 422, error: "no_photos" };
  return null;
}

/** The exact version tuple an analysis row was produced under. */
export interface VersionTuple {
  model: string;
  prompt_version: string;
  rubric_version: string;
  scoring_version: string;
  target_profile_version: string;
  exercise_library_version: string;
  schema_version: string;
}

export interface CachedAnalysisFacts extends VersionTuple {
  image_hashes: HashesByView;
  created_at: string;
}

/**
 * Idempotency: the LATEST analysis for this check-in with identical
 * angle-sorted image hashes AND an identical version tuple — re-running the
 * model would reproduce it, so it is returned with { cached: true } instead.
 */
export function findCachedAnalysis<T extends CachedAnalysisFacts>(
  analyses: readonly T[],
  currentPhotoHashes: HashesByView,
  versions: VersionTuple,
): T | null {
  return (
    [...analyses]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .find(
        (a) =>
          hashesEqual(a.image_hashes, currentPhotoHashes) &&
          a.model === versions.model &&
          a.prompt_version === versions.prompt_version &&
          a.rubric_version === versions.rubric_version &&
          a.scoring_version === versions.scoring_version &&
          a.target_profile_version === versions.target_profile_version &&
          a.exercise_library_version === versions.exercise_library_version &&
          a.schema_version === versions.schema_version,
      ) ?? null
  );
}

export const ANALYSIS_COOLDOWN_MS = 60_000;

/**
 * DB-backed cooldown: refuse when ANY analysis row for this check-in was
 * inserted inside the window. The analyses table itself is the lock — an
 * in-memory map is never the only control across serverless instances.
 */
export function checkCooldown(
  analyses: readonly { created_at: string }[],
  nowMs: number,
  windowMs: number = ANALYSIS_COOLDOWN_MS,
): GuardRefusal | null {
  for (const a of analyses) {
    const age = nowMs - Date.parse(a.created_at);
    if (Number.isFinite(age) && age >= 0 && age < windowMs) {
      return {
        kind: "cooldown",
        status: 409,
        error: "cooldown",
        retryAfterSeconds: Math.max(1, Math.ceil((windowMs - age) / 1000)),
      };
    }
  }
  return null;
}
