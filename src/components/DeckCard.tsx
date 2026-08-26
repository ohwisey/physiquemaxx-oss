"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { angleCount, type CheckIn } from "@/lib/types";
import { cardPose, CARD_RADIUS } from "@/lib/geometry";
import {
  isHistorical,
  scoreVisible,
  stateColor,
  stateLabel,
} from "@/lib/checkin-meta";

/**
 * One physical card in the layered deck. Purely presentational — all gesture
 * handling lives in the Deck. Every transform derives from the deck's single
 * virtualIndex motion value (GPU transforms + opacity only).
 *
 * Edge info (§3 + binding matrix §5): date/owner top-left; state OR
 * score+delta top-right (score only when analysisStatus === "complete");
 * angle count bottom-left; one VIEW ANALYSIS affordance bottom-right.
 * Scrims stay localized to the labels — nothing crosses the body.
 */
export function DeckCard({
  item,
  index,
  vi,
  exitY,
  cardW,
  cardH,
  eager,
  radius = CARD_RADIUS,
  showOwner = false,
  demo = false,
  analyzing = false,
}: {
  item: CheckIn;
  index: number;
  vi: MotionValue<number>;
  exitY: number;
  cardW: number;
  cardH: number;
  eager: boolean;
  radius?: number;
  /** show the owner under the date (US scope) */
  showOwner?: boolean;
  /** persistent DEMO chip (state matrix "Demo" row) */
  demo?: boolean;
  /** an analysis request for this record is in flight */
  analyzing?: boolean;
}) {
  const y = useTransform(vi, (v) => cardPose(index - v, exitY).y);
  const scale = useTransform(vi, (v) => cardPose(index - v, exitY).scale);
  const opacity = useTransform(vi, (v) => cardPose(index - v, exitY).opacity);
  const dark = useTransform(vi, (v) => cardPose(index - v, exitY).dark);
  const zIndex = useTransform(vi, (v) => cardPose(index - v, exitY).z);
  // Meta is only legible on the active (and exiting) card — rear caps stay
  // clean photo strips, as in the reference.
  const metaOpacity = useTransform(vi, (v) => {
    const rel = index - v;
    return rel <= 0 ? 1 : Math.max(0, 1 - rel * 1.7);
  });

  const [day, month] = item.date
    ? [item.date.slice(8, 10).replace(/^0/, ""), monthOf(item.date)]
    : ["", ""];
  const label = stateLabel(item, analyzing);
  const showScore = label === null && scoreVisible(item, analyzing);
  const angles = angleCount(item);

  return (
    <motion.div
      className="card-finish absolute overflow-hidden bg-raised"
      style={{
        width: cardW,
        height: cardH,
        left: `calc(50% - ${cardW / 2}px)`,
        top: 0,
        y,
        scale,
        opacity,
        zIndex,
        borderRadius: radius,
        transformOrigin: "center top",
        willChange: "transform",
      }}
    >
      <motion.div
        layoutId={`hero-${item.id}`}
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: radius }}
        transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Private short-lived signed URLs + GPU-transformed cards —
            next/image optimization does not apply here. A recovered check-in
            may have no front photo: show a neutral tile, never another view. */}
        {item.photos.front ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photos.front}
            alt={`${item.owner} front, ${item.date}`}
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "var(--color-surface)" }}
          >
            <span className="micro text-mute">FRONT UNAVAILABLE</span>
          </div>
        )}
      </motion.div>

      {/* localized scrims for label legibility only */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 104,
          background:
            "linear-gradient(to bottom, rgba(3,3,3,0.55), rgba(3,3,3,0))",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: 96,
          background:
            "linear-gradient(to top, rgba(3,3,3,0.72), rgba(3,3,3,0))",
        }}
      />

      {/* top edge — date/owner left, state or honest score right */}
      <motion.div
        className="absolute inset-x-0 top-0 flex items-start justify-between p-4"
        style={{ opacity: metaOpacity }}
      >
        <div className="flex flex-col">
          <span
            className="masthead text-bone"
            style={{ fontSize: 26, lineHeight: 0.95 }}
          >
            {day}
          </span>
          <span
            className="masthead text-bone"
            style={{ fontSize: 15, lineHeight: 1.2 }}
          >
            {month}
          </span>
          {showOwner && (
            <span className="micro mt-1 text-bone/70">
              {item.owner.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex max-w-[60%] flex-col items-end text-right">
          {showScore ? (
            <>
              <span
                className="masthead text-bone"
                style={{ fontSize: 28, lineHeight: 1 }}
              >
                {item.rating}
              </span>
              {item.delta !== null && item.delta !== 0 && (
                <span
                  className="micro mt-0.5"
                  style={{
                    color:
                      item.delta > 0
                        ? "var(--color-positive)"
                        : "var(--color-priority)",
                  }}
                >
                  {item.delta > 0 ? `+${item.delta}` : item.delta}
                </span>
              )}
            </>
          ) : (
            <span
              className="micro leading-relaxed"
              style={{ color: stateColor(label ?? "") }}
            >
              {label}
            </span>
          )}
        </div>
      </motion.div>

      {/* persistent DEMO chip — never fades with the meta */}
      {demo && (
        <span
          className="micro absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-2.5 py-1"
          style={{
            background: "rgba(7, 8, 7, 0.72)",
            border: "1px solid var(--color-ember)",
            color: "var(--color-ember)",
          }}
        >
          DEMO
        </span>
      )}

      {/* bottom edge — angle count (+ provenance) left, one affordance right */}
      <motion.div
        className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4"
        style={{ opacity: metaOpacity }}
      >
        <div className="flex items-center gap-2">
          <span className="micro text-bone/80">
            {angles} {angles === 1 ? "ANGLE" : "ANGLES"}
          </span>
          {isHistorical(item) && (
            <span
              className="micro rounded-full px-2 py-0.5"
              style={{
                border: "1px solid rgba(244,241,234,0.28)",
                color: "rgba(244,241,234,0.75)",
              }}
            >
              HISTORICAL
            </span>
          )}
        </div>
        <span className="micro flex items-center gap-1.5 text-bone/85">
          VIEW ANALYSIS
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path
              d="M1 5h8M5.5 1.5L9 5l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </motion.div>

      {/* depth darkening overlay (animated by opacity, never by filter) */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-ink"
        style={{ opacity: dark }}
      />
    </motion.div>
  );
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function monthOf(date: string): string {
  const m = Number(date.slice(5, 7));
  return MONTHS[m - 1] ?? "";
}
