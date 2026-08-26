"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  ANALYSIS_SUMMARY_COLUMNS,
  PHOTOS_BUCKET,
  photoStoragePath,
  type AnalysisSummaryRow,
  type CheckinRow,
  type PhotoRow,
  type ProfileRow,
  type SourceKind,
} from "@/lib/db-types";
import type { CheckIn, Owner, Palette, Profile, ViewAngle } from "@/lib/types";
import {
  VIEW_ORDER,
  analysisStatusFor,
  cleanupPlanFor,
  compareRecencyDesc,
  computeDelta,
  dateDaysBefore,
  mergePlanFor,
  momentumFrom,
  pendingUploadViews,
  saveModeFor,
  validateSaveRequest,
  type AttemptUpload,
  type DeltaCandidate,
  type HashesByView,
} from "@/lib/data-rules";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * Typed data layer over the RLS schema. Everything runs as the signed-in
 * user through the browser client — RLS is the security boundary, photos
 * move only through short-lived signed URLs, and identity always resolves
 * from the auth session + profiles.handle (never a hard-coded ID).
 *
 * Analyses are READ-ONLY here: the server /api/analyze route (service role)
 * is the only analysis writer — client insert/update/delete on
 * physiquemaxx_analyses was revoked by migration.
 */

const SIGNED_URL_TTL_SECONDS = 3600; // 1h — photos only via short-lived URLs
/** Refresh page URLs when older than this (comfortably inside the 1h TTL). */
export const SIGNED_URL_REFRESH_AGE_MS = 50 * 60 * 1000;
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;
/** Library page size per owner scope. */
const PAGE_SIZE = 20;
const MOMENTUM_WINDOW_DAYS = 90;

/** Neutral warm-gray ambient when a check-in has no front palette yet. */
export const FALLBACK_PALETTE: Palette = {
  top: "#8a8a86",
  mid: "#5a544e",
  bottom: "#3a3632",
};

// ---------------------------------------------------------------- shapes

/** Card-sized slice of a check-in row plus its photos + latest analysis. */
interface LoadedEntry {
  row: Pick<
    CheckinRow,
    | "id"
    | "user_id"
    | "subject_user_id"
    | "pair_id"
    | "local_date"
    | "created_at"
    | "weight_kg"
    | "capture_kind"
    | "archive_only"
    | "comparison_attested_at"
  >;
  photos: Pick<PhotoRow, "view" | "storage_path" | "sha256" | "palette">[];
  latest: AnalysisSummaryRow | null;
}

export interface LibraryData {
  luke: CheckIn[];
  rowan: CheckIn[];
  /** merged timeline, newest first */
  us: CheckIn[];
  /** the signed-in member, resolved via profiles.handle */
  me: Owner;
  myProfile: Profile;
  partnerName: string | null;
  email: string | null;
  /**
   * checkin id → full AnalysisResult. Populated ON DEMAND (fetchAnalysis /
   * requestAnalysis) — the library page loads summary columns only.
   */
  analyses: Record<string, AnalysisResult>;
  /** live-capture check-ins with a front photo, me, trailing 90 days */
  momentumCount: number;
  /** whether an older page exists per owner scope */
  hasMore: Record<Owner, boolean>;
  // -- internal plumbing for loadMoreLibrary / refreshLibraryUrls ----------
  /** loaded raw entries per owner, newest first */
  entries: Record<Owner, LoadedEntry[]>;
  /** owner handle → auth user id (from profiles; never hard-coded) */
  ownerIds: Partial<Record<Owner, string>>;
  /** storage path → signed URL for every loaded photo */
  urls: Record<string, string>;
  /** epoch ms when `urls` was signed — drives visibility-change refresh */
  signedAt: number;
}

export interface SaveCheckInInput {
  files: Partial<Record<ViewAngle, File>>;
  weightKg: number | null;
  /** REQUIRED — profile id of the depicted subject (self or active pair partner) */
  subjectUserId: string;
  /** REQUIRED — per-capture-session UUID, frozen at capture start (idempotency key) */
  submissionId: string;
  /** provenance of the photos in this save */
  sourceKind: SourceKind;
  /** historical local date (YYYY-MM-DD); omitted → today's live check-in */
  date?: string;
  /** historical archive-only: kept on the timeline, never scored/compared */
  archiveOnly?: boolean;
}

