"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type { CheckIn } from "@/lib/types";
import {
  AMBIENT_TRIGGER,
  CANCEL_DURATION,
  COMMIT_DISTANCE,
  COMMIT_MIN_TRAVEL,
  COMMIT_VELOCITY,
  RUBBER_LIMIT,
  WHIP_DURATION,
  WHIP_EASE,
  rubberBand,
} from "@/lib/geometry";
import { DeckCard } from "./DeckCard";

type Mode = "rest" | "drag" | "settle";

/**
 * The layered vertical deck. A single virtualIndex motion value drives every
 * mounted card's transform (see geometry.ts). Pull down → next older (the
 * active card tracks the finger 1:1 and, on commit, whips straight down and
 * off screen while the rear stack advances). Swipe up → the previous card
 * rises from below. Wheel and ArrowUp/Down mirror the gesture. Scope
 * switching never whips — the deck re-seats instantly on scopeKey change.
 */
export function Deck({
  items,
  activeIndex,
  scopeKey,
  exitY,
  cardW,
  cardH,
  deckTop,
  enabled,
  cardRadius,
  showOwner,
  demo,
  analyzingId,
  onNavigate,
  onAmbientTarget,
  onOpenActive,
}: {
  items: CheckIn[];
  activeIndex: number;
  scopeKey: string;
  exitY: number;
  cardW: number;
  cardH: number;
  deckTop: number;
  enabled: boolean;
  /** active-card corner radius (layout-owned; defaults inside DeckCard) */
  cardRadius?: number;
  /** show the owner under the date on each card (US scope) */
  showOwner?: boolean;
  /** persistent DEMO chip on every card */
  demo?: boolean;
  /** id of the record with an analysis request in flight */
  analyzingId?: string | null;
  /** called at commit start with the new index (date changes here) */
  onNavigate: (index: number) => void;
  /** called when drag progress crosses ±30% (ambient crossfade begins) */
  onAmbientTarget: (index: number) => void;
  onOpenActive: (index: number) => void;
}) {
  const reduced = useReducedMotion();
  const vi = useMotionValue(activeIndex);
  const mode = useRef<Mode>("rest");
  const base = useRef(activeIndex); // committed index the gesture started from
  const gesture = useRef({
    id: -1,
    startX: 0,
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
    axis: "none" as "none" | "vertical" | "dead",
  });
  const ambientSent = useRef(activeIndex);
  const wheelAcc = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seat instantly on scope switch (never whip through cards).
  const seatKey = useRef(scopeKey);
  useEffect(() => {
    if (seatKey.current !== scopeKey) {
      seatKey.current = scopeKey;
      vi.jump(activeIndex);
      base.current = activeIndex;
      ambientSent.current = activeIndex;
      mode.current = "rest";
    }
  }, [scopeKey, activeIndex, vi]);

  // Ambient 30% rule during drag (and clean reversal on cancel).
  useMotionValueEvent(vi, "change", (v) => {
    const frac = v - base.current;
    let target = base.current;
    if (frac >= AMBIENT_TRIGGER) target = base.current + 1;
    else if (frac <= -AMBIENT_TRIGGER) target = base.current - 1;
    target = Math.min(items.length - 1, Math.max(0, target));
    if (target !== ambientSent.current) {
      ambientSent.current = target;
      onAmbientTarget(target);
    }
  });

  const settleTo = (target: number) => {
    mode.current = "settle";
    base.current = target;
    onNavigate(target);
    if (reduced) {
      vi.jump(target);
      mode.current = "rest";
      return;
    }
    animate(vi, target, {
      duration: WHIP_DURATION,
      ease: WHIP_EASE,
      onComplete: () => {
        mode.current = "rest";
      },
    });
  };

  const cancelTo = (origin: number) => {
    mode.current = "settle";
    animate(vi, origin, {
      duration: reduced ? 0 : CANCEL_DURATION,
      ease: [0.3, 0, 0.3, 1],
      onComplete: () => {
        mode.current = "rest";
      },
    });
  };

  const step = (dir: 1 | -1) => {
    if (!enabled || mode.current !== "rest") return;
    const target = base.current + dir;
    if (target < 0 || target > items.length - 1) return;
    settleTo(target);
  };

  // ---- pointer gestures (touch + mouse drag) ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || mode.current === "settle") return;
    const g = gesture.current;
    g.id = e.pointerId;
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;
    g.velocity = 0;
    g.axis = "none";
    mode.current = "drag";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (mode.current !== "drag" || e.pointerId !== g.id) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.axis === "none") {
      if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        g.axis = "vertical";
      } else if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        g.axis = "dead"; // clearly horizontal — this deck never moves sideways
      }
    }
    if (g.axis !== "vertical") return;

    const dt = Math.max(1, e.timeStamp - g.lastT);
    const inst = ((e.clientY - g.lastY) / dt) * 1000;
    g.velocity = 0.75 * inst + 0.25 * g.velocity;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;

    const atNewest = base.current <= 0;
    const atOldest = base.current >= items.length - 1;
    let dEff: number;
    if ((dy < 0 && atNewest) || (dy > 0 && atOldest)) {
      dEff = rubberBand(dy, 0, 0.12); // hard boundary resistance
    } else {
      dEff = rubberBand(dy, RUBBER_LIMIT);
    }
    vi.set(base.current + dEff / (exitY - 42));
  };

  const endGesture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (mode.current !== "drag" || e.pointerId !== g.id) return;
    g.id = -1;
    const dy = e.clientY - g.startY;
    const dx = e.clientX - g.startX;

    if (g.axis !== "vertical") {
      mode.current = "rest";
      // A still tap on the active card opens the detail.
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6 && e.type !== "pointercancel") {
        onOpenActive(base.current);
      }
      return;
    }

    const travel = Math.abs(dy);
    const fast =
      Math.abs(g.velocity) >= COMMIT_VELOCITY &&
      travel >= COMMIT_MIN_TRAVEL &&
      Math.sign(g.velocity) === Math.sign(dy);
    const commit = travel >= COMMIT_DISTANCE || fast;
    const dir = dy > 0 ? 1 : -1;
    const target = base.current + dir;

    if (commit && target >= 0 && target <= items.length - 1) {
      settleTo(target);
    } else {
      cancelTo(base.current);
    }
  };

  // ---- wheel + keyboard ----
  useEffect(() => {
    if (!enabled) return;
    const onWheel = (e: WheelEvent) => {
      if (mode.current !== "rest") return;
      wheelAcc.current += e.deltaY;
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      if (Math.abs(wheelAcc.current) >= 110) {
        const dir = wheelAcc.current > 0 ? 1 : -1;
        wheelAcc.current = 0;
        step(dir);
      } else {
        wheelTimer.current = setTimeout(() => {
          wheelAcc.current = 0;
        }, 180);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, items.length]);

  // Mounted window: previous, current, next, next+2, hidden next+3.
  const lo = Math.max(0, activeIndex - 1);
  const hi = Math.min(items.length - 1, activeIndex + 3);
  const mounted = items.slice(lo, hi + 1).map((item, i) => ({
    item,
    index: lo + i,
  }));

  return (
    <motion.div
      className="absolute inset-x-0"
      style={{
        top: deckTop,
        height: cardH + 60,
        touchAction: "none",
        zIndex: 20,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {mounted.map(({ item, index }) => (
        <DeckCard
          key={item.id}
          item={item}
          index={index}
          vi={vi}
          exitY={exitY}
          cardW={cardW}
          cardH={cardH}
          eager={Math.abs(index - activeIndex) <= 2}
          radius={cardRadius}
          showOwner={showOwner}
          demo={demo}
          analyzing={analyzingId === item.id}
        />
      ))}
    </motion.div>
  );
}
