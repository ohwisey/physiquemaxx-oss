"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  angleCount,
  mastheadDate,
  type CheckIn,
  type Owner,
  type Scope,
  type ViewAngle,
} from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis/types";
import {
  isHistorical,
  scoreVisible,
  stateColor,
  stateLabel,
} from "@/lib/checkin-meta";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ScopeSelector } from "./ScopeSelector";
import { ConsistencyEmber } from "./ConsistencyEmber";
import { ViewToggle } from "./ViewToggle";
import { EmptyLibrary } from "./EmptyLibrary";
import { TimelineList } from "./TimelineList";
import { AnalysisSnapshot } from "./AnalysisSnapshot";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const ANGLES: ViewAngle[] = ["front", "left", "back", "right"];
/** useful canvas cap (§4: roughly 1440–1600px; atmosphere fills the rest) */
const CANVAS_MAX = 1600;
const RAIL_W = 240;
const SNAPSHOT_W = 360;

/**
 * The desktop archive workspace (§4): top bar over three zones — 240px
 * archive rail, dominant photo stage, 360px warm-paper analysis snapshot.
 * ≥1024px renders all three side by side; 768–1023px turns the rail into a
 * drawer and stacks stage + snapshot. ArrowUp/Down (and Left/Right) move
 * exactly ONE archive record (§7); the stage swaps with a 180ms crossfade.
 */
