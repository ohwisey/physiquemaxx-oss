"use client";

import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  GROUP_RISE_MS,
  HOLD_MS,
  PM_EASE_OUT,
  REDUCED_FADE_MS,
  SCORE_CLIP_MS,
  groupDelay,
  totalRevealMs,
} from "./motion/reveal-timing";

/**
 * Result choreography wrapper (spec §7 "Result ready", ≤700ms total):
 * 140ms hold → score/limited label clips in (overflow-hidden, y 105%→0,
 * 320ms, --pm-ease-out) → content groups rise with a 35–45ms stagger,
 * compressed for long lists (cap math lives in ./motion/reveal-timing).
 * Reduced motion: one ≤150ms fade, no travel. Pure composition — no data
 * logic. Mounts at the result moment (client-side).
 *
 * Wrap each row/section of the sheet in <RevealGroup index={n}> and pass
 * `groupCount` (how many groups) so the long-list cap can compress delays.
 */

const RevealContext = createContext<{ reduced: boolean; count: number } | null>(null);

export function RevealGroup({
  index,
  children,
  className,
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(RevealContext);
  if (!ctx || ctx.reduced) {
    // outside a ResultReveal, or reduced motion: static (outer fade covers it)
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: GROUP_RISE_MS / 1000,
        delay: groupDelay(index, ctx.count) / 1000,
        ease: PM_EASE_OUT,
      }}
    >
      {children}
    </motion.div>
  );
}

export function ResultReveal({
  children,
  scoreBlock,
  limitedLabel = false,
  groupCount = 4,
  onDone,
  className,
}: {
  children: ReactNode;
  scoreBlock?: ReactNode;
  limitedLabel?: boolean;
  groupCount?: number;
  onDone?: () => void;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const total = reduced ? REDUCED_FADE_MS : totalRevealMs(groupCount);
    const timer = window.setTimeout(() => doneRef.current?.(), total);
    return () => window.clearTimeout(timer);
  }, [reduced, groupCount]);

  const hasClip = Boolean(scoreBlock) || limitedLabel;
  const clipContent = hasClip && (
    <>
      {scoreBlock}
      {limitedLabel && (
        <div
          className="micro-11"
          style={{ color: "var(--color-limited)", marginTop: scoreBlock ? 4 : 0 }}
        >
          LIMITED EVIDENCE
        </div>
      )}
    </>
  );

  return (
    <RevealContext.Provider value={{ reduced, count: Math.max(1, groupCount) }}>
      <motion.div
        className={className}
        initial={{ opacity: reduced ? 0 : 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? REDUCED_FADE_MS / 1000 : 0 }}
      >
        {hasClip && (
          <div style={{ overflow: "hidden" }}>
            {reduced ? (
              <div>{clipContent}</div>
            ) : (
              <motion.div
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: SCORE_CLIP_MS / 1000,
                  delay: HOLD_MS / 1000, // the quiet 140ms hold
                  ease: PM_EASE_OUT,
                }}
              >
                {clipContent}
              </motion.div>
            )}
          </div>
        )}
        {children}
      </motion.div>
    </RevealContext.Provider>
  );
}
