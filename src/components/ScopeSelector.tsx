"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Scope } from "@/lib/types";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "luke", label: "LUKE" },
  { key: "rowan", label: "ROWAN" },
  { key: "us", label: "US" },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const CONTROL_H = 52; // visible height (§3)
const PAD = 4; // inner padding → 44px pill/hit rows

/**
 * Slim near-black rounded scope control (§3 shell). Sits 16px from both
 * sides; visible 52px with full-height 44px+ hit areas. The active pill
 * slides 260ms, non-bouncy. Arrow keys move between scopes (roving tabs).
 */
export function ScopeSelector({
  scope,
  onChange,
  width,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
  width: number;
}) {
  const reduced = useReducedMotion();
  const tabs = useRef<Partial<Record<Scope, HTMLButtonElement | null>>>({});
  const idx = SCOPES.findIndex((s) => s.key === scope);
  const seg = (width - PAD * 2) / 3;

  const move = (dir: 1 | -1) => {
    const next = SCOPES[(idx + dir + SCOPES.length) % SCOPES.length];
    onChange(next.key);
    tabs.current[next.key]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Library scope"
      className="relative mx-auto"
      style={{
        width,
        height: CONTROL_H,
        padding: PAD,
        borderRadius: CONTROL_H / 2,
        background: "rgba(9, 10, 9, 0.88)",
        border: "1px solid var(--pm-border)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          move(e.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      {/* sliding active pill — transform only, 260ms, non-bouncy */}
      <motion.div
        aria-hidden
        className="absolute"
        style={{
          top: PAD,
          left: PAD,
          width: seg,
          height: CONTROL_H - PAD * 2,
          borderRadius: (CONTROL_H - PAD * 2) / 2,
          background: "var(--color-surface-raised)",
          border: "1px solid var(--pm-border-strong)",
        }}
        initial={false}
        animate={{ x: idx * seg }}
        transition={reduced ? { duration: 0 } : { duration: 0.26, ease: EASE }}
      />

      <div className="relative flex h-full">
        {SCOPES.map((s) => {
          const active = s.key === scope;
          return (
            <button
              key={s.key}
              ref={(el) => {
                tabs.current[s.key] = el;
              }}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className="micro-11 flex h-full flex-1 select-none items-center justify-center"
              style={{
                minHeight: 44,
                borderRadius: (CONTROL_H - PAD * 2) / 2,
                color: active ? "var(--color-text)" : "var(--color-text-muted)",
                transition: "color 200ms ease",
              }}
              onClick={() => onChange(s.key)}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