export function DesktopWorkspace({
  items,
  scope,
  onScopeChange,
  view,
  onViewChange,
  activeIndex,
  onNavigate,
  analyses,
  archiveTitle,
  showOwner,
  demo,
  analyzingId,
  momentumCount,
  showEmber,
  emptyVariant,
  partnerName,
  me,
  onRequestAnalysis,
  onFetchAnalysis,
  onLoadMore,
  onOpenDetail,
  onAdd,
  onProfile,
  onEnterDemo,
  keysEnabled,
  drawer,
}: {
  items: CheckIn[];
  scope: Scope;
  onScopeChange: (s: Scope) => void;
  view: "cards" | "timeline";
  onViewChange: (v: "cards" | "timeline") => void;
  activeIndex: number;
  onNavigate: (index: number) => void;
  analyses: Record<string, AnalysisResult>;
  archiveTitle: string;
  /** owner chips on rows/stage (US scope) */
  showOwner: boolean;
  demo: boolean;
  analyzingId: string | null;
  momentumCount: number;
  showEmber: boolean;
  emptyVariant: "own" | "partner" | "us";
  partnerName: string | null;
  /** the signed-in member — only their records can run an analysis */
  me: Owner;
  onRequestAnalysis?: (checkinId: string) => Promise<void>;
  onFetchAnalysis?: (checkinId: string) => Promise<AnalysisResult | null>;
  onLoadMore?: () => Promise<void>;
  onOpenDetail: (item: CheckIn) => void;
  onAdd: () => void;
  onProfile: () => void;
  onEnterDemo?: () => void;
  /** arrow-key record navigation is live (no sheet/detail open) */
  keysEnabled: boolean;
  /** tablet (768–1023): rail becomes a toggleable drawer; zones stack */
  drawer: boolean;
}) {
  const reduced = useReducedMotion();
  const [railOpen, setRailOpen] = useState(false);

  const active =
    items.length > 0 ? (items[Math.min(activeIndex, items.length - 1)] ?? null) : null;

  // §7: keyboard moves exactly ONE archive record per keypress.
  useEffect(() => {
    if (!keysEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      const dir =
        e.key === "ArrowDown" || e.key === "ArrowRight"
          ? 1
          : e.key === "ArrowUp" || e.key === "ArrowLeft"
            ? -1
            : 0;
      if (dir === 0 || items.length === 0) return;
      e.preventDefault();
      const next = Math.max(0, Math.min(items.length - 1, activeIndex + dir));
      if (next !== activeIndex) onNavigate(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keysEnabled, items.length, activeIndex, onNavigate]);

  // The library page loads summary columns only — pull the full result on
  // demand once per selected record (merged upstream into `analyses`).
  const fetched = useRef<Set<string>>(new Set());
  const activeId = active?.id ?? null;
  useEffect(() => {
    if (!activeId || !onFetchAnalysis) return;
    if (analyses[activeId] || fetched.current.has(activeId)) return;
    fetched.current.add(activeId);
    onFetchAnalysis(activeId).catch(() => {
      fetched.current.delete(activeId);
    });
  }, [activeId, onFetchAnalysis, analyses]);

  const activeAnalyzing = active !== null && analyzingId === active.id;
  // Analysis is a CREATOR right, not a subject one: prefer the loaded
  // `canAnalyze` (creator === me); fall back to owner === me while the data
  // layer is still landing the field.
  const canAnalyze =
    active !== null &&
    Boolean(onRequestAnalysis) &&
    ((active as { canAnalyze?: boolean }).canAnalyze ?? active.owner === me) &&
    !demo;

  const rail = (
    <Rail
      title={archiveTitle}
      items={items}
      activeIndex={activeIndex}
      showOwner={showOwner}
      showEmber={showEmber}
      momentumCount={momentumCount}
      demo={demo}
      analyzingId={analyzingId}
      onSelect={(i) => {
        onNavigate(i);
        setRailOpen(false);
      }}
      onLoadMore={onLoadMore}
    />
  );

  const snapshot = active && (
    <AnalysisSnapshot
      key={active.id}
      item={active}
      analysis={analyses[active.id] ?? null}
      analyzing={activeAnalyzing}
      isLatest={activeIndex === 0}
      demo={demo}
      canAnalyze={canAnalyze}
      onRequestAnalysis={
        canAnalyze && onRequestAnalysis
          ? () => onRequestAnalysis(active.id)
          : undefined
      }
      onViewAnalysis={() => onOpenDetail(active)}
      onAddPhotos={onAdd}
      width={drawer ? "100%" : SNAPSHOT_W}
    />
  );

  return (
    <div className="absolute inset-0 z-10 flex flex-col">
      {/* ---------------------------------------------------------- top bar */}
      <header
        className="relative z-30 shrink-0"
        style={{
          height: 64,
          borderBottom: "1px solid var(--pm-border)",
          background: "rgba(7, 8, 7, 0.55)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <div
          className="relative mx-auto flex h-full w-full items-center gap-3 px-5"
          style={{ maxWidth: CANVAS_MAX }}
        >
          {drawer && (
            <button
              aria-label="Open archive list"
              aria-expanded={railOpen}
              onClick={() => setRailOpen(true)}
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{ width: 44, height: 44, border: "1px solid var(--pm-border)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2 4h12M2 8h12M2 12h12"
                  stroke="#F3F1ED"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}

          <span
            className="masthead shrink-0 select-none text-bone"
            style={{ fontSize: 22, letterSpacing: "0.01em" }}
          >
            PHYSIQUE
            <span style={{ color: "var(--color-ember)" }}>/</span>
            MAXX
          </span>

          {drawer ? (
            <div className="flex min-w-0 flex-1 justify-center">
              <ScopeSelector scope={scope} onChange={onScopeChange} width={300} />
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
              <div className="pointer-events-auto">
                <ScopeSelector scope={scope} onChange={onScopeChange} width={342} />
              </div>
            </div>
          )}

          <div
            className={`flex shrink-0 items-center gap-3 ${drawer ? "" : "ml-auto"}`}
          >
            <ViewToggle view={view} onChange={onViewChange} />
            {drawer ? (
              <button
                aria-label="Add photos"
                onClick={onAdd}
                className="flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: "var(--color-ember)" }}
              >
                <AddGlyph />
              </button>
            ) : (
              <button
                onClick={onAdd}
                className="micro-11 flex items-center gap-2 rounded-full px-5"
                style={{
                  height: 44,
                  background: "var(--color-ember)",
                  color: "var(--color-canvas)",
                }}
              >
                <AddGlyph />
                ADD PHOTOS
              </button>
            )}
            <button
              aria-label="Profile"
              onClick={onProfile}
              className="flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, border: "1px solid var(--pm-border-strong)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="5.2" r="2.6" stroke="#F3F1ED" strokeWidth="1.3" />
                <path
                  d="M2.8 14c.7-2.9 2.6-4.4 5.2-4.4s4.5 1.5 5.2 4.4"
                  stroke="#F3F1ED"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ zones */}
      {view === "timeline" ? (
        <div className="relative mx-auto min-h-0 w-full flex-1" style={{ maxWidth: 760 }}>
          <TimelineList
            key={`timeline-${scope}`}
            items={items}
            top={12}
            showOwner={showOwner}
            demo={demo}
            analyzingId={analyzingId}
            onOpen={onOpenDetail}
            onLoadMore={onLoadMore}
          />
        </div>
      ) : items.length === 0 ? (
        <div
          className="mx-auto flex min-h-0 w-full flex-1 gap-5 p-5"
          style={{ maxWidth: CANVAS_MAX }}
        >
          {!drawer && rail}
          <section className="relative min-w-0 flex-1">
            <EmptyLibrary
              key={`empty-${scope}`}
              variant={emptyVariant}
              partnerName={partnerName}
              top={0}
              onAdd={emptyVariant === "own" ? onAdd : undefined}
              onViewExample={onEnterDemo}
            />
          </section>
        </div>
      ) : drawer ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className="mx-auto flex w-full flex-col gap-5 p-5"
            style={{ maxWidth: 900 }}
          >
            <section
              className="relative flex justify-center"
              style={{ height: "min(62vh, 640px)" }}
            >
              {active && (
                <Stage
                  item={active}
                  showOwner={showOwner}
                  demo={demo}
                  analyzing={activeAnalyzing}
                  onOpen={() => onOpenDetail(active)}
                  reduced={!!reduced}
                />
              )}
            </section>
            <div className="mx-auto w-full" style={{ maxWidth: 640 }}>
              {snapshot}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mx-auto flex min-h-0 w-full flex-1 gap-5 p-5"
          style={{ maxWidth: CANVAS_MAX }}
        >
          {rail}
          <section className="relative flex min-w-0 flex-1 items-center justify-center">
            {active && (
              <Stage
                item={active}
                showOwner={showOwner}
                demo={demo}
                analyzing={activeAnalyzing}
                onOpen={() => onOpenDetail(active)}
                reduced={!!reduced}
              />
            )}
          </section>
          {snapshot}
        </div>
      )}

      {/* --------------------------------------------------- tablet drawer */}
      <AnimatePresence>
        {drawer && railOpen && (
          <RailDrawer key="rail-drawer" onClose={() => setRailOpen(false)}>
            {rail}
          </RailDrawer>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------- archive rail */

function Rail({
  title,
  items,
  activeIndex,
  showOwner,
  showEmber,
  momentumCount,
  demo,
  analyzingId,
  onSelect,
  onLoadMore,
}: {
  title: string;
  items: CheckIn[];
  activeIndex: number;
  showOwner: boolean;
  showEmber: boolean;
  momentumCount: number;
  demo: boolean;
  analyzingId: string | null;
  onSelect: (index: number) => void;
  onLoadMore?: () => Promise<void>;
}) {
  const [loadingMore, setLoadingMore] = useState(false);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
    <aside
      className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-3xl"
      style={{
        width: RAIL_W,
        border: "1px solid var(--pm-border)",
        background: "rgba(13, 15, 13, 0.55)",
      }}
    >
      <div className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="micro" style={{ color: "var(--color-text-muted)" }}>
            {title}
          </p>
          {demo && (
            <span
              className="micro shrink-0 rounded-full px-2 py-0.5"
              style={{ border: "1px solid var(--color-ember)", color: "var(--color-ember)" }}
            >
              DEMO
            </span>
          )}
        </div>
        {showEmber && (
          <div className="mt-3">
            {/* desktop has room for the full label */}
            <ConsistencyEmber count={momentumCount} />
          </div>
        )}
      </div>

      <div
        role="listbox"
        aria-label={title}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
      >
        {items.length === 0 ? (
          <p className="micro px-2.5 pt-2" style={{ color: "var(--color-text-subtle)" }}>
            NO CHECK-INS YET
          </p>
        ) : (
          items.map((item, i) => {
            const selected = i === activeIndex;
            const analyzing = analyzingId === item.id;
            const label = stateLabel(item, analyzing);
            const showScore = label === null && scoreVisible(item, analyzing);
            return (
              <button
                key={item.id}
                ref={selected ? selectedRef : undefined}
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(i)}
                className="relative flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left"
                style={{
                  minHeight: 56,
                  background: selected ? "var(--color-surface-raised)" : "transparent",
                }}
              >
                {/* ember left edge on the selected record */}
                {selected && (
                  <span
                    aria-hidden
                    className="absolute left-0"
                    style={{
                      top: 13,
                      bottom: 13,
                      width: 3,
                      borderRadius: 2,
                      background: "var(--color-ember)",
                    }}
                  />
                )}
                <span
                  className="relative block shrink-0 overflow-hidden rounded-lg"
                  style={{ width: 40, height: 40, background: "var(--color-surface)" }}
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
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className="truncate text-[13px] font-medium text-bone"
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
                        className="micro shrink-0 rounded-full px-1.5 py-0.5"
                        style={{
                          border: "1px solid rgba(244,241,234,0.22)",
                          color: "rgba(244,241,234,0.7)",
                        }}
                      >
                        {item.owner.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    {showScore ? (
                      <>
                        <span
                          className="masthead text-bone"
                          style={{ fontSize: 15, lineHeight: 1 }}
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
                        className="micro shrink-0 rounded-full px-1.5 py-0.5"
                        style={{
                          border: "1px solid rgba(244,241,234,0.22)",
                          color: "rgba(244,241,234,0.65)",
                        }}
                      >
                        HISTORICAL
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })
        )}

        {onLoadMore && items.length > 0 && (
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="micro mt-1.5 w-full rounded-xl border py-3 text-bone/70"
            style={{ minHeight: 44, borderColor: "rgba(243,241,237,0.14)" }}
          >
            {loadingMore ? "LOADING…" : "LOAD MORE"}
          </button>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------ tablet drawer */

function RailDrawer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <motion.div
      className="fixed inset-0 z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: reduced ? 0.1 : 0.18 }}
    >
      <button
        aria-label="Close archive list"
        tabIndex={-1}
        className="absolute inset-0"
        style={{ background: "rgba(3, 3, 3, 0.6)" }}
        onClick={onClose}
      />
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Archive"
        tabIndex={-1}
        className="absolute bottom-0 left-0 top-0 p-3"
        style={{ width: RAIL_W + 24 }}
        initial={reduced ? { opacity: 0 } : { x: -(RAIL_W + 24) }}
        animate={reduced ? { opacity: 1 } : { x: 0 }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0.12 } }
            : { x: -(RAIL_W + 24), transition: { duration: 0.2 } }
        }
        transition={{ duration: reduced ? 0.12 : 0.24, ease: EASE }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------- photo stage */

function Stage({
  item,
  showOwner,
  demo,
  analyzing,
  onOpen,
  reduced,
}: {
  item: CheckIn;
  showOwner: boolean;
  demo: boolean;
  analyzing: boolean;
  onOpen: () => void;
  reduced: boolean;
}) {
  const label = stateLabel(item, analyzing);
  const showScore = label === null && scoreVisible(item, analyzing);
  const angles = angleCount(item);
  const day = item.date.slice(8, 10).replace(/^0/, "");
  const month = mastheadDate(item.date).split(" ")[1] ?? "";

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={item.id}
        className="card-finish relative overflow-hidden"
        style={{
          height: "100%",
          aspectRatio: "0.7",
          maxWidth: "100%",
          borderRadius: 28,
          border: "1px solid var(--pm-border-strong)",
          background: "var(--color-surface)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.12 : 0.18, ease: "easeOut" }}
      >
        {/* Private short-lived signed URLs — next/image optimization does not
            apply. A recovered check-in may have no front photo: show a neutral
            tile, never another view. */}
        {item.photos.front ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photos.front}
            alt={`${item.owner} front, ${item.date}`}
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
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

        {/* localized scrims for label legibility only */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: 132,
            background: "linear-gradient(to bottom, rgba(3,3,3,0.58), rgba(3,3,3,0))",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: 120,
            background: "linear-gradient(to top, rgba(3,3,3,0.72), rgba(3,3,3,0))",
          }}
        />

        {/* top-left — date (+ owner in US) */}
        <div className="absolute left-6 top-6 flex flex-col">
          <span className="masthead text-bone" style={{ fontSize: 44, lineHeight: 0.95 }}>
            {day}
          </span>
          <span className="masthead text-bone" style={{ fontSize: 24, lineHeight: 1.15 }}>
            {month}
          </span>
          <span className="micro mt-1 text-bone/60">{item.date.slice(0, 4)}</span>
          {showOwner && (
            <span className="micro mt-1 text-bone/70">{item.owner.toUpperCase()}</span>
          )}
        </div>

        {/* top-right — honest state OR score (§5) */}
        <div className="absolute right-6 top-6 flex max-w-[55%] flex-col items-end text-right">
          {showScore ? (
            <>
              <span className="masthead text-bone" style={{ fontSize: 40, lineHeight: 1 }}>
                {item.rating}
              </span>
              {item.delta !== null && item.delta !== 0 && (
                <span
                  className="micro mt-1"
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
              className="micro-11 leading-relaxed"
              style={{ color: stateColor(label ?? "") }}
            >
              {label}
            </span>
          )}
        </div>

        {/* persistent DEMO chip (state matrix "Demo" row) */}
        {demo && (
          <span
            className="micro absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-2.5 py-1"
            style={{
              background: "rgba(7, 8, 7, 0.72)",
              border: "1px solid var(--color-ember)",
              color: "var(--color-ember)",
            }}
          >
            DEMO
          </span>
        )}

        {/* bottom-left — angle count + slot chips */}
        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
          <span className="flex items-center gap-2">
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
          </span>
          <span className="flex gap-1.5" aria-hidden>
            {ANGLES.map((a) => (
              <StageAngleSlot key={a} filled={Boolean(item.photos[a])} />
            ))}
          </span>
        </div>

        {/* bottom-right — the one affordance */}
        <button
          onClick={onOpen}
          className="micro-11 absolute bottom-5 right-5 flex items-center gap-2 rounded-full px-5"
          style={{
            height: 44,
            background: "rgba(9, 10, 9, 0.72)",
            border: "1px solid var(--pm-border-strong)",
            color: "var(--color-text)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
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
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

function StageAngleSlot({ filled }: { filled: boolean }) {
  return (
    <span
      className="flex items-center justify-center rounded-md"
      style={{
        width: 26,
        height: 34,
        border: filled
          ? "1px solid rgba(244,241,234,0.5)"
          : "1px dashed rgba(244,241,234,0.18)",
        background: filled ? "rgba(9, 10, 9, 0.55)" : "rgba(9, 10, 9, 0.25)",
      }}
    >
      <svg
        width="10"
        height="18"
        viewBox="0 0 10 18"
        fill="none"
        stroke={filled ? "#F3F1ED" : "rgba(243,241,237,0.28)"}
        strokeWidth="1.1"
      >
        <circle cx="5" cy="2.6" r="1.8" />
        <path d="M5 5c-1.7 0-2.7 1-3 2.4L1.4 11h1.8l.5 6h2.6l.5-6h1.8l-.6-3.6C7.7 6 6.7 5 5 5Z" />
      </svg>
    </span>
  );
}

function AddGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1.5v11M1.5 7h11"
        stroke="var(--color-canvas)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------ desktop modal */

/**
 * Contained desktop modal (§4 add workspace / §7): a centered 760–940px panel
 * with backdrop, 220ms fade + 0.985→1 scale (reduced motion: ≤150ms fade).
 * The always-transformed inner div is the containing block for `fixed`
 * descendants, so the full-viewport phone sheets render INSIDE the panel —
 * their own focus traps and Escape handling keep working unchanged.
 */
export function DesktopModal({
  width = 860,
  maxHeight = 860,
  onClose,
  children,
}: {
  width?: number;
  maxHeight?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: reduced ? 0.12 : 0.18 }}
    >
      <button
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0"
        style={{ background: "rgba(3, 3, 3, 0.72)" }}
        onClick={onClose}
      />
      <motion.div
        className="card-finish relative overflow-hidden"
        style={{
          width: `min(${width}px, calc(100vw - 64px))`,
          height: `min(${maxHeight}px, calc(100dvh - 96px))`,
          borderRadius: 28,
          border: "1px solid var(--pm-border-strong)",
          background: "var(--color-canvas)",
        }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        exit={
          reduced
            ? { opacity: 0, transition: { duration: 0.12 } }
            : { opacity: 0, scale: 0.985, transition: { duration: 0.16 } }
        }
        transition={{ duration: reduced ? 0.14 : 0.22, ease: EASE }}
      >
        <div className="absolute inset-0" style={{ transform: "translateZ(0)" }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
