import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { createServiceClient, serviceRoleConfigured } from "@/lib/supabase/service";
import { PHOTOS_BUCKET } from "@/lib/db-types";
import type { ViewAngle } from "@/lib/types";
import {
  VIEW_ORDER,
  ageAsOf,
  mediaTypeForPath,
  nearestWeightAsOf,
  weightLogAsOf,
  type HashesByView,
  type WeightEntry,
} from "@/lib/data-rules";
import {
  checkAuthenticated,
  checkCheckinAccess,
  checkCooldown,
  checkHasPhotos,
  findCachedAnalysis,
  type GuardRefusal,
  type VersionTuple,
} from "./guards";
import type { AnalysisResult, AnalysisVersions } from "@/lib/analysis/types";
import {
  SCHEMA_VERSION,
  narrationSchema,
  visionEvidenceSchema,
} from "@/lib/analysis/schemas";
import {
  PROMPT_VERSION,
  STAGE1_SYSTEM,
  STAGE3_SYSTEM,
  stage1UserText,
  stage3UserText,
} from "@/lib/analysis/prompts";
import {
  allowedNumbersIn,
  assembleAnalysisResult,
  assembleFailedResult,
  overallConfidence,
  type Stage2Data,
} from "@/lib/analysis/narrate";
import {
  applyQualityGate,
  buildPriorityBlocks,
  computeOverall,
  rankPriorities,
  resolveStatuses,
  usableViews,
} from "@/lib/analysis/scoring";
import {
  RUBRIC_VERSION,
  SCORING_VERSION,
  TARGET_PROFILE_VERSION,
} from "@/lib/analysis/rubric";
import { EXERCISE_LIBRARY_VERSION } from "@/lib/analysis/exercise-library";

/**
 * POST /api/analyze — { checkinId } only. The route authenticates the caller
 * via the cookie session, authorizes ownership under RLS, loads the check-in's
 * photos from the database (paths + sha256), signs short-lived URLs with the
 * server-only service client, runs the unchanged three-stage pipeline, and
 * persists the analysis server-side (the service role is the ONLY analysis
 * writer — client insert privileges were revoked by migration). The route
 * never accepts caller-supplied URLs or base64 image bytes.
 *
 * Failure classes: 401 unauthenticated / 403 not_owner / 404 unknown_checkin /
 * 409 cooldown / 422 no_photos / 500 not-configured / 502 model-invalid.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({ checkinId: z.uuid() });

/** Signed URLs live only long enough for the model to fetch the images. */
const PHOTO_SIGN_TTL_SECONDS = 300;
/** Idempotency/cooldown window scans at most this many recent analyses. */
const RECENT_ANALYSES_LIMIT = 25;

// ------------------------------------------------------------- structured call

// Temperature 0 is the required deterministic setting, but Opus 4.7+ /
// Sonnet 5 / Fable-class models reject sampling params with a 400 — omit it
// there; those models are deterministic-enough by default at this task shape.
const SAMPLING_REMOVED = /^claude-(fable-5|mythos-5|opus-5|opus-4-7|opus-4-8|sonnet-5)/;

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * One model call with strict Zod validation and exactly one retry: the retry
 * turn replays the raw response plus the validation errors. Returns null on
 * second failure or refusal — the caller must fail cleanly, never fabricate.
 */
async function callStructured<T>(
  client: Anthropic,
  schema: z.ZodType<T>,
  params: {
    model: string;
    system: string;
    maxTokens: number;
    messages: Anthropic.MessageParam[];
  },
): Promise<T | null> {
  let messages = params.messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages,
      // Structured extraction doesn't need deep deliberation, and the whole
      // pipeline must finish well inside serverless duration limits.
      output_config: { effort: "medium" },
      ...(SAMPLING_REMOVED.test(params.model) ? {} : { temperature: 0 }),
    });
    if (response.stop_reason === "refusal") return null;

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    let problem: string;
    const json = extractJson(raw);
    if (json === undefined) {
      problem = "the response was not a parseable JSON object";
    } else {
      const parsed = schema.safeParse(json);
      if (parsed.success) return parsed.data;
      problem = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    }

    messages = [
      ...messages,
      { role: "assistant", content: raw.length > 0 ? raw : "(empty)" },
      {
        role: "user",
        content: `That response failed validation — ${problem}. Return only the corrected JSON object, nothing else.`,
      },
    ];
  }
  return null;
}

