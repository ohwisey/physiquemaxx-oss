"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ViewAngle } from "@/lib/types";
import type { SaveCheckInOptions, SaveCheckInResult } from "@/lib/checkin-meta";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  AnalysisProgressOverlay,
  type AnalysisStage,
} from "./AnalysisProgressOverlay";

const RAIL: { key: ViewAngle; label: string }[] = [
  { key: "left", label: "LEFT" },
  { key: "back", label: "BACK" },
  { key: "right", label: "RIGHT" },
];

const GUIDANCE = [
  "Same room, same lighting",
  "Same distance, same lens",
  "Relaxed, no flexing",
  "Full body in frame",
  "No mirror, no filters",
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Today's check-in (§3): one large camera-first FRONT slot, a compact
 * optional L/B/R rail, optional weight above a collapsed standardization
 * disclosure, and in-flow SAVE / SAVE & ANALYZE actions. Save persists
 * first and is never rolled back by an analysis failure — an analysis error
 * surfaces inline while the saved card already exists in the library.
 */
export function CaptureSheet({
  onClose,
  onSave,
  onAnalyze,
  lastWeightKg,
  contained = false,
  subjectUserId,
  submissionId,
  subjectLabel,
}: {
  onClose: () => void;
  /** persists the check-in (live capture, today) — resolves with its id */
  onSave: (
    files: Partial<Record<ViewAngle, File>>,
    weightKg: number | null,
    opts: SaveCheckInOptions & { subjectUserId: string; submissionId: string },
  ) => Promise<SaveCheckInResult | void>;
  onAnalyze?: (checkinId: string) => Promise<void>;
  lastWeightKg?: number | null;
  /**
   * Rendered inside a desktop modal container (which owns the 220ms
   * fade+scale entrance): skip the sheet's own travel and center the column.
   */
  contained?: boolean;
  /** depicted subject's profile id — frozen at capture start */
  subjectUserId: string;
  /** client submission id — frozen at capture start, reused across retries */
  submissionId: string;
  /** display label for the frozen subject (e.g. "LUKE") */
  subjectLabel?: string;
}) {
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(busy ? undefined : onClose);
  const [files, setFiles] = useState<Partial<Record<ViewAngle, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<ViewAngle, string>>>({});
  const [weight, setWeight] = useState("");
  const [tipsOpen, setTipsOpen] = useState(false);
  const [stage, setStage] = useState<AnalysisStage>("uploading");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(
    () => () => {
      Object.values(previewsRef.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    [],
  );

  const canSave = Boolean(files.front) && !busy && !savedId;
  const weightNum =
    weight.trim() === "" ? null : Number(weight.replace(",", "."));

  const pick = (angle: ViewAngle, file: File | null) => {
    if (!file) return;
    setFiles((p) => ({ ...p, [angle]: file }));
    setPreviews((p) => {
      if (p[angle]) URL.revokeObjectURL(p[angle]!);
      return { ...p, [angle]: URL.createObjectURL(file) };
    });
  };

  const run = async (analyze: boolean) => {
    if (busy) return;
    setError(null);
    let id = savedId;

    if (!id) {
      if (!files.front) return;
      setBusy(true);
      setStage("uploading");
      setStatus("Saving…");
      try {
        const res = await onSave(
          files,
          Number.isFinite(weightNum as number) ? weightNum : null,
          { sourceKind: "live_capture", subjectUserId, submissionId },
        );
        id = res?.checkinId ?? null;
        setSavedId(id);
      } catch {
        setBusy(false);
        setStatus("Save failed");
        setError("SAVE FAILED. TRY AGAIN.");
        return;
      }
      setBusy(false);
      setStatus("Saved");
    }

    if (!analyze) {
      onClose();
      return;
    }
    if (!id || !onAnalyze) {
      // saved, but analysis can't be requested from here — the card exists
      onClose();
      return;
    }
    setBusy(true);
    setStage("analyzing");
    setStatus("Analyzing…");
    try {
      await onAnalyze(id);
      setBusy(false);
      setStatus("Done");
      onClose();
    } catch {
      setBusy(false);
      setStatus("Analysis failed. Saved.");
      setError("ANALYSIS FAILED. CHECK-IN SAVED.");
    }
  };

  const captured = Object.keys(files).length;

  return (
    <motion.div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Today's check-in"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      initial={contained ? false : reduced ? { opacity: 0 } : { y: "6%", opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
      exit={
        contained
          ? undefined
          : reduced
            ? { opacity: 0, transition: { duration: 0.12 } }
            : { y: "6%", opacity: 0, transition: { duration: 0.2 } }
      }
      transition={{ duration: reduced ? 0.12 : 0.32, ease: EASE }}
    >
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)", height: 76 }}
      >
        <span className="flex flex-col">
          {subjectLabel && (
            <span className="micro-11 text-mute">FOR {subjectLabel}</span>
          )}
          <span className="masthead text-bone" style={{ fontSize: 24 }}>
            TODAY&apos;S CHECK-IN
          </span>
        </span>
        <button
          aria-label="Close"
          onClick={onClose}
          className="flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44, background: "rgba(243,241,237,0.08)" }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2l10 10M12 2L2 12" stroke="#F3F1ED" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        className="flex w-full flex-1 flex-col overflow-y-auto px-5"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
          // contained desktop modal: keep the column readable and centered
          maxWidth: contained ? 620 : undefined,
          marginInline: contained ? "auto" : undefined,
        }}
      >
        {/* the large front slot — camera-first */}
        <input
          id="capture-front"
          type="file"
          accept="image/*"
          capture="environment"
          className="peer sr-only"
          onChange={(e) => pick("front", e.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="capture-front"
          className="card-finish relative mt-1 block cursor-pointer overflow-hidden outline-offset-2 peer-focus-visible:[outline:2px_solid_var(--color-ember)]"
          style={{
            aspectRatio: "1.2",
            maxHeight: 262,
            borderRadius: 22,
            background: "var(--color-surface)",
            border: previews.front
              ? "1px solid var(--pm-border)"
              : "1px dashed var(--pm-border-strong)",
          }}
        >
          {previews.front ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews.front}
              alt="Front capture preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <FrontSilhouette />
          )}
          <span
            className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4"
            style={{
              background: "linear-gradient(to top, rgba(3,3,3,0.75), transparent)",
            }}
          >
            <span className="micro-11 text-bone">FRONT</span>
            <span
              className="micro"
              style={{
                color: previews.front
                  ? "var(--color-positive)"
                  : "var(--color-ember)",
              }}
            >
              {previews.front ? "RETAKE" : "START HERE"}
            </span>
          </span>
        </label>

        {/* compact optional rail */}
        <div className="mt-5 flex items-start gap-3">
          {RAIL.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <input
                id={`capture-${key}`}
                type="file"
                accept="image/*"
                capture="environment"
                className="peer sr-only"
                onChange={(e) => pick(key, e.target.files?.[0] ?? null)}
              />
              <label
                htmlFor={`capture-${key}`}
                className="relative block cursor-pointer overflow-hidden outline-offset-2 peer-focus-visible:[outline:2px_solid_var(--color-ember)]"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: "var(--color-surface)",
                  border: previews[key]
                    ? "1px solid var(--pm-border-strong)"
                    : "1px dashed var(--pm-border)",
                }}
              >
                {previews[key] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[key]}
                    alt={`${label} capture preview`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 2v10M2 7h10"
                        stroke="rgba(244,241,234,0.4)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                )}
              </label>
              <span className="micro text-mute">{label}</span>
            </div>
          ))}
          <p className="micro mt-1 flex-1 text-mute">OPTIONAL</p>
        </div>

        {/* optional weight */}
        <div className="mt-5">
          <p className="micro-11 text-mute">WEIGHT · OPTIONAL</p>
          <div
            className="mt-2 flex items-baseline gap-2 border-b pb-2"
            style={{ borderColor: "rgba(243,241,237,0.14)" }}
          >
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="250"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={lastWeightKg ? lastWeightKg.toFixed(1) : "72.0"}
              className="masthead w-32 bg-transparent text-bone outline-none placeholder:text-bone/25"
              style={{ fontSize: 30 }}
              aria-label="Today's weight in kilograms"
            />
            <span className="micro text-mute">KG</span>
          </div>
        </div>

        {/* collapsed standardization disclosure */}
        <div className="mt-3">
          <button
            aria-expanded={tipsOpen}
            onClick={() => setTipsOpen((v) => !v)}
            className="flex w-full items-center justify-between py-2.5"
            style={{ minHeight: 44 }}
          >
            <span className="micro-11 text-mute">TIPS</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
              style={{
                transform: tipsOpen ? "rotate(180deg)" : "none",
                transition: "transform 200ms ease",
              }}
            >
              <path
                d="M2 4.5L6 8.5L10 4.5"
                stroke="rgba(244,241,234,0.6)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {tipsOpen && (
            <ul className="mt-1 flex flex-col gap-2.5 pb-1">
              {GUIDANCE.map((g) => (
                <li
                  key={g}
                  className="flex items-baseline gap-2.5 text-[14px] leading-relaxed text-bone/75"
                >
                  <span className="h-1 w-1 shrink-0 translate-y-[-3px] rounded-full bg-bone/40" />
                  {g}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* status + inline error — no disappearing toasts */}
        <p aria-live="polite" className="sr-only">
          {status}
        </p>
        {error && (
          <motion.p
            className="mt-4 text-[13px] leading-relaxed"
            style={{ color: "var(--color-priority)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
          >
            {error}
          </motion.p>
        )}

        {/* actions anchored to the bottom of the sheet (scrolls only if the
            content is taller than the viewport) */}
        <div className="mt-auto flex flex-col gap-2.5 pt-5">
          {savedId && error ? (
            <>
              <button
                onClick={() => void run(true)}
                className="micro-11 w-full rounded-full py-4 text-center"
                style={{
                  minHeight: 52,
                  background: "var(--color-ember)",
                  color: "var(--color-canvas)",
                }}
              >
                RETRY ANALYSIS
              </button>
              <button
                onClick={onClose}
                className="micro-11 w-full rounded-full border py-4 text-center text-bone/85"
                style={{ minHeight: 52, borderColor: "rgba(243,241,237,0.18)" }}
              >
                VIEW LIBRARY
              </button>
            </>
          ) : (
            <>
              <button
                disabled={!canSave}
                onClick={() => void run(false)}
                className="micro-11 w-full rounded-full py-4 text-center transition-opacity"
                style={{
                  minHeight: 52,
                  background: canSave
                    ? "var(--color-ember)"
                    : "rgba(255,101,55,0.18)",
                  color: canSave ? "var(--color-canvas)" : "rgba(244,241,234,0.4)",
                }}
              >
                {files.front
                  ? captured >= 4
                    ? "SAVE · FULL SET"
                    : `SAVE · ${captured}/4`
                  : "CAPTURE FRONT"}
              </button>
              {onAnalyze && (
                <button
                  disabled={!canSave}
                  onClick={() => void run(true)}
                  className="micro-11 w-full rounded-full border py-4 text-center transition-opacity"
                  style={{
                    minHeight: 52,
                    borderColor: canSave
                      ? "rgba(243,241,237,0.28)"
                      : "rgba(243,241,237,0.12)",
                    color: canSave ? "#F3F1ED" : "rgba(244,241,234,0.35)",
                  }}
                >
                  SAVE &amp; ANALYZE
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {busy && <AnalysisProgressOverlay key="progress" stage={stage} />}
      </AnimatePresence>
    </motion.div>
  );
}

/** Minimal standing-figure guide outline — a framing aid, not art. */
function FrontSilhouette() {
  return (
    <svg
      viewBox="0 0 100 160"
      className="absolute inset-0 m-auto h-[78%] w-auto opacity-[0.16]"
      fill="none"
      stroke="#F3F1ED"
      strokeWidth="1.4"
      aria-hidden
    >
      <circle cx="50" cy="16" r="9" />
      <path d="M50 25c-8 0-14 4-17 9l-8 26m25-35c8 0 14 4 17 9l8 26M33 60c0 8 2 14 3 20l-1 15c0 12 2 26 4 40m28-75c0 8-2 14-3 20l1 15c0 12-2 26-4 40M42 135h-6m28 0h-6" />
    </svg>
  );
}
