"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Honest analysis progress (spec §7 "Upload and analysis"): shows only states
 * the system can prove. No percentages, no invented AI phases, no promises
 * about closing the page. "UPLOADING n OF total" appears only when real
 * per-file numbers are provided. Mounted client-side during a run.
 */

export type AnalysisStage = "preparing" | "uploading" | "analyzing" | "saving";

function headingFor(
  stage: AnalysisStage,
  uploadedCount?: number,
  totalCount?: number,
): string {
  switch (stage) {
    case "preparing":
      return "PREPARING";
    case "uploading":
      // real per-file progress only — otherwise stay generic
      return uploadedCount != null && totalCount != null
        ? `UPLOADING ${uploadedCount} OF ${totalCount}`
        : "UPLOADING";
    case "analyzing":
      return "ANALYZING…";
    case "saving":
      return "SAVING";
  }
}

export function AnalysisProgressOverlay({
  stage,
  uploadedCount,
  totalCount,
  onCancel,
}: {
  stage: AnalysisStage;
  uploadedCount?: number;
  totalCount?: number;
  onCancel?: () => void;
}) {
  const reduced = useReducedMotion();
  const heading = headingFor(stage, uploadedCount, totalCount);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(4,5,4,0.8)" }} // canvas-deep at 80%
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.1 : 0.18 }}
    >
      {/* ember pulse dot — subtle breathe; static under reduced motion */}
      <motion.span
        aria-hidden="true"
        style={{
          display: "block",
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "var(--color-ember)",
        }}
        animate={reduced ? { opacity: 0.9 } : { opacity: [0.35, 1, 0.35] }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <div aria-live="polite" className="mt-5 text-center">
        <h2
          className="masthead"
          style={{
            fontSize: 18,
            letterSpacing: "0.05em",
            color: "var(--color-text)",
          }}
        >
          {heading}
        </h2>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="micro-11 mt-8"
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: "0 20px",
            borderRadius: 999,
            border: "1px solid rgba(244,241,234,0.10)",
            color: "var(--color-text-muted)",
            background: "transparent",
          }}
        >
          CANCEL
        </button>
      )}
    </motion.div>
  );
}
