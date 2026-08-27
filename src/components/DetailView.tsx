"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { angleCount, mastheadDate, type CheckIn, type ViewAngle } from "@/lib/types";
import type { AnalysisResult, MuscleAssessment } from "@/lib/analysis/types";
import { MUSCLE_LABEL } from "@/lib/analysis/types";
import { getFormCard } from "@/lib/analysis/form-cards";
import { FormCard } from "@/components/FormCard";
import type { DeckLayout } from "@/lib/use-deck-layout";
import { useFocusTrap } from "@/lib/use-focus-trap";

const ANGLES: ViewAngle[] = ["front", "left", "back", "right"];
const HERO_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const INK = "#141312";

/**
 * The full analysis experience. Opens from the deck via a shared-element
 * (layoutId) expansion of the FRONT photograph into a hero; a warm-bone
 * editorial sheet rises over it. Mobile: stacked scroll. Desktop: split
 * view (photo | slim angle rail | 480–560px analysis panel).
 */
export function DetailView({
  item,
  analysis,
  layout,
  onClose,
  onRequestAnalysis,
}: {
  item: CheckIn;
  analysis: AnalysisResult | null;
  layout: DeckLayout;
  onClose: () => void;
  /** optional — renders a discreet RUN ANALYSIS pill in the not-analyzed state */
  onRequestAnalysis?: () => Promise<void> | void;
}) {
  const reduced = useReducedMotion();
  // §8: trap + initial/restored focus + Escape in every full-screen view.
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  // A recovered check-in may be missing the front (or every) view — open on
  // the first surviving angle so the hero never points at an absent photo.
  const available = ANGLES.filter((a) => item.photos[a]);
  const [angle, setAngle] = useState<ViewAngle>(available[0] ?? "front");
  const [dir, setDir] = useState(1);
  const heroH = layout.desktop
    ? layout.viewportH
    : Math.min(Math.round(layout.viewportW / 0.624), Math.round(layout.viewportH * 0.66));

  // Preload all four angles before the transition completes.
  useEffect(() => {
    for (const a of available) {
      const img = new Image();
      img.src = item.photos[a]!;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickAngle = (a: ViewAngle) => {
    if (!item.photos[a] || a === angle) return;
    setDir(ANGLES.indexOf(a) > ANGLES.indexOf(angle) ? 1 : -1);
    setAngle(a);
  };

  const t = (delay: number, duration = 0.4) =>
    reduced
      ? { duration: 0.15, delay: Math.min(delay, 0.2) }
      : { delay, duration, ease: HERO_EASE };

  const hero = (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: heroH, background: "#0a0a0a" }}
    >
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        {item.photos[angle] ? (
          <motion.img
            key={angle}
            src={item.photos[angle]}
            alt={`${item.owner} ${angle}, ${item.date}`}
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
            custom={dir}
            initial={reduced ? { opacity: 0 } : { x: 36 * dir, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: -36 * dir, opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.28, ease: [0.3, 0, 0.2, 1] }}
          />
        ) : (
          <motion.div
            key={`na-${angle}`}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "#0a0a0a" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.28 }}
          >
            <span className="micro" style={{ color: "rgba(243,241,237,0.5)" }}>
              {angle.toUpperCase()} UNAVAILABLE
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* §9 dim beat — the photograph dims quickly once the hero settles */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.28 }}
        transition={t(reduced ? 0 : 0.56, 0.16)}
      />

      {/* angle selector — appears ~180ms into the transition. Desktop keeps
          only the compact left rail (§4: never duplicate the selector). */}
      {!layout.desktop && (
        <motion.div
          className="absolute inset-x-0 flex justify-center"
          style={{ bottom: 52 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={t(0.18, 0.3)}
        >
          <div
            className="flex items-center gap-1 rounded-full px-1.5 py-1.5"
            style={{
              background: "rgba(10,10,10,0.55)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            {ANGLES.map((a) => {
              const has = Boolean(item.photos[a]);
              const active = a === angle;
              return (
                <button
                  key={a}
                  disabled={!has}
                  onClick={() => pickAngle(a)}
                  className="micro rounded-full px-3 py-2 transition-colors"
                  style={{
                    color: active ? "#030303" : has ? "#F3F1ED" : "rgba(243,241,237,0.3)",
                    background: active ? "#F3F1ED" : "transparent",
                  }}
                >
                  {a.toUpperCase()}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* close */}
      <motion.button
        aria-label="Close analysis"
        onClick={onClose}
        className="absolute flex items-center justify-center rounded-full"
        style={{
          top: "max(env(safe-area-inset-top), 16px)",
          left: 16,
          width: 38,
          height: 38,
          background: "rgba(10,10,10,0.5)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={t(0.18, 0.25)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M2 2l10 10M12 2L2 12" stroke="#F3F1ED" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </motion.button>
    </div>
  );

  const sheet = (
    <motion.div
      className="relative"
      style={{
        background: "#EAE6E0",
        color: INK,
        borderTopLeftRadius: layout.desktop ? 0 : 30,
        borderTopRightRadius: layout.desktop ? 0 : 30,
        marginTop: layout.desktop ? 0 : -28,
        minHeight: layout.desktop ? "100%" : "62vh",
        zIndex: 10,
      }}
      initial={reduced ? { opacity: 0 } : { y: 90, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { y: 70, opacity: 0, transition: { duration: 0.22 } }}
      transition={t(0.4, 0.52)}
    >
      <div
        className="mx-auto flex flex-col"
        style={{
          maxWidth: 560,
          padding: layout.desktop ? "44px 40px 80px" : "30px 24px 110px",
        }}
      >
        <SheetContent
          item={item}
          analysis={analysis}
          reduced={!!reduced}
          onRequestAnalysis={onRequestAnalysis}
        />
      </div>
    </motion.div>
  );

  return (
    <motion.div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Analysis, ${item.date}`}
      tabIndex={-1}
      className="fixed inset-0 z-50"
      initial={false}
    >
      {/* backdrop — everything behind fades to black while the hero expands */}
      <motion.div
        className="absolute inset-0 bg-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ duration: 0.18 }}
      />
      {layout.desktop ? (
        // §4 detail workspace: LEFT compact angle rail · anchored photo stage ·
        // independently scrolling paper panel. The angle selector exists once.
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "84px 1fr 520px" }}>
          {/* slim angle rail */}
          <motion.div
            className="flex flex-col items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={t(0.18, 0.3)}
          >
            {ANGLES.map((a) => {
              const has = Boolean(item.photos[a]);
              const active = a === angle;
              return (
                <button
                  key={a}
                  disabled={!has}
                  onClick={() => pickAngle(a)}
                  aria-pressed={active}
                  aria-label={`${a} angle${has ? "" : " (no photo)"}`}
                  className="micro flex h-14 w-14 items-center justify-center rounded-full transition-colors"
                  style={{
                    color: active ? "#030303" : has ? "#F3F1ED" : "rgba(243,241,237,0.3)",
                    background: active ? "#F3F1ED" : "rgba(243,241,237,0.06)",
                  }}
                >
                  {a.slice(0, 1).toUpperCase()}
                </button>
              );
            })}
          </motion.div>
          <motion.div
            layoutId={`hero-${item.id}`}
            className="relative h-full overflow-hidden"
            transition={{ duration: reduced ? 0.15 : 0.56, ease: HERO_EASE }}
          >
            {hero}
          </motion.div>
          <div className="h-full overflow-y-auto">{sheet}</div>
        </div>
      ) : (
        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          <motion.div
            layoutId={`hero-${item.id}`}
            className="relative overflow-hidden"
            style={{ borderRadius: "0px 0px 30px 30px" }}
            transition={{ duration: reduced ? 0.15 : 0.56, ease: HERO_EASE }}
          >
            {hero}
          </motion.div>
          {sheet}
        </div>
      )}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */

function SheetContent({
  item,
  analysis,
  reduced,
  onRequestAnalysis,
}: {
  item: CheckIn;
  analysis: AnalysisResult | null;
  reduced: boolean;
  onRequestAnalysis?: () => Promise<void> | void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [formExercise, setFormExercise] = useState<string | null>(null);
  const rows = useMemo(() => {
    if (!analysis) return [];
    const order = { red: 0, green: 1, not_assessable: 2 } as const;
    return [...analysis.muscles].sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        (a.score ?? 101) - (b.score ?? 101),
    );
  }, [analysis]);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduced
      ? { duration: 0.15 }
      : { delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  });

  if (!analysis) {
    return (
      <motion.div {...fade(0.5)}>
        <SectionLabel>NOT ANALYZED</SectionLabel>
        {onRequestAnalysis && (
          <>
            <button
              disabled={analyzing}
              onClick={async () => {
                setAnalyzing(true);
                setAnalysisError(null);
                try {
                  await onRequestAnalysis();
                } catch {
                  setAnalysisError("ANALYSIS FAILED. TRY AGAIN.");
                } finally {
                  setAnalyzing(false);
                }
              }}
              className="micro-11 mt-6 rounded-full px-7 py-3.5 transition-opacity"
              style={{
                background: INK,
                color: "#F3F1ED",
                opacity: analyzing ? 0.55 : 1,
              }}
            >
              {analyzing ? "ANALYZING…" : "RUN ANALYSIS"}
            </button>
            {analysisError && (
              <p className="micro mt-3" style={{ color: "#F04438" }}>
                {analysisError}
              </p>
            )}
          </>
        )}
      </motion.div>
    );
  }

  const primaryBottleneck = analysis.bottlenecks[0] ?? null;

  return (
    <>
      {/* meta row */}
      <motion.div className="flex items-center justify-between" {...fade(0.48)}>
        <span className="micro-11" style={{ color: INK, opacity: 0.55 }}>
          {item.owner.toUpperCase()} · {mastheadDate(item.date)} · {angleCount(item)}{" "}
          {angleCount(item) === 1 ? "ANGLE" : "ANGLES"}
          {item.weightKg !== null && ` · ${item.weightKg.toFixed(1)}KG`}
        </span>
        <span
          className="micro rounded-full border px-2.5 py-1"
          style={{ borderColor: "rgba(20,19,18,0.25)", color: INK, opacity: 0.75 }}
        >
          {`${analysis.confidence.toUpperCase()} CONFIDENCE`}
        </span>
      </motion.div>

      {/* overall — sharp clip reveal */}
      <div className="mt-6 overflow-hidden">
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: "105%" }}
          animate={reduced ? { opacity: 1 } : { y: 0 }}
          transition={
            reduced
              ? { duration: 0.2 }
              : { delay: 0.62, duration: 0.38, ease: [0.19, 1, 0.22, 1] }
          }
          className="flex items-end gap-3"
        >
          {analysis.overall !== null ? (
            <>
              <span className="masthead" style={{ fontSize: 112, color: INK }}>
                {analysis.overall}
              </span>
              <span className="micro-11 mb-5" style={{ color: INK, opacity: 0.45 }}>
                OVERALL / 100
              </span>
              {item.delta !== null && item.delta !== 0 && (
                <span
                  className="micro-11 mb-5"
                  style={{ color: item.delta > 0 ? "#39B86B" : "#F04438" }}
                >
                  {item.delta > 0 ? `+${item.delta}` : item.delta}
                </span>
              )}
            </>
          ) : (
            <span className="masthead" style={{ fontSize: 54, color: INK, lineHeight: 1.05 }}>
              LIMITED
              <br />
              VIEW
            </span>
          )}
        </motion.div>
      </div>

      {/* primary bottleneck line */}
      {primaryBottleneck && (
        <motion.p className="micro-11 mt-2" style={{ color: "#F04438" }} {...fade(0.74)}>
          PRIMARY BOTTLENECK · {MUSCLE_LABEL[primaryBottleneck.muscle]}
        </motion.p>
      )}

      {/* verdict */}
      <motion.div className="mt-8" {...fade(0.84)}>
        <SectionLabel>THE NO-BS VERDICT</SectionLabel>
        <p
          className="mt-3 text-[19px] font-medium leading-snug"
          style={{ color: INK, letterSpacing: "-0.01em" }}
        >
          {analysis.verdict}
        </p>
      </motion.div>

      {/* strongest */}
      {analysis.strongest && (
        <motion.div className="mt-8" {...fade(0.92)}>
          <SectionLabel>STRONGEST</SectionLabel>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: "#39B86B" }} />
            <div>
              <p className="micro-11" style={{ color: INK }}>
                {MUSCLE_LABEL[analysis.strongest.muscle]}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK, opacity: 0.7 }}>
                {analysis.strongest.statement}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* condition — est body fat, cardio, target (from weight logs + profile) */}
      {(analysis.estBodyFat || analysis.condition) && (
        <motion.div className="mt-10" {...fade(0.96)}>
          <SectionLabel>CONDITION</SectionLabel>
          {analysis.estBodyFat && (
            <div className="mt-3 flex items-end gap-3">
              <span
                className="masthead whitespace-nowrap"
                style={{ fontSize: 40, color: INK }}
              >
                {analysis.estBodyFat.lowPct}–{analysis.estBodyFat.highPct}%
              </span>
              <span className="micro mb-1.5" style={{ color: INK, opacity: 0.5 }}>
                EST BODY FAT · VISUAL ESTIMATE ·{" "}
                {analysis.estBodyFat.confidence.toUpperCase()} CONFIDENCE
              </span>
            </div>
          )}
          {analysis.condition && (
            <div className="mt-4 flex flex-col gap-3">
              {analysis.condition.weightTrend && (
                <ConditionRow label="TREND" text={analysis.condition.weightTrend} />
              )}
              <ConditionRow label="BODY FAT" text={analysis.condition.bodyFat} />
              <ConditionRow label="CARDIO" text={analysis.condition.cardio} />
              <ConditionRow label="HIT THIS" text={analysis.condition.target} />
            </div>
          )}
        </motion.div>
      )}

      {/* muscle ratings */}
      <motion.div className="mt-10" {...fade(1.0)}>
        <SectionLabel>MUSCLE RATINGS</SectionLabel>
        <div className="mt-2">
          {rows.map((m) => (
            <MuscleRow key={m.muscle} m={m} />
          ))}
        </div>
      </motion.div>

      {/* six-week plan */}
      {analysis.priorities.length > 0 && (
        <motion.div className="mt-10" {...fade(1.04)}>
          <SectionLabel>THE SIX-WEEK PLAN</SectionLabel>
          <p className="mt-2 text-[13px]" style={{ color: INK, opacity: 0.55 }}>
            Target weekly totals.
          </p>
          {analysis.priorities.map((p) => (
            <div key={p.muscle} className="mt-6">
              <div className="flex items-baseline justify-between">
                <span className="masthead" style={{ fontSize: 24, color: INK }}>
                  {MUSCLE_LABEL[p.muscle]}
                </span>
                <span className="micro" style={{ color: "#F04438" }}>
                  FIX IT
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: INK, opacity: 0.7 }}>
                {p.why}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {p.exercises.map((ex) =>
                  getFormCard(ex.id) ? (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setFormExercise(ex.id)}
                      className="flex items-baseline justify-between border-b pb-3 text-left"
                      style={{ borderColor: "rgba(20,19,18,0.1)" }}
                    >
                      <span className="text-[15px] font-medium" style={{ color: INK }}>
                        {ex.name}
                      </span>
                      <span className="flex items-baseline gap-3 whitespace-nowrap pl-4">
                        <span className="micro" style={{ color: INK, opacity: 0.6 }}>
                          {ex.sets} × {ex.repRange} · {ex.frequencyPerWeek}×/WK
                        </span>
                        <span className="micro" style={{ color: "#345CFF" }}>
                          FORM ↗
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div
                      key={ex.id}
                      className="flex items-baseline justify-between border-b pb-3"
                      style={{ borderColor: "rgba(20,19,18,0.1)" }}
                    >
                      <span className="text-[15px] font-medium" style={{ color: INK }}>
                        {ex.name}
                      </span>
                      <span className="micro whitespace-nowrap pl-4" style={{ color: INK, opacity: 0.6 }}>
                        {ex.sets} × {ex.repRange} · {ex.frequencyPerWeek}×/WK
                      </span>
                    </div>
                  ),
                )}
              </div>
              <p className="micro mt-3" style={{ color: INK, opacity: 0.55 }}>
                {p.weeklyHardSets} HARD SETS / WEEK · {p.rir} RIR · REST{" "}
                {p.exercises[0]?.restSeconds ?? 90}–{p.exercises[1]?.restSeconds ?? 120}S
              </p>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: INK, opacity: 0.6 }}>
                {p.progressionRule}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK, opacity: 0.6 }}>
                {p.reassessAt}
              </p>
            </div>
          ))}
        </motion.div>
      )}

      {/* retake guidance for limited/failed */}
      {analysis.qualityGate.retakeGuidance.length > 0 && (
        <motion.div className="mt-10" {...fade(1.08)}>
          <SectionLabel>TO UNLOCK THE FULL ASSESSMENT</SectionLabel>
          <ul className="mt-3 flex flex-col gap-2">
            {analysis.qualityGate.retakeGuidance.map((g) => (
              <li key={g} className="text-[14px] leading-relaxed" style={{ color: INK, opacity: 0.75 }}>
                {g}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* presentation — explicitly separate from development */}
      {analysis.presentationNotes.length > 0 && (
        <motion.div
          className="mt-10 border-t pt-6"
          style={{ borderColor: "rgba(20,19,18,0.12)" }}
          {...fade(1.1)}
        >
          <SectionLabel>PRESENTATION</SectionLabel>
          <ul className="mt-3 flex flex-col gap-2">
            {analysis.presentationNotes.map((n) => (
              <li key={n} className="text-[13px] leading-relaxed" style={{ color: INK, opacity: 0.6 }}>
                {n}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.p className="micro mt-12" style={{ color: INK, opacity: 0.35 }} {...fade(1.12)}>
        RUBRIC {analysis.versions.rubric} · SCORING {analysis.versions.scoring} ·{" "}
        {analysis.versions.model.toUpperCase()}
      </motion.p>

      <FormCard exerciseId={formExercise} onClose={() => setFormExercise(null)} />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="micro-11" style={{ color: INK, opacity: 0.5 }}>
      {children}
    </p>
  );
}

function ConditionRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="micro w-16 shrink-0" style={{ color: INK, opacity: 0.5 }}>
        {label}
      </span>
      <p className="text-[14px] leading-relaxed" style={{ color: INK, opacity: 0.85 }}>
        {text}
      </p>
    </div>
  );
}

function MuscleRow({ m }: { m: MuscleAssessment }) {
  const na = m.status === "not_assessable";
  const color = m.status === "red" ? "#F04438" : m.status === "green" ? "#39B86B" : "#8E8E8A";
  const confidence =
    m.confidence >= 0.75 ? "HIGH CONFIDENCE" : m.confidence >= 0.6 ? "MEDIUM CONFIDENCE" : "LOW CONFIDENCE";
  const redEvidence = m.status === "red" && m.evidence.length > 0;

  return (
    <div className="border-b py-3.5" style={{ borderColor: "rgba(20,19,18,0.1)" }}>
      <div className="flex items-center justify-between">
        <span className="micro-11" style={{ color: na ? "rgba(20,19,18,0.45)" : INK }}>
          {MUSCLE_LABEL[m.muscle]}
        </span>
        <span
          className="masthead tabular-nums"
          style={{ fontSize: 21, color: na ? "rgba(20,19,18,0.3)" : color }}
        >
          {m.score ?? "—"}
        </span>
      </div>
      <p className="micro mt-1" style={{ color, opacity: na ? 0.7 : 1 }}>
        {na ? "NOT ASSESSABLE" : `${m.status.toUpperCase()} · ${confidence}`}
      </p>
      {redEvidence && (
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK, opacity: 0.62 }}>
          {m.evidence
            .map((e) => `${e.view.toUpperCase()} · ${e.observation}`)
            .join(" ")}
        </p>
      )}
    </div>
  );
}
