"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getFormCard } from "@/lib/analysis/form-cards";

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
const SERIF = 'Georgia, "Times New Roman", serif';
const BONE = "#EAE6E0";
const MUTED = "#8E8E8A";

/**
 * FORM card modal — the Vitality reference card's anatomy (photos, numbered
 * steps, cue chips) restyled in PhysiqueMaxx's language: raised black card,
 * hairline border, serif display name, outlined chips, no status colors.
 * Renders nothing when exerciseId is null or has no card.
 */
export function FormCard({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const card = exerciseId ? getFormCard(exerciseId) : null;
  const open = Boolean(card);

  // Escape closes the card only — capture phase + stopPropagation so the
  // DetailView's own Escape listener underneath doesn't also fire.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  // Reduced motion is respected via transition duration only.
  const duration = reduced ? 0.01 : 0.22;

  return (
    <AnimatePresence>
      {card && exerciseId && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(3,3,3,0.75)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${card.name} form`}
            className="relative w-full max-w-[430px] overflow-y-auto overscroll-contain"
            style={{
              maxHeight: "86vh",
              background: "#0A0A0A",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* close — same treatment as the DetailView's */}
            <button
              aria-label="Close form card"
              onClick={onClose}
              className="absolute flex items-center justify-center rounded-full"
              style={{
                top: 16,
                right: 16,
                width: 38,
                height: 38,
                background: "rgba(10,10,10,0.5)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="#F3F1ED"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="px-6 pb-7 pt-6">
              <p className="micro-11" style={{ color: MUTED }}>
                FORM
              </p>

              <h2
                className="mt-2 pr-10"
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: 34,
                  lineHeight: 1.08,
                  letterSpacing: "-0.01em",
                  color: "#F3F1ED",
                }}
              >
                {card.name}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="micro" style={{ color: MUTED }}>
                  {card.muscles.join(" · ")}
                </span>
                <span
                  className="micro rounded-full border px-2.5 py-1"
                  style={{
                    borderColor: "rgba(255,255,255,0.18)",
                    color: "rgba(234,230,224,0.85)",
                  }}
                >
                  TIER {card.tier}
                </span>
              </div>

              <p className="micro mt-2" style={{ color: MUTED }}>
                {card.equipment}
              </p>

              <p
                className="mt-4 text-[17px] font-bold leading-snug"
                style={{ color: BONE }}
              >
                {card.gist}
              </p>

              {card.images > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {Array.from({ length: card.images }, (_, n) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={n}
                      src={`/form-cards/${exerciseId}/${n}.jpg`}
                      alt={`${card.name} — reference ${n + 1}`}
                      className="w-full select-none object-cover"
                      style={{ aspectRatio: "4 / 5", borderRadius: 10 }}
                      draggable={false}
                    />
                  ))}
                </div>
              )}

              <p className="micro-11 mt-6" style={{ color: MUTED }}>
                STEPS
              </p>
              <ol className="mt-3 flex flex-col gap-2.5">
                {card.steps.map((step, i) => (
                  <li key={step} className="flex items-baseline gap-3">
                    <span
                      className="shrink-0 text-right"
                      style={{
                        fontFamily: SERIF,
                        fontStyle: "italic",
                        fontSize: 16,
                        width: 22,
                        color: MUTED,
                      }}
                    >
                      {ROMAN[i] ?? i + 1}
                    </span>
                    <span
                      className="text-[16px] leading-relaxed"
                      style={{ color: BONE }}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              {card.cues.length > 0 && (
                <>
                  <p className="micro-11 mt-6" style={{ color: MUTED }}>
                    CUES
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.cues.map((cue) => (
                      <span
                        key={cue}
                        className="micro rounded-full border px-3 py-1.5 leading-relaxed"
                        style={{
                          borderColor: "rgba(255,255,255,0.14)",
                          color: "rgba(234,230,224,0.85)",
                        }}
                      >
                        {cue}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
