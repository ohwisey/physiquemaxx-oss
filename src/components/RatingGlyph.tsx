"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Semantic outcome glyph — color + icon + visible text, per spec §6.
 * Check draws once (260ms) with a single quiet ring expansion; X draws two
 * strokes over 260ms then one 420ms ring fade; limited is an amber dash;
 * retake reuses the red X but its label judges the PHOTO, not the person.
 * No loops, no shake, no screen flash (spec §7).
 *
 * `animate` defaults to false so archive/list usage renders the final state
 * statically and stays SSR/hydration-safe; pass animate at the result moment
 * (a client-side mount). Reduced motion always renders the final state.
 */

export type RatingKind = "strong" | "priority" | "limited" | "retake";
export type RatingGlyphSize = "sm" | "md" | "lg";

const PX: Record<RatingGlyphSize, number> = { sm: 20, md: 28, lg: 44 };

const COLOR: Record<RatingKind, string> = {
  strong: "var(--color-positive)",
  priority: "var(--color-priority)",
  limited: "var(--color-limited)",
  retake: "var(--color-priority)",
};

// Spec §6 labels; retake's default names the photo as the thing being judged.
const FALLBACK_LABEL: Record<RatingKind, string> = {
  strong: "STRONG",
  priority: "PRIORITY",
  limited: "LIMITED EVIDENCE",
  retake: "RETAKE PHOTO",
};

// Slightly irregular endpoints + a small static rotation = hand-drawn feel.
const CHECK = "M8.6 16.9 L13.9 22.1 L23.5 10.3";
const X_ONE = "M10.8 10.6 L21.4 21.7";
const X_TWO = "M21.2 10.9 L10.6 21.4";
const DASH = "M9.2 16.6 L22.8 15.7";

const ROTATE: Record<RatingKind, string> = {
  strong: "rotate(-4 16 16)",
  priority: "rotate(2 16 16)",
  retake: "rotate(2 16 16)",
  limited: "rotate(-2 16 16)",
};

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function RatingGlyph({
  kind,
  size = "md",
  animate = false,
  label,
}: {
  kind: RatingKind;
  size?: RatingGlyphSize;
  animate?: boolean;
  label?: string;
}) {
  const reduced = useReducedMotion();
  const play = animate && !reduced; // reduced motion → static final state
  const px = PX[size];
  const color = COLOR[kind];
  const text = label ?? FALLBACK_LABEL[kind];
  const isX = kind === "priority" || kind === "retake";

  return (
    <span
      role="img"
      aria-label={text}
      className="inline-flex items-center"
      style={{ gap: size === "sm" ? 6 : 8 }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ flex: "none", display: "block" }}
      >
        {/* static state ring (spec §6: every state uses color + icon) */}
        <circle
          cx={16}
          cy={16}
          r={13.5}
          stroke={color}
          strokeWidth={1.5}
          opacity={kind === "limited" ? 0.22 : 0.3}
        />
        {/* ONE transient ring — expansion for check, plain fade for X. Never loops. */}
        {play && kind === "strong" && (
          <motion.circle
            cx={16}
            cy={16}
            r={13.5}
            stroke={color}
            strokeWidth={1.5}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 0.42, delay: 0.26, ease: "easeOut" }}
          />
        )}
        {play && isX && (
          <motion.circle
            cx={16}
            cy={16}
            r={13.5}
            stroke={color}
            strokeWidth={1.5}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.42, delay: 0.26, ease: "easeOut" }}
          />
        )}
        <g
          stroke={color}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={ROTATE[kind]}
        >
          {kind === "strong" &&
            (play ? (
              <motion.path
                d={CHECK}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              />
            ) : (
              <path d={CHECK} />
            ))}
          {isX &&
            (play ? (
              <>
                <motion.path
                  d={X_ONE}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.13, ease: "easeOut" }}
                />
                <motion.path
                  d={X_TWO}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.13, delay: 0.13, ease: "easeOut" }}
                />
              </>
            ) : (
              <>
                <path d={X_ONE} />
                <path d={X_TWO} />
              </>
            ))}
          {kind === "limited" &&
            (play ? (
              <motion.path
                d={DASH}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              />
            ) : (
              <path d={DASH} />
            ))}
        </g>
      </svg>
      {play ? (
        <motion.span
          className={size === "sm" ? "micro" : "micro-11"}
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, delay: 0.12 }}
        >
          {text}
        </motion.span>
      ) : (
        <span className={size === "sm" ? "micro" : "micro-11"} style={{ color }}>
          {text}
        </span>
      )}
    </span>
  );
}
