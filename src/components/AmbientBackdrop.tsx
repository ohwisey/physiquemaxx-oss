"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Palette } from "@/lib/types";

/**
 * Quiet ambient field over the upper two-thirds of the canvas.
 *
 * mode "empty": no photo exists, so no photo-derived color (spec §3) — just
 * the near-black canvas with a restrained ember bloom at top-center.
 *
 * mode "photo": two crossfading layers tinted by the active FRONT photo's
 * palette at 10–18% intensity. Saturation and luminance are clamped hard so
 * the field reads as cast light, never a color wash, and a soft mask fades
 * everything out with no hard horizon line.
 *
 * The A/B crossfade is render-derived (no setState-in-render loops beyond
 * the single palette-change reduction); reduced motion swaps near-instantly.
 */

const NEUTRAL: Palette = { top: "#5a5a56", mid: "#48443e", bottom: "#363330" };

/** hex → hard-clamped hsl components (saturation ≤ 0.38, lightness 0.14–0.42) */
function clampTone(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  s = Math.min(s, 0.38);
  const l2 = Math.min(0.42, Math.max(0.14, l));
  return { h, s, l: l2 };
}

function tint(hex: string, alpha: number): string {
  const { h, s, l } = clampTone(hex);
  return `hsla(${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%, ${alpha})`;
}

/** 10–18% intensity, strongest at the very top, long smooth falloff. */
function photoGradient(p: Palette): string {
  return `radial-gradient(150% 120% at 50% -12%, ${tint(p.top, 0.18)} 0%, ${tint(p.mid, 0.12)} 38%, ${tint(p.bottom, 0.06)} 60%, transparent 82%)`;
}

const MASK =
  "linear-gradient(to bottom, black 0%, black 32%, rgba(0,0,0,0.55) 62%, transparent 98%)";

export function AmbientBackdrop({
  mode,
  palette,
  height,
}: {
  mode: "empty" | "photo";
  palette?: Palette;
  /** field height; defaults to the upper two-thirds of the viewport */
  height?: number;
}) {
  const reduced = useReducedMotion();
  const target = mode === "photo" ? (palette ?? NEUTRAL) : NEUTRAL;

  // Two-layer A/B buffer: the incoming palette fades in on the top layer,
  // then becomes the base. Derived during render (never a sync set in an
  // effect); only the settle timer lives in an effect.
  const [layers, setLayers] = useState<{ base: Palette; top: Palette | null }>({
    base: target,
    top: null,
  });
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = layers.top ?? layers.base;
  if (
    mode === "photo" &&
    (current.top !== target.top || current.mid !== target.mid)
  ) {
    setLayers({ base: current, top: target });
  }

  const topKey = layers.top ? layers.top.top + layers.top.mid : null;
  useEffect(() => {
    if (!topKey) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      setLayers((prev) => (prev.top ? { base: prev.top, top: null } : prev));
    }, 560);
    return () => {
      if (settle.current) clearTimeout(settle.current);
    };
  }, [topKey]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0"
      style={{
        height: height ?? "66dvh",
        WebkitMaskImage: MASK,
        maskImage: MASK,
      }}
    >
      {mode === "empty" ? (
        // Empty state owns a single, centered bloom in EmptyLibrary — no
        // second screen-wide glow here, so the two never clash.
        null
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: photoGradient(layers.base) }}
          />
          {layers.top && (
            <motion.div
              key={layers.top.top + layers.top.mid}
              className="absolute inset-0"
              style={{ background: photoGradient(layers.top) }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0.01 : 0.52, ease: "easeOut" }}
            />
          )}
        </>
      )}
    </div>
  );
}