// --------------------------------------------------------------------- helpers

function refusalResponse(refusal: GuardRefusal): NextResponse {
  const body: Record<string, unknown> = { error: refusal.error };
  const headers: Record<string, string> = {};
  if (refusal.kind === "cooldown") {
    body.retryAfterSeconds = refusal.retryAfterSeconds;
    headers["Retry-After"] = String(refusal.retryAfterSeconds);
  }
  return NextResponse.json(body, { status: refusal.status, headers });
}

interface PhotoFacts {
  view: ViewAngle;
  storage_path: string;
  sha256: string;
}

interface AnalysisRowFacts extends VersionTuple {
  id: string;
  status: "complete" | "limited" | "failed";
  overall: number | null;
  image_hashes: HashesByView;
  result: AnalysisResult;
  created_at: string;
}

/**
 * DB CHECK: (status='complete') = (overall is not null). A pathological
 * overall-less "complete" downgrades to "limited"; an overall never persists
 * beside any other status.
 */
function persistableResult(result: AnalysisResult): AnalysisResult {
  const status: AnalysisResult["status"] =
    result.status === "complete" && result.overall === null ? "limited" : result.status;
  const overall = status === "complete" ? result.overall : null;
  return { ...result, status, overall };
}

// Per-instance in-flight latch — a fast secondary guard against concurrent
// double-submits hitting the same warm instance. The DB-backed cooldown above
// remains the authoritative cross-instance control.
const inFlight = new Set<string>();

