"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { mastheadDate, type ViewAngle } from "@/lib/types";
import {
  localISODate,
  type SaveCheckInOptions,
  type SaveCheckInResult,
} from "@/lib/checkin-meta";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { RatingGlyph } from "./RatingGlyph";
import {
  AnalysisProgressOverlay,
  type AnalysisStage,
} from "./AnalysisProgressOverlay";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const RAIL: { key: ViewAngle; label: string }[] = [
  { key: "left", label: "LEFT" },
  { key: "back", label: "BACK" },
  { key: "right", label: "RIGHT" },
];

type Outcome = "archive" | "analyze";

function prettyDate(iso: string): string {
  return `${mastheadDate(iso)} ${iso.slice(0, 4)}`;
}

/**
 * Add past photos (§3): date first (future rejected), then a gallery-first
 * FRONT cover slot with a compact optional rail, weight scoped to the chosen
 * date, and an honest outcome choice — ARCHIVE ONLY vs ANALYZE VISIBLE
 * AREAS. Saves preserve immediately; analysis is always a separate,
 * optional step afterwards. Historical imports never touch momentum.
 */
export function HistoricalImportSheet({
  onClose,
  onSave,
  onAnalyze,
  myDates,
  contained = false,
  subjectUserId,
  submissionId,
  subjectLabel,
}: {
  onClose: () => void;
  onSave: (
    files: Partial<Record<ViewAngle, File>>,
    weightKg: number | null,
    opts: SaveCheckInOptions & { subjectUserId: string; submissionId: string },
  ) => Promise<SaveCheckInResult | void>;
  onAnalyze?: (checkinId: string) => Promise<void>;
  /** the frozen subject's existing check-in dates (YYYY-MM-DD) */
  myDates: ReadonlySet<string>;
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
  const today = localISODate();

  const [date, setDate] = useState("");
  const [files, setFiles] = useState<Partial<Record<ViewAngle, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<ViewAngle, string>>>({});
  const [weight, setWeight] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("archive");
  const [stage, setStage] = useState<AnalysisStage>("uploading");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState<SaveCheckInResult | null>(null);
  const [step, setStep] = useState<"form" | "saved">("form");

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

  const futureDate = date !== "" && date > today;
  const dateValid = date !== "" && !futureDate;
  const dateExists = dateValid && myDates.has(date);
  const angleTotal = Object.keys(files).length;
  const fullSet = angleTotal === 4;
  const canSave = dateValid && Boolean(files.front) && !busy;
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

  const remove = (angle: ViewAngle) => {
    setFiles((p) => {
      const next = { ...p };
      delete next[angle];
      return next;
    });
    setPreviews((p) => {
      if (p[angle]) URL.revokeObjectURL(p[angle]!);
      const next = { ...p };
      delete next[angle];
      return next;
    });
  };

  const resetForAnotherDate = () => {
    Object.values(previewsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    setDate("");
    setFiles({});
    setPreviews({});
    setWeight("");
    setOutcome("archive");
    setError(null);
    setStatus("");
    setSaved(null);
    setStep("form");
  };

  const save = async () => {
    if (!canSave) return;
    setError(null);
    setBusy(true);
    setStage("uploading");
    setStatus("Saving…");
    try {
      const res = await onSave(
        files,
        Number.isFinite(weightNum as number) ? weightNum : null,
        {
          date,
          archiveOnly: outcome === "archive",
          sourceKind: "historical_import",
          subjectUserId,
          submissionId,
        },
      );
      setSaved(res ?? null);
      setStep("saved");
      setStatus("Saved");
    } catch {
      setError("SAVE FAILED. TRY AGAIN.");
      setStatus("Save failed");
    }
    setBusy(false);
  };

  const analyzeNow = async () => {
    if (!saved?.checkinId || !onAnalyze || busy) return;
    setError(null);
    setBusy(true);
    setStage("analyzing");
    setStatus("Analyzing…");
    try {
      await onAnalyze(saved.checkinId);
      setBusy(false);
      setStatus("Done");
      onClose();
    } catch {
      setBusy(false);
      setStatus("Analysis failed. Saved.");
      setError("ANALYSIS FAILED. IMPORT SAVED.");
    }
  };

  return (
    <motion.div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Add past photos"
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
            ADD PAST PHOTOS
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
        className="w-full flex-1 overflow-y-auto px-5"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
          // contained desktop modal: keep the column readable and centered
          maxWidth: contained ? 640 : undefined,
          marginInline: contained ? "auto" : undefined,
        }}
      >
        {step === "saved" ? (
          /* ------------------------------------------------ success state */
          <div className="flex flex-col items-center pt-10 text-center">
            <RatingGlyph kind="strong" size="lg" animate label="SAVED" />
            <p className="masthead mt-5 text-bone" style={{ fontSize: 28 }}>
              SAVED
            </p>
            <p className="mt-2 text-[14px] text-mute">
              {prettyDate(date)} ·{" "}
              {saved
                ? `${saved.angleCount} ${saved.angleCount === 1 ? "angle" : "angles"}`
                : `${angleTotal} ${angleTotal === 1 ? "angle" : "angles"}`}
              {outcome === "archive" ? " · archive only" : ""}
            </p>
            {saved && saved.replacedAngles.length > 0 && (
              <p className="mt-1 text-[13px] text-mute">
                Replaced: {saved.replacedAngles.join(", ").toUpperCase()}
              </p>
            )}

            {error && (
              <p
                className="mt-4 text-[13px] leading-relaxed"
                style={{ color: "var(--color-priority)" }}
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex w-full max-w-90 flex-col gap-2.5">
              {outcome === "analyze" && saved?.checkinId && onAnalyze && (
                <button
                  onClick={() => void analyzeNow()}
                  className="micro-11 w-full rounded-full py-4"
                  style={{
                    minHeight: 52,
                    background: "var(--color-ember)",
                    color: "var(--color-canvas)",
                  }}
                >
                  ANALYZE NOW
                </button>
              )}
              <button
                onClick={resetForAnotherDate}
                className="micro-11 w-full rounded-full border py-4 text-bone/85"
                style={{ minHeight: 52, borderColor: "rgba(243,241,237,0.28)" }}
              >
                ADD ANOTHER DATE
              </button>
              <button
                onClick={onClose}
                className="micro-11 w-full rounded-full py-4 text-mute"
                style={{ minHeight: 44 }}
              >
                DONE
              </button>
            </div>
          </div>
        ) : (
          /* --------------------------------------------------------- form */
          <>
            {/* 1 · the date comes first */}
            <div className="mt-1">
              <label className="micro-11 text-mute" htmlFor="import-date">
                DATE
              </label>
              <input
                id="import-date"
                data-autofocus
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full rounded-2xl px-4 text-[16px] text-bone outline-none"
                style={{
                  height: 52,
                  background: "var(--color-surface)",
                  border: `1px solid ${futureDate ? "var(--color-priority)" : "var(--pm-border)"}`,
                  colorScheme: "dark",
                }}
              />
              {futureDate && (
                <p
                  className="mt-2 text-[13px]"
                  style={{ color: "var(--color-priority)" }}
                >
                  Future date. Pick an earlier day.
                </p>
              )}
              {dateExists && (
                <p
                  className="mt-2 text-[13px] leading-relaxed"
                  style={{ color: "var(--color-limited)" }}
                >
                  Adds a separate check-in on this date.
                </p>
              )}
            </div>

            {dateValid && (
              <>
                {/* 2 · front cover slot */}
                <input
                  id="import-front"
                  type="file"
                  accept="image/*"
                  className="peer sr-only"
                  onChange={(e) => pick("front", e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="import-front"
                  className="relative mt-5 block cursor-pointer overflow-hidden outline-offset-2 peer-focus-visible:[outline:2px_solid_var(--color-ember)]"
                  style={{
                    aspectRatio: "1.05",
                    maxHeight: 300,
                    borderRadius: 22,
                    background: "var(--color-surface)",
                    border: previews.front
                      ? "1px solid var(--pm-border-strong)"
                      : "1px dashed var(--pm-border-strong)",
                  }}
                >
                  {previews.front ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews.front}
                      alt="Front photo preview"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
                        <rect x="2" y="2" width="22" height="22" rx="4" stroke="rgba(244,241,234,0.4)" strokeWidth="1.4" />
                        <circle cx="9.5" cy="9.5" r="2.4" stroke="rgba(244,241,234,0.4)" strokeWidth="1.4" />
                        <path d="M3 20l6-6 4 4 5-5 5 5" stroke="rgba(244,241,234,0.4)" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                      <span className="micro-11 text-bone">FRONT · COVER</span>
                      <span className="micro" style={{ color: "var(--color-ember)" }}>
                        START HERE
                      </span>
                    </span>
                  )}
                  {previews.front && (
                    <span
                      className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(3,3,3,0.78), transparent)",
                      }}
                    >
                      <span className="micro-11 text-bone">FRONT ✓</span>
                      <span className="micro" style={{ color: "var(--color-ember)" }}>
                        CHANGE
                      </span>
                    </span>
                  )}
                </label>
                {previews.front && (
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      onClick={() => remove("front")}
                      className="micro px-2 py-2 text-mute"
                      style={{ minHeight: 44 }}
                    >
                      REMOVE
                    </button>
                  </div>
                )}

                {/* 3 · optional compact rail */}
                <p className="micro-11 mt-5 text-mute">OPTIONAL</p>
                <div className="mt-3 flex items-start gap-3">
                  {RAIL.map(({ key, label }) => (
                    <div key={key} className="flex flex-col items-center gap-1.5">
                      <input
                        id={`import-${key}`}
                        type="file"
                        accept="image/*"
                        className="peer sr-only"
                        onChange={(e) => pick(key, e.target.files?.[0] ?? null)}
                      />
                      <label
                        htmlFor={`import-${key}`}
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
                            alt={`${label} photo preview`}
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
                      {previews[key] ? (
                        <button
                          onClick={() => remove(key)}
                          className="micro text-mute"
                          style={{ minHeight: 24 }}
                        >
                          {label} ✓ · REMOVE
                        </button>
                      ) : (
                        <span className="micro text-mute">{label}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 4 · weight applies to the chosen date */}
                <div className="mt-6">
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
                      placeholder="72.0"
                      className="masthead w-32 bg-transparent text-bone outline-none placeholder:text-bone/25"
                      style={{ fontSize: 32 }}
                      aria-label={`Weight in kilograms on ${prettyDate(date)}`}
                    />
                    <span className="micro text-mute">KG</span>
                  </div>
                </div>

                {/* 5 · honest outcome before save */}
                <p className="micro-11 mt-6 text-mute">AFTER SAVE</p>
                <div
                  className="mt-3 flex flex-col gap-2"
                  role="radiogroup"
                  aria-label="Outcome"
                >
                  <OutcomeOption
                    selected={outcome === "archive"}
                    title="ARCHIVE ONLY"
                    description="Not scored or compared."
                    onSelect={() => setOutcome("archive")}
                  />
                  <OutcomeOption
                    selected={outcome === "analyze"}
                    title="ANALYZE VISIBLE AREAS"
                    description={
                      fullSet ? "Full set. Score if all views pass." : "Limited. No score."
                    }
                    onSelect={() => setOutcome("analyze")}
                  />
                </div>

                {/* status + inline error */}
                <p aria-live="polite" className="sr-only">
                  {status}
                </p>
                {error && (
                  <p
                    className="mt-4 text-[13px] leading-relaxed"
                    style={{ color: "var(--color-priority)" }}
                  >
                    {error}
                  </p>
                )}

                {/* 6 · save — in flow */}
                <button
                  disabled={!canSave}
                  onClick={() => void save()}
                  className="micro-11 mt-6 w-full rounded-full py-4 text-center transition-opacity"
                  style={{
                    minHeight: 52,
                    background: canSave
                      ? "var(--color-ember)"
                      : "rgba(255,101,55,0.18)",
                    color: canSave
                      ? "var(--color-canvas)"
                      : "rgba(244,241,234,0.4)",
                  }}
                >
                  {files.front ? "SAVE TO ARCHIVE" : "ADD THE FRONT PHOTO TO SAVE"}
                </button>
              </>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {busy && <AnalysisProgressOverlay key="progress" stage={stage} />}
      </AnimatePresence>
    </motion.div>
  );
}

function OutcomeOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left"
      style={{
        minHeight: 64,
        background: selected ? "var(--color-surface-raised)" : "var(--color-surface)",
        border: `1px solid ${selected ? "var(--pm-border-strong)" : "var(--pm-border)"}`,
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 18,
          height: 18,
          border: `1.5px solid ${selected ? "var(--color-ember)" : "rgba(244,241,234,0.35)"}`,
        }}
      >
        {selected && (
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, background: "var(--color-ember)" }}
          />
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="micro-11 text-bone">{title}</span>
        <span className="text-[13px] leading-snug text-mute">{description}</span>
      </span>
    </button>
  );
}
