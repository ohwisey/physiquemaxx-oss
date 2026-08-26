"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { mastheadDate, type CheckIn } from "@/lib/types";
import {
  isHistorical,
  scoreVisible,
  stateColor,
  stateLabel,
} from "@/lib/checkin-meta";

/**
 * The mobile vertical archive (Cards/Timeline toggle, §3): date thumbnails
 * with clear states straight from the binding matrix. Scores and deltas
 * appear only where they are honest. Tapping a row opens the same
 * DetailView as the deck.
 */
export function TimelineList({
  items,
  top,
  showOwner,
  demo = false,
  analyzingId,
  onOpen,
  onLoadMore,
}: {
  items: CheckIn[];
  /** y where the list begins (below the header stack) */
  top: number;
  /** show owner chips (US scope) */
  showOwner: boolean;
  demo?: boolean;
  analyzingId?: string | null;
  onOpen: (item: CheckIn) => void;
  /** present only when older records can be paged in */
  onLoadMore?: () => Promise<void>;
}) {
  const reduced = useReducedMotion();
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = async () => {
    if (!onLoadMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-10 overflow-y-auto px-4"
      style={{ top, paddingBottom: 140 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.18, ease: "easeOut" }}
    >
      <ul className="flex flex-col">
        {items.map((item) => {
          const analyzing = analyzingId === item.id;
          const label = stateLabel(item, analyzing);
          const showScore = label === null && scoreVisible(item, analyzing);
          return (
            <li key={item.id}>
              <button
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-3.5 border-b py-3 text-left"
                style={{ minHeight: 72, borderColor: "var(--pm-border)" }}
              >
                {/* 56px front thumb (signed URL) */}
                <span
                  className="relative block shrink-0 overflow-hidden rounded-xl"
                  style={{ width: 56, height: 56, background: "var(--color-surface)" }}
                >
                  {item.photos.front && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photos.front}
                      alt=""
                      className="absolute inset-0 h-full w-full select-none object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline gap-2">
                    <span
                      className="text-[15px] font-medium text-bone"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {mastheadDate(item.date)}
                    </span>
                    <span
                      className="micro text-mute"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {item.date.slice(0, 4)}
                    </span>
                    {showOwner && (
                      <span
                        className="micro rounded-full px-2 py-0.5"
                        style={{
                          border: "1px solid rgba(244,241,234,0.22)",
                          color: "rgba(244,241,234,0.7)",
                        }}
                      >
                        {item.owner.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {showScore ? (
                      <>
                        <span
                          className="masthead text-bone"
                          style={{ fontSize: 17, lineHeight: 1 }}
                        >
                          {item.rating}
                        </span>
                        {item.delta !== null && item.delta !== 0 && (
                          <span
                            className="micro"
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
                        className="micro truncate"
                        style={{ color: stateColor(label ?? "") }}
                      >
                        {label}
                      </span>
                    )}
                    {isHistorical(item) && (
                      <span
                        className="micro shrink-0 rounded-full px-2 py-0.5"
                        style={{
                          border: "1px solid rgba(244,241,234,0.22)",
                          color: "rgba(244,241,234,0.65)",
                        }}
                      >
                        HISTORICAL
                      </span>
                    )}
                    {demo && (
                      <span
                        className="micro shrink-0 rounded-full px-2 py-0.5"
                        style={{
                          border: "1px solid var(--color-ember)",
                          color: "var(--color-ember)",
                        }}
                      >
                        DEMO
                      </span>
                    )}
                  </span>
                </span>

                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                  className="shrink-0"
                >
                  <path
                    d="M4 2l4 4-4 4"
                    stroke="rgba(244,241,234,0.4)"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      {onLoadMore && (
        <button
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="micro-11 mt-3 w-full rounded-full border py-3.5 text-bone/75"
          style={{ minHeight: 48, borderColor: "rgba(243,241,237,0.18)" }}
        >
          {loadingMore ? "LOADING…" : "LOAD MORE"}
        </button>
      )}
    </motion.div>
  );
}