export interface SaveCheckInResult {
  checkinId: string;
  /** the session UUID this save resumed or created */
  submissionId: string;
  /** true when this save created the check-in row; false when it resumed one */
  created: boolean;
  /** total angles on the check-in after this save */
  angleCount: number;
  /** always [] under the append-only model — a session never overwrites a view */
  replacedAngles: ViewAngle[];
}

// ------------------------------------------------------------------ helpers

async function requireUser(supabase: SupabaseClient): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in.");
  return data.user;
}

function isOwner(handle: string): handle is Owner {
  return handle === "luke" || handle === "rowan";
}

/** Owner's local calendar date on this device, YYYY-MM-DD. */
function todayLocalDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function signPaths(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  if (paths.length === 0) return urls;
  const { data: signed, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`Could not sign photo URLs: ${error.message}`);
  for (const entry of signed ?? []) {
    if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}

// -------------------------------------------------------------- fetchLibrary

interface CheckinPageRow {
  id: string;
  user_id: string;
  subject_user_id: string;
  pair_id: string | null;
  local_date: string;
  created_at: string;
  weight_kg: number | null;
  capture_kind: CheckinRow["capture_kind"];
  archive_only: boolean;
  comparison_attested_at: string | null;
  physiquemaxx_photos: Pick<PhotoRow, "view" | "storage_path" | "sha256" | "palette">[];
  physiquemaxx_analyses: AnalysisSummaryRow[];
}

const CHECKIN_PAGE_COLUMNS = `id, user_id, subject_user_id, pair_id, local_date, created_at, weight_kg, capture_kind, archive_only, comparison_attested_at, physiquemaxx_photos (view, storage_path, sha256, palette), physiquemaxx_analyses (${ANALYSIS_SUMMARY_COLUMNS})`;

/** Append-only paging cursor: the last loaded row's total-order key. */
interface PageCursor {
  localDate: string;
  createdAt: string;
  id: string;
}

/**
 * One SUBJECT-scoped page: newest PAGE_SIZE check-ins DEPICTING `subjectId`
 * (never "captured by" — a partner-captured check-in belongs to the subject's
 * timeline), strictly older than the cursor under the append-only total order
 * (local_date desc, created_at desc, id desc). Card fields + latest-analysis
 * summary only — never the full result jsonb. Same-day rows are distinct.
 */
async function fetchOwnerPage(
  supabase: SupabaseClient,
  subjectId: string,
  cursor: PageCursor | null,
): Promise<{ entries: LoadedEntry[]; hasMore: boolean }> {
  let query = supabase
    .from("physiquemaxx_checkins")
    .select(CHECKIN_PAGE_COLUMNS)
    .eq("subject_user_id", subjectId)
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "physiquemaxx_analyses" })
    .limit(1, { referencedTable: "physiquemaxx_analyses" })
    .limit(PAGE_SIZE);
  if (cursor) {
    // Strictly older than the cursor in (local_date, created_at, id) desc order.
    query = query.or(
      [
        `local_date.lt.${cursor.localDate}`,
        `and(local_date.eq.${cursor.localDate},created_at.lt.${cursor.createdAt})`,
        `and(local_date.eq.${cursor.localDate},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      ].join(","),
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load check-ins: ${error.message}`);
  const rows = (data ?? []) as unknown as CheckinPageRow[];
  const entries = rows.map((r): LoadedEntry => {
    const { physiquemaxx_photos: photos, physiquemaxx_analyses: analyses, ...row } = r;
    return { row, photos, latest: analyses[0] ?? null };
  });
  return { entries, hasMore: rows.length === PAGE_SIZE };
}

function photoHashesOf(entry: LoadedEntry): HashesByView {
  const hashes: HashesByView = {};
  for (const p of entry.photos) hashes[p.view] = p.sha256;
  return hashes;
}

function candidateOf(entry: LoadedEntry): DeltaCandidate {
  return {
    date: entry.row.local_date,
    subjectUserId: entry.row.subject_user_id,
    archiveOnly: entry.row.archive_only,
    attestedAt: entry.row.comparison_attested_at,
    status: entry.latest?.status ?? "limited",
    overall: entry.latest?.overall ?? null,
    rubricVersion: entry.latest?.rubric_version ?? "",
    imageHashes: entry.latest?.image_hashes ?? {},
    currentPhotoHashes: photoHashesOf(entry),
  };
}

function toCheckIn(
  entry: LoadedEntry,
  owner: Owner,
  candidates: DeltaCandidate[],
  urls: Record<string, string>,
  myUserId: string | undefined,
): CheckIn {
  const { row, photos: photoRows, latest } = entry;
  const photos: Partial<Record<ViewAngle, string>> = {};
  for (const p of photoRows) {
    const url = urls[p.storage_path];
    if (url) photos[p.view] = url;
  }
  const front = photoRows.find((p) => p.view === "front");
  const currentPhotoHashes = photoHashesOf(entry);

  // Binding state matrix: archive-only, stale (hash drift) and canonical
  // "failed" (→ retake_needed) all suppress the score; transport errors are
  // overlaid by the hook at request time, never persisted.
  const analysisStatus = analysisStatusFor({
    archiveOnly: row.archive_only,
    latest: latest ? { status: latest.status, image_hashes: latest.image_hashes } : null,
    currentPhotoHashes,
  });

  const rating = analysisStatus === "complete" ? latest?.overall ?? null : null;
  const delta =
    analysisStatus === "complete"
      ? computeDelta(candidateOf(entry), candidates)
      : null;

  return {
    id: row.id,
    owner,
    date: row.local_date,
    createdAt: row.created_at,
    photos,
    palette: front?.palette ?? FALLBACK_PALETTE,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    rating,
    delta,
    analysisStatus,
    // The signed-in user may analyze a check-in only when they created it.
    canAnalyze: myUserId !== undefined && row.user_id === myUserId,
  };
}

interface LibraryIdentity {
  me: Owner;
  myProfile: Profile;
  partnerName: string | null;
  email: string | null;
  ownerIds: Partial<Record<Owner, string>>;
}

function assembleLibrary(
  identity: LibraryIdentity,
  entries: Record<Owner, LoadedEntry[]>,
  urls: Record<string, string>,
  momentumCount: number,
  hasMore: Record<Owner, boolean>,
  analyses: Record<string, AnalysisResult>,
  signedAt: number,
): LibraryData {
  const myUserId = identity.ownerIds[identity.me];
  const mapOwner = (owner: Owner): CheckIn[] => {
    const candidates = entries[owner].map(candidateOf);
    return entries[owner].map((e) => toCheckIn(e, owner, candidates, urls, myUserId));
  };
  const luke = mapOwner("luke");
  const rowan = mapOwner("rowan");
  // US = union of both subjects' timelines, newest first, NO same-day merge:
  // every distinct check-in stays a distinct card, ordered by the append-only
  // total order (local_date desc, created_at desc, id desc).
  const us = [...luke, ...rowan].sort((a, b) =>
    compareRecencyDesc(
      { date: a.date, createdAt: a.createdAt, id: a.id },
      { date: b.date, createdAt: b.createdAt, id: b.id },
    ),
  );
  return {
    luke,
    rowan,
    us,
    ...identity,
    analyses,
    momentumCount,
    hasMore,
    entries,
    urls,
    signedAt,
  };
}

/**
 * Momentum: live-capture check-ins with a front photo DEPICTING me in the
 * trailing 90 days — historical imports, mixed sets, archive-only rows and
 * check-ins depicting the partner never count. Keyed on subject_user_id, so a
 * partner-captured check-in of me still counts toward my cadence. A cheap
 * head-count query; falls back to the loaded window when the count query fails.
 */
async function fetchMomentumCount(
  supabase: SupabaseClient,
  myId: string,
  today: string,
): Promise<number | null> {
  const cutoff = dateDaysBefore(today, MOMENTUM_WINDOW_DAYS);
  const { count, error } = await supabase
    .from("physiquemaxx_checkins")
    .select("id, physiquemaxx_photos!inner(view)", { count: "exact", head: true })
    .eq("subject_user_id", myId)
    .eq("capture_kind", "live_capture")
    .eq("archive_only", false)
    .gt("local_date", cutoff)
    .lte("local_date", today)
    .eq("physiquemaxx_photos.view", "front");
  if (error || count === null) return null;
  return count;
}

export async function fetchLibrary(): Promise<LibraryData> {
  const supabase = createClient();
  const user = await requireUser(supabase);

  const { data: profileData, error: profileError } = await supabase
    .from("physiquemaxx_profiles")
    .select("*");
  if (profileError) {
    throw new Error(`Could not load profiles: ${profileError.message}`);
  }
  const profiles = (profileData ?? []) as ProfileRow[];

  const myProfileRow = profiles.find((p) => p.id === user.id);
  if (!myProfileRow) {
    throw new Error("No PhysiqueMaxx profile exists for this account.");
  }
  if (!isOwner(myProfileRow.handle)) {
    throw new Error(`Unexpected profile handle "${myProfileRow.handle}".`);
  }
  const me: Owner = myProfileRow.handle;
  const partnerRow = profiles.find((p) => p.id !== user.id) ?? null;

  const ownerIds: Partial<Record<Owner, string>> = {};
  for (const p of profiles) {
    if (isOwner(p.handle)) ownerIds[p.handle] = p.id;
  }

  const today = todayLocalDate();
  const [lukePage, rowanPage, momentum] = await Promise.all([
    ownerIds.luke
      ? fetchOwnerPage(supabase, ownerIds.luke, null)
      : Promise.resolve({ entries: [] as LoadedEntry[], hasMore: false }),
    ownerIds.rowan
      ? fetchOwnerPage(supabase, ownerIds.rowan, null)
      : Promise.resolve({ entries: [] as LoadedEntry[], hasMore: false }),
    fetchMomentumCount(supabase, user.id, today),
  ]);

  const entries: Record<Owner, LoadedEntry[]> = {
    luke: lukePage.entries,
    rowan: rowanPage.entries,
  };

  // Batch-sign only the loaded page's photos.
  const paths = [...entries.luke, ...entries.rowan].flatMap((e) =>
    e.photos.map((p) => p.storage_path),
  );
  const urls = await signPaths(supabase, paths);

  const momentumCount =
    momentum ??
    momentumFrom(
      entries[me].map((e) => ({
        date: e.row.local_date,
        captureKind: e.row.capture_kind,
        archiveOnly: e.row.archive_only,
        hasFront: e.photos.some((p) => p.view === "front"),
      })),
      today,
      MOMENTUM_WINDOW_DAYS,
    );

  return assembleLibrary(
    {
      me,
      myProfile: {
        displayName: myProfileRow.display_name,
        birthdate: myProfileRow.birthdate,
        heightCm: myProfileRow.height_cm,
        gender: myProfileRow.gender,
      },
      partnerName: partnerRow?.display_name ?? null,
      email: user.email ?? null,
      ownerIds,
    },
    entries,
    urls,
    momentumCount,
    { luke: lukePage.hasMore, rowan: rowanPage.hasMore },
    {},
    Date.now(),
  );
}

/**
 * Next page (older check-ins) for every owner scope that still has more,
 * merged into a new LibraryData. Deltas are recomputed over the whole loaded
 * window, so a newly loaded prior can retroactively give a newer full set
 * its comparison.
 */
export async function loadMoreLibrary(data: LibraryData): Promise<LibraryData> {
  const supabase = createClient();
  await requireUser(supabase);

  const owners: Owner[] = ["luke", "rowan"];
  const nextEntries: Record<Owner, LoadedEntry[]> = { ...data.entries };
  const nextHasMore: Record<Owner, boolean> = { ...data.hasMore };
  const newPaths: string[] = [];

  await Promise.all(
    owners.map(async (owner) => {
      const ownerId = data.ownerIds[owner];
      if (!ownerId || !data.hasMore[owner]) return;
      const last = data.entries[owner][data.entries[owner].length - 1];
      const cursor: PageCursor | null = last
        ? { localDate: last.row.local_date, createdAt: last.row.created_at, id: last.row.id }
        : null;
      const page = await fetchOwnerPage(supabase, ownerId, cursor);
      nextEntries[owner] = [...data.entries[owner], ...page.entries];
      nextHasMore[owner] = page.hasMore;
      newPaths.push(...page.entries.flatMap((e) => e.photos.map((p) => p.storage_path)));
    }),
  );

  const newUrls = await signPaths(supabase, newPaths);
  const urls = { ...data.urls, ...newUrls };

  return assembleLibrary(
    {
      me: data.me,
      myProfile: data.myProfile,
      partnerName: data.partnerName,
      email: data.email,
      ownerIds: data.ownerIds,
    },
    nextEntries,
    urls,
    data.momentumCount,
    nextHasMore,
    data.analyses,
    data.signedAt,
  );
}

/** Re-sign every loaded photo path (visibility refresh / image-error retry). */
export async function refreshLibraryUrls(data: LibraryData): Promise<LibraryData> {
  const supabase = createClient();
  await requireUser(supabase);
  const paths = [...data.entries.luke, ...data.entries.rowan].flatMap((e) =>
    e.photos.map((p) => p.storage_path),
  );
  const urls = await signPaths(supabase, paths);
  return assembleLibrary(
    {
      me: data.me,
      myProfile: data.myProfile,
      partnerName: data.partnerName,
      email: data.email,
      ownerIds: data.ownerIds,
    },
    data.entries,
    urls,
    data.momentumCount,
    data.hasMore,
    data.analyses,
    Date.now(),
  );
}

// ------------------------------------------------------------ fetchAnalysis

/**
 * Full latest AnalysisResult for one check-in, loaded on demand (the library
 * page carries summaries only). Readable for own and partner rows under RLS.
 */
export async function fetchAnalysis(checkinId: string): Promise<AnalysisResult | null> {
  const supabase = createClient();
  await requireUser(supabase);
  const { data, error } = await supabase
    .from("physiquemaxx_analyses")
    .select("result")
    .eq("checkin_id", checkinId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the analysis: ${error.message}`);
  return (data as { result: AnalysisResult } | null)?.result ?? null;
}

// -------------------------------------------------------------- saveCheckIn

/**
 * Save a check-in — APPEND-ONLY.
 *
 * Every image is processed locally FIRST: decoded and re-encoded through a
 * canvas to JPEG (max edge 1600px, q≈0.82). The canvas re-encode is
 * unconditional, which strips ALL metadata — EXIF, GPS, serial numbers —
 * because canvases only carry pixels; original camera bytes never upload.
 *
 * Identity: the auth user is the CREATOR; `subjectUserId` is who the photos
 * depict (self or an active pair partner). `submissionId` is the per-capture
 * session UUID and the SOLE idempotency key — a known session RESUMES its own
 * check-in (attaching only missing angles), an unknown session becomes a NEW
 * check-in. The local date is NEVER used to decide insert-vs-update, so a second
 * session on the same day is a distinct check-in and a prior session's photos
 * are never overwritten or removed.
 *
 * Storage keys are creator-owned {creator}/{checkinId}/{view}.jpg, upserted
 * with upsert:false — a fresh object per angle, never in-place. A failed attempt
 * cleans up only what IT uploaded, and deletes the check-in row only if this
 * attempt created it; it never touches another submission's row or objects.
 */
export async function saveCheckIn(input: SaveCheckInInput): Promise<SaveCheckInResult> {
  const supabase = createClient();
  const user = await requireUser(supabase); // the CREATOR (capturer)
  const today = todayLocalDate();
  const localDate = input.date ?? today;

  const { subjectUserId, submissionId } = input;
  if (!subjectUserId) throw new Error("A capture subject is required.");
  if (!submissionId) throw new Error("A capture session id is required.");

  const entries = (Object.entries(input.files) as [ViewAngle, File | undefined][])
    .filter((e): e is [ViewAngle, File] => e[1] !== undefined)
    .sort((a, b) => VIEW_ORDER.indexOf(a[0]) - VIEW_ORDER.indexOf(b[0]));
  const views = entries.map(([view]) => view);

  // My active pair — RLS only ever returns pairs I'm an active member of.
  const { data: pairRows, error: pairError } = await supabase
    .from("physiquemaxx_pairs")
    .select("id")
    .eq("active", true)
    .limit(1);
  if (pairError) {
    throw new Error(`Could not resolve the pair: ${pairError.message}`);
  }
  const pairId: string | null = (pairRows?.[0] as { id: string } | undefined)?.id ?? null;

  // Client guard for a clear error; server RLS is the real gate. A subject other
  // than the creator must be an active member of the creator's active pair.
  if (subjectUserId !== user.id) {
    if (!pairId) {
      throw new Error("You have no active pair, so you can only capture yourself.");
    }
    const { data: memberRows, error: memberError } = await supabase
      .from("physiquemaxx_pair_members")
      .select("user_id")
      .eq("pair_id", pairId)
      .eq("user_id", subjectUserId)
      .eq("active", true)
      .limit(1);
    if (memberError) {
      throw new Error(`Could not verify the subject: ${memberError.message}`);
    }
    if (!memberRows || memberRows.length === 0) {
      throw new Error("That subject is not an active member of your pair.");
    }
  }

  // Idempotency FIRST, keyed ONLY on submission_id: a known session resumes its
  // own check-in; an unknown one becomes a new row. Never queried by date.
  const { data: existingData, error: existingError } = await supabase
    .from("physiquemaxx_checkins")
    .select("id, physiquemaxx_photos (id, view, storage_path)")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (existingError) {
    throw new Error(`Could not load the check-in: ${existingError.message}`);
  }
  const existing = existingData as
    | { id: string; physiquemaxx_photos: Pick<PhotoRow, "id" | "view" | "storage_path">[] }
    | null;
  const existingPhotos = existing?.physiquemaxx_photos ?? [];
  const existingViews = existingPhotos.map((p) => p.view);
  const created = saveModeFor(existing) === "create";

  // FRONT invariant + date rules (pure, tested in data-rules.test.ts).
  const validation = validateSaveRequest({
    isNewCheckin: created,
    views,
    existingViews,
    date: input.date,
    today,
  });
  if (!validation.ok) {
    const messages: Record<typeof validation.code, string> = {
      no_photos: "Nothing to save — add at least one photo.",
      front_required: "A front photo is required to start a check-in.",
      invalid_date: "That date is not a valid YYYY-MM-DD day.",
      future_date: "Check-ins cannot be dated in the future.",
    };
    throw new Error(messages[validation.code]);
  }

  // Append-only: upload only the angles this check-in does not already carry.
  const uploadViews = pendingUploadViews(existingViews, views);
  const toUpload = entries.filter(([view]) => uploadViews.includes(view));

  // Process + validate every image we WILL upload before any insert/upload —
  // an undecodable photo fails the save before it touches the DB or storage.
  const processed: ProcessedPhoto[] = [];
  for (const [, file] of toUpload) processed.push(await processPhoto(file));

  // Resolve (resume) or create the check-in row. A client-generated id is fine —
  // the insert policy checks user_id + subject, never the id.
  let checkinId: string;
  if (existing) {
    checkinId = existing.id;
  } else {
    checkinId = crypto.randomUUID();
    const { error } = await supabase.from("physiquemaxx_checkins").insert({
      id: checkinId,
      user_id: user.id,
      subject_user_id: subjectUserId,
      pair_id: pairId,
      submission_id: submissionId,
      local_date: localDate,
      weight_kg: input.weightKg,
      archive_only: input.archiveOnly ?? false,
    });
    if (error) throw new Error(`Could not create the check-in: ${error.message}`);
  }

  // Upload → insert photo row per NEW angle, tracking exactly what THIS attempt
  // produced so failure cleanup never touches anything else.
  const uploads: AttemptUpload[] = [];
  try {
    for (let i = 0; i < toUpload.length; i++) {
      const [view] = toUpload[i];
      const photo = processed[i];
      const path = photoStoragePath(user.id, checkinId, view, "jpg");

      const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(path, photo.blob, { upsert: false, contentType: "image/jpeg" });
      if (uploadError) {
        throw new Error(`Photo upload failed (${view}): ${uploadError.message}`);
      }
      const upload: AttemptUpload = { path, committed: false };
      uploads.push(upload);

      // Idempotent per (checkin_id, view): a concurrent resume that already
      // wrote this angle is a no-op, never a duplicate row.
      const { error: rowError } = await supabase.from("physiquemaxx_photos").upsert(
        {
          checkin_id: checkinId,
          view,
          storage_path: path,
          sha256: photo.sha256,
          width: photo.width,
          height: photo.height,
          palette: photo.palette,
          source_kind: input.sourceKind,
        },
        { onConflict: "checkin_id,view", ignoreDuplicates: true },
      );
      if (rowError) {
        throw new Error(`Could not save the ${view} photo: ${rowError.message}`);
      }
      upload.committed = true;
    }
  } catch (error) {
    // Compensating cleanup — ONLY this attempt's uploads, and the check-in row
    // only if this attempt created it (cascading its photo rows). A resumed
    // session never deletes a prior submission's row or objects.
    const plan = cleanupPlanFor({ createdCheckin: created, uploads });
    if (plan.deletePaths.length > 0) {
      await supabase.storage
        .from(PHOTOS_BUCKET)
        .remove(plan.deletePaths)
        .catch(() => undefined);
    }
    if (plan.deleteCheckinRow) {
      await supabase
        .from("physiquemaxx_checkins")
        .delete()
        .eq("id", checkinId)
        .then(undefined, () => undefined);
    }
    throw error;
  }

  const plan = mergePlanFor(existingViews, views);
  return {
    checkinId,
    submissionId,
    created,
    angleCount: plan.angleCountAfter,
    replacedAngles: [],
  };
}

// -------------------------------------------------- client-side photo prep

interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
  palette: Palette;
  sha256: string;
}

/**
 * Unconditional canvas re-encode: decode → draw → export as JPEG. The
 * exported blob contains pixels only — EXIF/GPS/maker metadata from the
 * original file is stripped by construction, never uploaded.
 */
async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const decoded = await decodeImage(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const blob = await canvasToJpeg(canvas);
    const palette = computePalette(canvas);
    const sha256 = await sha256Hex(await blob.arrayBuffer());
    return { blob, width, height, palette, sha256 };
  } finally {
    decoded.release();
  }
}

async function decodeImage(file: File): Promise<{
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Some engines can't bitmap-decode every camera format — fall through.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode the photo."));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("JPEG encoding failed.")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Ambient palette: the photo squeezed onto a 2×3 canvas; each row's pixel
 * pair averaged into one hex — top, mid, bottom.
 */
function computePalette(sourceCanvas: HTMLCanvasElement): Palette {
  const tiny = document.createElement("canvas");
  tiny.width = 2;
  tiny.height = 3;
  const ctx = tiny.getContext("2d", { willReadFrequently: true });
  if (!ctx) return FALLBACK_PALETTE;
  ctx.drawImage(sourceCanvas, 0, 0, 2, 3);
  const { data } = ctx.getImageData(0, 0, 2, 3);
  const rowHex = (row: number): string => {
    const a = row * 2 * 4;
    const b = a + 4;
    const channel = (offset: number) =>
      Math.round((data[a + offset] + data[b + offset]) / 2);
    return `#${[channel(0), channel(1), channel(2)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")}`;
  };
  return { top: rowHex(0), mid: rowHex(1), bottom: rowHex(2) };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// -------------------------------------------------------------- saveProfile

export async function saveProfile(p: Profile): Promise<void> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  const { error } = await supabase
    .from("physiquemaxx_profiles")
    .update({
      display_name: p.displayName,
      birthdate: p.birthdate,
      height_cm: p.heightCm === null ? null : Math.round(p.heightCm),
      gender: p.gender,
    })
    .eq("id", user.id);
  if (error) throw new Error(`Could not save the profile: ${error.message}`);
}

// ---------------------------------------------------------- requestAnalysis

export type AnalysisErrorCode =
  | "unauthenticated"
  | "not_owner"
  | "unknown_checkin"
  | "cooldown"
  | "no_photos"
  | "not_configured"
  | "model_invalid"
  | "transport"
  | "server";

/** Typed failure — the hook maps codes onto the §5 state matrix. */
export class AnalysisRequestError extends Error {
  readonly code: AnalysisErrorCode;
  readonly retryAfterSeconds: number | null;
  constructor(code: AnalysisErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "AnalysisRequestError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

export interface RequestAnalysisResult {
  result: AnalysisResult;
  /** true → identical hashes + versions already analyzed; no model call ran */
  cached: boolean;
}

const ERROR_BY_CODE: Record<string, { code: AnalysisErrorCode; message: string }> = {
  unauthenticated: { code: "unauthenticated", message: "You are signed out — sign in again." },
  not_owner: { code: "not_owner", message: "Only your own check-ins can be analyzed." },
  unknown_checkin: { code: "unknown_checkin", message: "That check-in no longer exists." },
  cooldown: { code: "cooldown", message: "An analysis just ran — wait a minute and retry." },
  no_photos: { code: "no_photos", message: "This check-in has no photos to analyze." },
  analysis_not_configured: {
    code: "not_configured",
    message: "Analysis is not configured on the server yet.",
  },
  analysis_persistence_not_configured: {
    code: "not_configured",
    message: "Analysis persistence is not configured on the server yet.",
  },
  invalid_model_output: {
    code: "model_invalid",
    message: "The model returned an invalid result — nothing was saved. Retry.",
  },
  analysis_failed: {
    code: "model_invalid",
    message: "The analysis request failed upstream — nothing was saved. Retry.",
  },
  analysis_persist_failed: {
    code: "server",
    message: "The analysis could not be saved — retry in a moment.",
  },
};

// In-flight dedupe: concurrent requests for the same check-in share one
// promise — a double-tap can never fire two model calls from this tab.
const analysisInFlight = new Map<string, Promise<RequestAnalysisResult>>();

/**
 * Ask the server to analyze a check-in. The client sends { checkinId } ONLY —
 * the server authenticates, authorizes ownership, loads photos from the DB,
 * runs the pipeline and persists the result (service role). No image bytes,
 * URLs or context ever come from the browser.
 */
export function requestAnalysis(checkinId: string): Promise<RequestAnalysisResult> {
  const inFlight = analysisInFlight.get(checkinId);
  if (inFlight) return inFlight;
  const request = performAnalysisRequest(checkinId).finally(() => {
    analysisInFlight.delete(checkinId);
  });
  analysisInFlight.set(checkinId, request);
  return request;
}

async function performAnalysisRequest(checkinId: string): Promise<RequestAnalysisResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkinId }),
    });
  } catch {
    throw new AnalysisRequestError(
      "transport",
      "Network error — the analysis request never reached the server.",
    );
  }
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorCode =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "";
    const known = ERROR_BY_CODE[errorCode];
    const retryAfter =
      payload && typeof payload === "object" && "retryAfterSeconds" in payload
        ? Number((payload as { retryAfterSeconds: unknown }).retryAfterSeconds)
        : undefined;
    if (known) {
      throw new AnalysisRequestError(
        known.code,
        known.message,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    throw new AnalysisRequestError("server", `Analysis failed (http_${response.status}).`);
  }

  const body = payload as { result?: AnalysisResult; cached?: boolean } | null;
  if (!body || !body.result || typeof body.cached !== "boolean") {
    throw new AnalysisRequestError("server", "The server returned an unexpected response.");
  }
  return { result: body.result, cached: body.cached };
}

// -------------------------------------------------------------------- auth

export async function signOut(): Promise<void> {
  const { error } = await createClient().auth.signOut();
  if (error) throw new Error(`Sign out failed: ${error.message}`);
}
