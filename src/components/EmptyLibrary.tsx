"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Empty library states (§3): a layered ghost-card composition — two hairline
 * card outlines, a neutral SVG silhouette, a soft ember bloom — with
 * scope-appropriate copy. No photo exists here, so no photo-derived ambient
 * color is ever rendered behind it. Only the viewer's own scope offers
 * actions; a partner's empty archive is never a place to create data.
 */
export function EmptyLibrary({
  variant,
  partnerName,
  top,
  onAdd,
  onViewExample,
}: {
  variant: "own" | "partner" | "us";
  partnerName: string | null;
  /** y where the empty composition begins (below the header stack) */
  top: number;
  onAdd?: () => void;
  onViewExample?: () => void;
}) {
  const reduced = useReducedMotion();

  const heading =
    variant === "own"
      ? "BUILD YOUR TIMELINE"
      : variant === "partner"
        ? `${(partnerName ?? "YOUR PARTNER").toUpperCase()} HASN'T ADDED A CHECK-IN YET`
        : "YOUR SHARED TIMELINE WILL APPEAR HERE";

  const body = variant === "own" ? "Front is enough." : null;

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center overflow-y-auto px-8 text-center"
      style={{ top, paddingBottom: 140 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.24, ease: "easeOut" }}
    >
      {/* layered ghost cards + silhouette + confined ember bloom */}
      <div
        aria-hidden
        className="relative mt-10 shrink-0"
        style={{ width: 190, height: 260 }}
      >
        <div
          className="absolute rounded-3xl"
          style={{
            inset: 0,
            transform: "translateY(-14px) scale(0.9)",
            border: "1px solid var(--pm-border)",
            background: "rgba(17, 19, 17, 0.35)",
          }}
        />
        <div
          className="absolute rounded-3xl"
          style={{
            inset: 0,
            border: "1px solid var(--pm-border-strong)",
            background: "rgba(17, 19, 17, 0.6)",
          }}
        />
        <div
          className="absolute"
          style={{
            inset: -40,
            background:
              "radial-gradient(55% 45% at 50% 42%, rgba(255,101,55,0.09), transparent 72%)",
          }}
        />
        <svg
          viewBox="0 0 100 160"
          className="absolute inset-0 m-auto h-[74%] w-auto opacity-[0.18]"
          fill="none"
          stroke="#F3F1ED"
          strokeWidth="1.4"
        >
          <circle cx="50" cy="16" r="9" />
          <path d="M50 25c-8 0-14 4-17 9l-8 26m25-35c8 0 14 4 17 9l8 26M33 60c0 8 2 14 3 20l-1 15c0 12 2 26 4 40m28-75c0 8-2 14-3 20l1 15c0 12-2 26-4 40M42 135h-6m28 0h-6" />
        </svg>
      </div>

      <h2
        className="masthead mt-7 text-bone"
        style={{ fontSize: variant === "own" ? 34 : 24, lineHeight: 1.05, maxWidth: 320 }}
      >
        {heading}
      </h2>
      {body && (
        <p className="mt-3 max-w-70 text-[14px] leading-relaxed text-mute">
          {body}
        </p>
      )}

      {variant === "own" && (
        <div className="mt-7 flex w-full max-w-70 flex-col gap-2.5">
          {onAdd && (
            <button
              onClick={onAdd}
              className="micro-11 w-full rounded-full py-4"
              style={{
                minHeight: 52,
                background: "var(--color-ember)",
                color: "var(--color-canvas)",
              }}
            >
              ADD FIRST PHOTO
            </button>
          )}
          {onViewExample && (
            <button
              onClick={onViewExample}
              className="micro-11 w-full rounded-full border py-4 text-bone/85"
              style={{ minHeight: 52, borderColor: "rgba(243,241,237,0.24)" }}
            >
              VIEW EXAMPLE
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
