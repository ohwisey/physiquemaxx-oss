"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Momentum module (spec §7 "Consistency ember") — a rolling activity count,
 * never a streak. The caller computes `count` (live_capture check-ins with a
 * front photo, trailing 90 days); display caps at "12+". Intensity bands:
 * 0 dim static outline, 1 low, 2 medium, 3+ full. No loss/failure animation:
 * as records roll out of the window the count simply changes.
 *
 * All animation is transform/opacity, pauses when offscreen or the document
 * is hidden, and reduced motion renders a static flame with no embers. The
 * orange bloom is confined to the module (overflow-hidden circle).
 */

const DISPLAY_CAP = 12;

/** Deterministic embers — fixed seeded offsets; no Math.random at render. */
const EMBERS = [
  { x: 30, y0: 42, rise: 16, r: 1.5, dur: 2.2, delay: 0.2 },
  { x: 37, y0: 44, rise: 11, r: 1.1, dur: 1.8, delay: 1.0 },
  { x: 26, y0: 45, rise: 18, r: 1.2, dur: 2.5, delay: 1.6 },
];

type Band = 0 | 1 | 2 | 3;

function bandFor(count: number): Band {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

const GLOW_ALPHA: Record<Band, number> = { 0: 0, 1: 0.14, 2: 0.22, 3: 0.3 };
const EMBER_COUNT: Record<Band, number> = { 0: 0, 1: 2, 2: 2, 3: 3 };
const FLAME_ALPHA: Record<Band, number> = { 0: 0.35, 1: 0.72, 2: 0.88, 3: 1 };

const OUTER_FLAME =
  "M32 13 C38 21 44 26.5 44 36 C44 44.8 38.6 50 32 50 C25.4 50 20 44.8 20 36 C20 28.5 26 21.5 32 13 Z";
const INNER_FLAME =
  "M32 27 C35.4 31.4 38 34 38 38.8 C38 43.4 35.3 46 32 46 C28.7 46 26 43.4 26 38.8 C26 34.4 28.8 31.4 32 27 Z";

export function ConsistencyEmber({
  count,
  reducedLabel,
}: {
  count: number;
  reducedLabel?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    const onVisibility = () => setPageVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    let observer: IntersectionObserver | undefined;
    if (node && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) =>
        setInView(entry?.isIntersecting ?? true),
      );
      observer.observe(node);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []);

  const safeCount = Math.max(0, Math.floor(count));
  const band = bandFor(safeCount);
  const playing = !reduced && inView && pageVisible && band > 0;
  const display = safeCount >= DISPLAY_CAP ? "12+" : String(safeCount);
  const noun = safeCount === 1 ? "LIVE CHECK-IN" : "LIVE CHECK-INS";
  const text = reducedLabel ?? `${display} ${noun} · 90 DAYS`;
  const flameOrigin = { transformBox: "fill-box", transformOrigin: "50% 100%" } as const;

  return (
    // Display-only module — never intercept pointer events meant for
    // neighboring controls (e.g. the Cards/Timeline toggle).
    <div
      ref={ref}
      className="pointer-events-none inline-flex items-center"
      style={{ gap: 12 }}
    >
      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-full"
        style={{
          width: 64,
          height: 64,
          flex: "none",
          border: "1px solid rgba(244,241,234,0.10)",
          background: "var(--color-surface)",
        }}
      >
        {/* ember bloom, strictly inside the module (rgba of --color-ember) */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 64%, rgba(255,101,55,${GLOW_ALPHA[band]}) 0%, transparent 68%)`,
          }}
        />
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" fill="none">
          {band === 0 ? (
            // dim static outline — quiet, never shaming, no embers
            <path d={OUTER_FLAME} stroke="var(--color-ember)" strokeWidth={1.5} opacity={FLAME_ALPHA[0]} />
          ) : (
            <>
              <motion.path
                d={OUTER_FLAME}
                fill="var(--color-ember)"
                opacity={FLAME_ALPHA[band] * 0.85}
                style={flameOrigin}
                animate={
                  playing
                    ? { scaleY: [1, 1.045, 0.985, 1], rotate: [-1.2, 1.1, -0.5, -1.2] }
                    : { scaleY: 1, rotate: 0 }
                }
                transition={
                  playing
                    ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.2 }
                }
              />
              <motion.path
                d={INNER_FLAME}
                fill="var(--color-ember-hot)"
                style={flameOrigin}
                animate={
                  playing
                    ? { opacity: [0.8, 1, 0.65, 0.92, 0.8], scaleY: [1, 1.06, 0.94, 1.02, 1] }
                    : { opacity: 0.85, scaleY: 1 }
                }
                transition={
                  playing
                    ? { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }
                    : { duration: 0.2 }
                }
              />
              {/* warm core */}
              <circle cx={32} cy={41} r={2.6} fill="var(--color-paper)" opacity={0.45} />
              {/* embers stay mounted (hydration-safe) but only ever move when playing */}
              {EMBERS.slice(0, EMBER_COUNT[band]).map((ember) => (
                <motion.circle
                  key={`${ember.x}-${ember.delay}`}
                  cx={ember.x}
                  cy={ember.y0}
                  r={ember.r}
                  fill="var(--color-ember)"
                  initial={{ opacity: 0, y: 0 }}
                  animate={
                    playing
                      ? { y: [0, -ember.rise], opacity: [0, 0.85, 0] }
                      : { y: 0, opacity: 0 }
                  }
                  transition={
                    playing
                      ? { duration: ember.dur, delay: ember.delay, repeat: Infinity, ease: "easeOut" }
                      : { duration: 0.15 }
                  }
                />
              ))}
            </>
          )}
        </svg>
      </div>
      <span className="micro" style={{ color: "var(--color-text-muted)" }}>
        {text}
      </span>
    </div>
  );
}
