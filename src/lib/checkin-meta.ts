import { angleCount, type CheckIn, type ViewAngle } from "@/lib/types";

/**
 * Check-in provenance + binding state matrix (§5) helpers.
 *
 * The data layer is landing `captureKind` / `archiveOnly` on CheckIn and an
 * options bag + result on saveCheckIn. Until those fields exist in types.ts,
 * everything here narrows gracefully so the UI compiles and behaves correctly
 * against both the old and the new contract.
 */

export type CaptureKind = "live_capture" | "historical_import" | "mixed";

export interface SaveCheckInOptions {
  /**
   * REQUIRED. Profile id of the depicted subject, frozen when the capture
   * session begins (the current scope's owner: self or the pair partner).
   */
  subjectUserId: string;
  /**
   * REQUIRED. Per-capture-session UUID (crypto.randomUUID()), frozen at capture
   * start and reused across retries; a new capture session mints a new one. The
   * append-only idempotency key.
   */
  submissionId: string;
  /** Local date YYYY-MM-DD; defaults to today on the data layer */
  date?: string;
  /** Preserved, never scored or compared */
  archiveOnly?: boolean;
  sourceKind?: "live_capture" | "historical_import";
}

export interface SaveCheckInResult {
  checkinId: string;
  /** Echoes the session UUID this save resumed or created */
  submissionId: string;
  /** true when this save created the check-in row; false when it resumed one */
  created: boolean;
  angleCount: number;
  /** Always empty under the append-only model (a session never overwrites a view) */
  replacedAngles: ViewAngle[];
}

/**
 * The save signature the shell codes against (landing in use-library). Options
 * are REQUIRED now — every save must name its subject and session.
 */
export type SaveCheckInFn = (
  files: Partial<Record<ViewAngle, File>>,
  weightKg: number | null,
  opts: SaveCheckInOptions,
) => Promise<SaveCheckInResult | void>;

export function captureKindOf(item: CheckIn): CaptureKind | null {
  const kind = (item as { captureKind?: CaptureKind }).captureKind;
  return kind ?? null;
}

/** True when any part of the record came from a historical import. */
export function isHistorical(item: CheckIn): boolean {
  const kind = captureKindOf(item);
  return kind === "historical_import" || kind === "mixed";
}

export function isArchiveOnly(item: CheckIn): boolean {
  return (
    (item as { archiveOnly?: boolean }).archiveOnly === true ||
    item.analysisStatus === "archive_only"
  );
}

/**
 * An overall score may be shown ONLY for a complete, current, non-archive
 * analysis (§5: never beside LIMITED VIEW, 1–3 angles, stale or archive-only).
 */
export function scoreVisible(item: CheckIn, analyzing = false): boolean {
  return (
    !analyzing &&
    !isArchiveOnly(item) &&
    item.analysisStatus === "complete" &&
    item.rating !== null
  );
}

/**
 * Card/list state label per the binding matrix. Returns null when the score
 * (with optional delta) is the honest thing to show instead.
 */
export function stateLabel(item: CheckIn, analyzing = false): string | null {
  if (analyzing) return "ANALYZING";
  if (isArchiveOnly(item)) return "HISTORICAL · ARCHIVE ONLY";
  switch (item.analysisStatus) {
    case "complete":
      return item.rating !== null ? null : "NOT ANALYZED";
    case "limited":
      return "LIMITED VIEW";
    case "stale":
      return "ANALYSIS OUTDATED";
    case "retake_needed":
      return "RETAKE NEEDED";
    case "error":
      return "ANALYSIS ERROR";
    case "archive_only":
      return "HISTORICAL · ARCHIVE ONLY";
    case "none": {
      const n = angleCount(item);
      return `${n} ${n === 1 ? "ANGLE" : "ANGLES"} · NOT ANALYZED`;
    }
  }
}

/** Semantic color for a state label (text color, never a background wash). */
export function stateColor(label: string): string {
  switch (label) {
    case "LIMITED VIEW":
    case "ANALYSIS OUTDATED":
      return "var(--color-limited)";
    case "RETAKE NEEDED":
    case "ANALYSIS ERROR":
      return "var(--color-priority)";
    case "HISTORICAL · ARCHIVE ONLY":
      return "var(--color-text-muted)";
    case "ANALYZING":
      return "var(--color-text)";
    default:
      return "rgba(244, 241, 234, 0.85)";
  }
}

/** Local date → YYYY-MM-DD (device timezone, same convention as the data layer). */
export function localISODate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
