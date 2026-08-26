"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { angleCount, mastheadDate, type CheckIn, type ViewAngle } from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis/types";
import { MUSCLE_LABEL } from "@/lib/analysis/types";
import { isArchiveOnly, scoreVisible, stateLabel } from "@/lib/checkin-meta";
import { RatingGlyph } from "./RatingGlyph";
import { AnalysisProgressOverlay } from "./AnalysisProgressOverlay";

const ANGLES: ViewAngle[] = ["front", "left", "back", "right"];
const INK = "var(--color-paper-ink)";
const HAIRLINE = "rgba(21, 23, 19, 0.12)";

// Semantic state colors re-tuned for the warm paper surface (the dark-canvas
// tokens in stateColor() have no contrast on --color-paper).
function paperStateColor(label: string | null): string {
  switch (label) {
    case "LIMITED VIEW":
    case "ANALYSIS OUTDATED":
      return "#7a5a12";
    case "RETAKE NEEDED":
    case "ANALYSIS ERROR":
      return "#b3261e";
    case "HISTORICAL · ARCHIVE ONLY":
      return "#5c5f5a";
    default:
      return INK;
  }
}

function stateDescription(item: CheckIn, analyzing: boolean): string | null {
  if (analyzing) return "Analyzing…";
  if (isArchiveOnly(item)) return "Not scored.";
  switch (item.analysisStatus) {
    case "none":
      return "Not analyzed.";
    case "limited":
      return "Limited. No score.";
    case "stale":
      return "Photos changed. Re-run.";
    case "retake_needed":
      return "Retake failed angle.";
    case "error":
      return "Request failed. Retry.";
    default:
      return null;
  }
}

/**
 * Desktop right-hand snapshot panel (§4): a warm-paper editorial card for the
 * selected archive record — angle coverage, the honest score OR the binding
 * state label (§5), strongest / priority rows from the full analysis, and the
 * quick actions. Analysis actions run through the shell's requestAnalysis with
 * the honest progress overlay contained to this panel.
 */