// ----------------------------------------------------------------------- route

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json({ error: "analysis_not_configured" }, { status: 500 });
  }
  // Fail closed: without the service role the analysis could never persist,
  // so no model call is made at all.
  if (!serviceRoleConfigured()) {
    return NextResponse.json(
      { error: "analysis_persistence_not_configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { checkinId } = parsedBody.data;

  // ---- auth: cookie-bound user client; RLS scopes every read below.
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authRefusal = checkAuthenticated(user?.id);
  if (authRefusal !== null || !user) {
    return refusalResponse(
      authRefusal ?? { kind: "unauthenticated", status: 401, error: "unauthenticated" },
    );
  }

  // ---- authorize the check-in: null under RLS → 404; partner-owned → 403.
  // subject_user_id is loaded too: the analysis CONTEXT (profile, weight, age,
  // history) resolves from the depicted subject, never the capturer.
  const { data: checkinData, error: checkinError } = await supabase
    .from("physiquemaxx_checkins")
    .select("id, user_id, subject_user_id, local_date, weight_kg")
    .eq("id", checkinId)
    .maybeSingle();
  if (checkinError) {
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }
  const checkin = checkinData as
    | {
        id: string;
        user_id: string;
        subject_user_id: string;
        local_date: string;
        weight_kg: number | null;
      }
    | null;
  const accessRefusal = checkCheckinAccess(checkin, user.id);
  if (accessRefusal !== null || checkin === null) {
    return refusalResponse(
      accessRefusal ?? { kind: "unknown", status: 404, error: "unknown_checkin" },
    );
  }

  // ---- photos come exclusively from the database — never from the caller.
  const { data: photoData, error: photoError } = await supabase
    .from("physiquemaxx_photos")
    .select("view, storage_path, sha256")
    .eq("checkin_id", checkin.id);
  if (photoError) {
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }
  const photos = ((photoData ?? []) as PhotoFacts[])
    .slice()
    .sort((a, b) => VIEW_ORDER.indexOf(a.view) - VIEW_ORDER.indexOf(b.view));
  const photosRefusal = checkHasPhotos(photos);
  if (photosRefusal) return refusalResponse(photosRefusal);

  const photoHashes: HashesByView = {};
  for (const p of photos) photoHashes[p.view] = p.sha256;

  const versions: VersionTuple = {
    model,
    prompt_version: PROMPT_VERSION,
    rubric_version: RUBRIC_VERSION,
    scoring_version: SCORING_VERSION,
    target_profile_version: TARGET_PROFILE_VERSION,
    exercise_library_version: EXERCISE_LIBRARY_VERSION,
    schema_version: SCHEMA_VERSION,
  };

  // ---- idempotency + cooldown, both from persisted rows (read under RLS).
  const { data: recentData, error: recentError } = await supabase
    .from("physiquemaxx_analyses")
    .select(
      "id, status, overall, image_hashes, model, prompt_version, rubric_version, scoring_version, target_profile_version, exercise_library_version, schema_version, result, created_at",
    )
    .eq("checkin_id", checkin.id)
    .order("created_at", { ascending: false })
    .limit(RECENT_ANALYSES_LIMIT);
  if (recentError) {
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
  }
  const recent = (recentData ?? []) as AnalysisRowFacts[];

  const cached = findCachedAnalysis(recent, photoHashes, versions);
  if (cached) {
    return NextResponse.json({ result: cached.result, cached: true });
  }
  const cooldownRefusal = checkCooldown(recent, Date.now());
  if (cooldownRefusal) return refusalResponse(cooldownRefusal);
  if (inFlight.has(checkin.id)) {
    return refusalResponse({
      kind: "cooldown",
      status: 409,
      error: "cooldown",
      retryAfterSeconds: 30,
    });
  }

  inFlight.add(checkin.id);
  try {
    // ---- condition context AS OF the check-in's date — never future data, and
    // always the SUBJECT's own profile + weight history (the depicted person),
    // never the capturer's. RLS still authorizes every read: the creator reads
    // the subject's rows as an active pair member.
    const subjectId = checkin.subject_user_id;
    const [profileRes, logRes] = await Promise.all([
      supabase
        .from("physiquemaxx_profiles")
        .select("birthdate, height_cm, gender")
        .eq("id", subjectId)
        .maybeSingle(),
      supabase
        .from("physiquemaxx_checkins")
        .select("local_date, weight_kg")
        .eq("subject_user_id", subjectId)
        .not("weight_kg", "is", null)
        .lte("local_date", checkin.local_date)
        .order("local_date", { ascending: false }),
    ]);
    const profileRow = (profileRes.data ?? null) as {
      birthdate: string | null;
      height_cm: number | null;
      gender: "male" | "female" | null;
    } | null;
    const weightEntries: WeightEntry[] = (
      (logRes.data ?? []) as { local_date: string; weight_kg: number }[]
    ).map((r) => ({ date: r.local_date, weightKg: Number(r.weight_kg) }));
    const weightLog = weightLogAsOf(weightEntries, checkin.local_date);
    const currentWeightKg =
      checkin.weight_kg !== null
        ? Number(checkin.weight_kg)
        : nearestWeightAsOf(weightEntries, checkin.local_date);

    // ---- short-lived signed URLs, minted server-side by the service client.
    const service = createServiceClient();
    const { data: signed, error: signError } = await service.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        PHOTO_SIGN_TTL_SECONDS,
      );
    if (signError) {
      return NextResponse.json({ error: "analysis_failed" }, { status: 502 });
    }
    const urlByPath = new Map<string, string>();
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
    }
    const inputs = photos.map((p) => {
      const url = urlByPath.get(p.storage_path);
      if (!url) throw new Error("signing_failed");
      return { view: p.view, url, mediaType: mediaTypeForPath(p.storage_path) };
    });

    const client = new Anthropic({ apiKey });

    // STAGE 1 — vision evidence: all photos as image blocks, strict schema.
    const content: Anthropic.ContentBlockParam[] = [];
    for (const photo of inputs) {
      content.push({ type: "text", text: `${photo.view.toUpperCase()} view photograph:` });
      content.push({ type: "image", source: { type: "url", url: photo.url } });
    }
    content.push({ type: "text", text: stage1UserText(inputs.map((p) => p.view)) });

    const vision = await callStructured(client, visionEvidenceSchema, {
      model,
      system: STAGE1_SYSTEM,
      maxTokens: 16000,
      messages: [{ role: "user", content }],
    });
    if (vision === null) {
      return NextResponse.json({ error: "invalid_model_output" }, { status: 502 });
    }

    // STAGE 2 — deterministic scoring, no model call.
    // The gate only ever considers views that were actually submitted — a
    // hallucinated quality entry for an absent view must not unlock statuses.
    const submitted = new Set(inputs.map((p) => p.view));
    const qualityGate = applyQualityGate(
      vision.quality.filter((q) => submitted.has(q.view)),
    );

    // Rubric v1.1: photos are additive context. Every usable view's evidence
    // is assessed (partial = LIMITED VIEW, no overall); only a session with
    // zero usable views fails outright.
    const available = usableViews(qualityGate);
    const muscles = resolveStatuses(vision.muscles, qualityGate.verdict, available);

    const resultVersions: AnalysisVersions = {
      model,
      prompt: PROMPT_VERSION,
      rubric: RUBRIC_VERSION,
      scoring: SCORING_VERSION,
      targetProfile: TARGET_PROFILE_VERSION,
      exerciseLibrary: EXERCISE_LIBRARY_VERSION,
      schema: SCHEMA_VERSION,
    };

    /** Persist server-side (service role — the only writer) and respond. */
    const persistAndRespond = async (result: AnalysisResult) => {
      const stored = persistableResult(result);
      const { error: insertError } = await service.from("physiquemaxx_analyses").insert({
        checkin_id: checkin.id,
        status: stored.status,
        overall: stored.overall,
        confidence: stored.confidence,
        image_hashes: photoHashes,
        model: stored.versions.model,
        prompt_version: stored.versions.prompt,
        rubric_version: stored.versions.rubric,
        scoring_version: stored.versions.scoring,
        target_profile_version: stored.versions.targetProfile,
        exercise_library_version: stored.versions.exerciseLibrary,
        schema_version: stored.versions.schema,
        // The ACTUAL stage-1 vision output, verbatim — never a placeholder.
        raw_evidence: vision,
        result: stored,
      });
      if (insertError) {
        return NextResponse.json({ error: "analysis_persist_failed" }, { status: 500 });
      }
      return NextResponse.json({ result: stored, cached: false });
    };

    // Gate failure: retake guidance only — no scores, no invented criticism.
    if (qualityGate.verdict === "fail") {
      return persistAndRespond(assembleFailedResult(qualityGate, resultVersions));
    }

    const { overall, subscores } = computeOverall(
      muscles,
      {
        proportions: vision.proportion.findings,
        asymmetries: vision.symmetry.asymmetries,
        conditioning: vision.conditioning.band,
      },
      qualityGate.verdict,
    );
    const priorities = buildPriorityBlocks(rankPriorities(muscles, available));

    const stage2: Stage2Data = {
      qualityGate,
      muscles,
      overall,
      subscores,
      confidence: overallConfidence(muscles, qualityGate.verdict),
      priorities,
    };

    // STAGE 3 — narration from structured evidence only, no images. The
    // condition context (profile facts, weight log AS OF the check-in date,
    // stage-1 body-fat estimate) rides along for the guidance sections.
    const payload = stage3UserText(stage2, {
      profile: {
        age: ageAsOf(profileRow?.birthdate ?? null, checkin.local_date),
        heightCm: profileRow?.height_cm ?? null,
        gender: profileRow?.gender ?? null,
      },
      weightLog,
      currentWeightKg,
      estBodyFat: vision.estBodyFat,
    });
    const narration = await callStructured(
      client,
      narrationSchema(allowedNumbersIn(payload)),
      {
        model,
        system: STAGE3_SYSTEM,
        maxTokens: 16000,
        messages: [{ role: "user", content: payload }],
      },
    );
    if (narration === null) {
      return NextResponse.json({ error: "invalid_model_output" }, { status: 502 });
    }

    return persistAndRespond(
      assembleAnalysisResult(stage2, narration, resultVersions, {
        estBodyFat: vision.estBodyFat,
        condition: narration.condition,
      }),
    );
  } catch (error) {
    // Never fabricate a result — clean upstream-failure JSON, no internals.
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "analysis_failed", detail: `model request failed (${error.status ?? "network"})` },
        { status: 502 },
      );
    }
    if (error instanceof Error && error.message === "analysis_persistence_not_configured") {
      return NextResponse.json(
        { error: "analysis_persistence_not_configured" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "analysis_failed", detail: "unexpected server error" },
      { status: 502 },
    );
  } finally {
    inFlight.delete(checkin.id);
  }
}
