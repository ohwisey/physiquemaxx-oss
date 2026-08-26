"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * The giant condensed date. Warm white, extremely bold, sits BEHIND the deck
 * (rear card caps clip the glyph bottoms — z handled by the parent).
 * Change animation ~240ms: old date drops 10px, blurs, fades; new date enters
 * from 10px above. Only fires when the committed date actually changes.
 *
 * Visual props never branch on reduced-motion (SSR can't know it — it would
 * mismatch hydration); only the transition duration collapses, which makes
 * the travel imperceptible for reduced-motion users.
 */
export function DateMasthead({
  label,
  top,
  size,
}: {
  label: string;
  top: number;
  size: number;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-10 flex justify-center"
      style={{ top }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.h1
          key={label}
          className="masthead text-bone"
          style={{ fontSize: size }}
          initial={{ y: -10, opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: 10, opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: reduced ? 0.05 : 0.24, ease: [0.3, 0, 0.3, 1] }}
        >
          {label}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}