export function AnalysisSnapshot({
  item,
  analysis,
  analyzing,
  isLatest,
  demo = false,
  canAnalyze,
  onRequestAnalysis,
  onViewAnalysis,
  onAddPhotos,
  width = 360,
}: {
  item: CheckIn;
  /** full result from data.analyses when fetched; null until then */
  analysis: AnalysisResult | null;
  /** an analysis request for this record is in flight elsewhere in the shell */
  analyzing: boolean;
  isLatest: boolean;
  demo?: boolean;
  /** the signed-in member owns this record and requests are available */
  canAnalyze: boolean;
  /** already bound to this record's id */
  onRequestAnalysis?: () => Promise<void>;
  onViewAnalysis: () => void;
  onAddPhotos: () => void;
  width?: number | string;
}) {
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const inFlight = busy || analyzing;
  const label = stateLabel(item, inFlight);
  const showScore = label === null && scoreVisible(item, inFlight);
  const angles = angleCount(item);
  const description = stateDescription(item, inFlight);

  const showRows =
    analysis !== null &&
    !inFlight &&
    !isArchiveOnly(item) &&
    (item.analysisStatus === "complete" || item.analysisStatus === "limited");
  const priorityMuscle =
    analysis?.priorities[0]?.muscle ?? analysis?.bottlenecks[0]?.muscle ?? null;

  // §5 analysis actions — ANALYZE NOW / RE-ANALYZE / RETRY (archive-only gets
  // the optional analyze-visible-areas flow).
  const actionLabel = inFlight
    ? null
    : isArchiveOnly(item)
      ? "ANALYZE VISIBLE AREAS"
      : item.analysisStatus === "none"
        ? "ANALYZE NOW"
        : item.analysisStatus === "stale"
          ? "RE-ANALYZE"
          : item.analysisStatus === "error"
            ? "RETRY ANALYSIS"
            : null;

  const run = async () => {
    if (!onRequestAnalysis || inFlight) return;
    setRequestError(null);
    setBusy(true);
    try {
      await onRequestAnalysis();
    } catch {
      setRequestError("ANALYSIS FAILED. RETRY.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      aria-label="Check-in snapshot"
      className="relative flex min-h-0 shrink-0 flex-col overflow-hidden"
      style={{
        width,
        borderRadius: 24,
        background: "var(--color-paper)",
        color: INK,
        border: "1px solid rgba(21, 23, 19, 0.16)",
        // Containing block for the (fixed) progress overlay — it covers this
        // panel only, never the whole workspace.
        transform: "translateZ(0)",
      }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ padding: "22px 22px 20px" }}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-2">
          <p className="micro-11" style={{ opacity: 0.55 }}>
            {isLatest ? "LATEST CHECK-IN" : `CHECK-IN · ${mastheadDate(item.date)}`}
          </p>
          {demo && (
            <span
              className="micro shrink-0 rounded-full px-2 py-0.5"
              style={{ border: "1px solid var(--color-ember)", color: "var(--color-ember)" }}
            >
              DEMO
            </span>
          )}
        </div>

        {/* angle coverage — 4 slots, filled vs missing */}
        <p className="micro mt-4" style={{ opacity: 0.5 }}>
          {angles} OF 4 ANGLES
        </p>
        <div className="mt-2 flex gap-1.5">
          {ANGLES.map((a) => (
            <CoverageSlot key={a} angle={a} filled={Boolean(item.photos[a])} />
          ))}
        </div>

        {/* honest score OR binding state label (§5) */}
        {showScore ? (
          <div className="mt-5">
            <div className="flex items-end gap-3">
              <span className="masthead" style={{ fontSize: 76, lineHeight: 0.9 }}>
                {item.rating}
              </span>
              <span className="micro-11 mb-1" style={{ opacity: 0.45 }}>
                OVERALL / 100
              </span>
              {item.delta !== null && item.delta !== 0 && (
                <span
                  className="micro-11 mb-1"
                  style={{ color: item.delta > 0 ? "#2e7d4c" : "#b3261e" }}
                >
                  {item.delta > 0 ? `+${item.delta}` : item.delta}
                </span>
              )}
            </div>
            {item.delta !== null && item.delta !== 0 && (
              <p className="micro mt-1.5" style={{ opacity: 0.45 }}>
                VS COMPARABLE PRIOR FULL SET
              </p>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <p
              className="masthead"
              style={{ fontSize: 28, lineHeight: 1.05, color: paperStateColor(label) }}
            >
              {label}
            </p>
            {description && (
              <p className="mt-2 text-[13px] leading-relaxed" style={{ opacity: 0.72 }}>
                {description}
              </p>
            )}
            {actionLabel && canAnalyze && onRequestAnalysis && (
              <button
                onClick={() => void run()}
                className="micro-11 mt-4 rounded-full px-6"
                style={{
                  minHeight: 44,
                  background: "var(--color-ember)",
                  color: "var(--color-canvas)",
                }}
              >
                {actionLabel}
              </button>
            )}
            {requestError && (
              <p className="micro mt-3" style={{ color: "#b3261e" }}>
                {requestError}
              </p>
            )}
          </div>
        )}

        {/* strongest / priority rows from the full result */}
        {showRows && analysis?.strongest && (
          <div className="mt-6 border-t pt-5" style={{ borderColor: HAIRLINE }}>
            <RatingGlyph kind="strong" size="md" label="STRONGEST" />
            <p className="masthead mt-2" style={{ fontSize: 30, lineHeight: 1 }}>
              {MUSCLE_LABEL[analysis.strongest.muscle]}
            </p>
          </div>
        )}
        {showRows && priorityMuscle && (
          <div className="mt-5 border-t pt-5" style={{ borderColor: HAIRLINE }}>
            <RatingGlyph kind="priority" size="md" label="NEEDS WORK" />
            <p className="masthead mt-2" style={{ fontSize: 30, lineHeight: 1 }}>
              {MUSCLE_LABEL[priorityMuscle]}
            </p>
          </div>
        )}

        {/* quick actions — pinned to the panel foot when content is short */}
        <div className="mt-auto flex flex-col gap-2.5 pt-7">
          <button
            onClick={onViewAnalysis}
            className="micro-11 w-full rounded-full"
            style={{
              minHeight: 48,
              background: "var(--color-paper-ink)",
              color: "var(--color-paper)",
            }}
          >
            VIEW FULL ANALYSIS
          </button>
          <button
            onClick={onAddPhotos}
            className="micro-11 w-full rounded-full border"
            style={{ minHeight: 48, borderColor: "rgba(21, 23, 19, 0.3)", color: INK }}
          >
            ADD PHOTOS
          </button>
        </div>

        <p aria-live="polite" className="sr-only">
          {busy ? "Analyzing submitted photos" : ""}
        </p>
      </div>

      <AnimatePresence>
        {busy && <AnalysisProgressOverlay key="progress" stage="analyzing" />}
      </AnimatePresence>
    </aside>
  );
}

function CoverageSlot({ angle, filled }: { angle: ViewAngle; filled: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${angle} ${filled ? "captured" : "missing"}`}
      className="flex items-center justify-center rounded-lg"
      style={{
        width: 34,
        height: 44,
        border: filled
          ? "1px solid rgba(21, 23, 19, 0.45)"
          : "1px dashed rgba(21, 23, 19, 0.22)",
        background: filled ? "rgba(21, 23, 19, 0.07)" : "transparent",
      }}
    >
      <svg
        width="11"
        height="20"
        viewBox="0 0 10 18"
        fill="none"
        stroke={filled ? "var(--color-paper-ink)" : "rgba(21, 23, 19, 0.32)"}
        strokeWidth="1.1"
        aria-hidden
      >
        <circle cx="5" cy="2.6" r="1.8" />
        <path d="M5 5c-1.7 0-2.7 1-3 2.4L1.4 11h1.8l.5 6h2.6l.5-6h1.8l-.6-3.6C7.7 6 6.7 5 5 5Z" />
      </svg>
    </span>
  );
}
