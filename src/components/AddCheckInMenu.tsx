"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Owner } from "@/lib/types";
import { useFocusTrap } from "@/lib/use-focus-trap";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SUBJECTS: Owner[] = ["luke", "rowan"];

/**
 * The Add launcher (§3): the center ember button first opens this compact
 * choice sheet — never four huge slots. In US scope it asks LUKE / ROWAN
 * first (the subject is never defaulted silently), then offers camera-first
 * today or gallery-first past photos.
 */
export function AddCheckInMenu({
  onClose,
  onToday,
  onPast,
  desktop = false,
  requireSubject = false,
  subject = null,
  me,
  onSubject,
}: {
  onClose: () => void;
  onToday: () => void;
  onPast: () => void;
  /** centered desktop modal presentation (§7: 220ms fade + 0.985→1 scale) */
  desktop?: boolean;
  /** US scope: ask LUKE / ROWAN before the today/past choice */
  requireSubject?: boolean;
  /** the subject once frozen — drives whether the subject step is still shown */
  subject?: Owner | null;
  /** the signed-in member (for the YOU / PARTNER hint) */
  me?: Owner;
  /** a subject row was chosen — the parent freezes it for this capture session */
  onSubject?: (owner: Owner) => void;
}) {
  const reduced = useReducedMotion();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  // Pick the subject first whenever US scope opened the flow with none frozen.
  const showSubject = requireSubject && !subject;

  const row =
    "flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left outline-none";

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex justify-center ${desktop ? "items-center" : "items-end"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: 0.2 }}
    >
      <button
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0"
        style={{ background: "rgba(3,3,3,0.7)" }}
        onClick={onClose}
      />
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={showSubject ? "Whose check-in" : "Add a check-in"}
        tabIndex={-1}
        className="card-finish relative w-full overflow-hidden"
        style={{
          maxWidth: desktop ? 420 : 430,
          background: "var(--color-surface)",
          borderTopLeftRadius: desktop ? 24 : 28,
          borderTopRightRadius: desktop ? 24 : 28,
          borderBottomLeftRadius: desktop ? 24 : 0,
          borderBottomRightRadius: desktop ? 24 : 0,
          paddingBottom: desktop
            ? 10
            : "max(env(safe-area-inset-bottom), 20px)",
        }}
        initial={
          desktop
            ? reduced
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.985 }
            : reduced
              ? { opacity: 0 }
              : { y: 110 }
        }
        animate={
          desktop
            ? reduced
              ? { opacity: 1 }
              : { opacity: 1, scale: 1 }
            : reduced
              ? { opacity: 1 }
              : { y: 0 }
        }
        exit={
          desktop
            ? reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, scale: 0.985, transition: { duration: 0.16 } }
            : reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { y: 110, transition: { duration: 0.2 } }
        }
        transition={{
          duration: desktop ? (reduced ? 0.12 : 0.22) : reduced ? 0.12 : 0.32,
          ease: EASE,
        }}
      >
        {showSubject ? (
          <div className="px-4 pt-5 pb-2">
            <p className="micro-11 px-2 text-mute">WHOSE CHECK-IN</p>

            <div className="mt-3 flex flex-col gap-1">
              {SUBJECTS.map((owner, i) => (
                <button
                  key={owner}
                  className={row}
                  style={{ minHeight: 64 }}
                  onClick={() => onSubject?.(owner)}
                  data-autofocus={i === 0 || undefined}
                >
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full"
                    style={{
                      width: 40,
                      height: 40,
                      border: "1px solid var(--pm-border-strong)",
                    }}
                    aria-hidden
                  >
                    <span className="micro-11 text-bone">
                      {owner.slice(0, 1).toUpperCase()}
                    </span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="micro-11 text-bone">
                      {owner.toUpperCase()}
                    </span>
                    <span className="text-[13px] leading-snug text-mute">
                      {owner === me ? "You" : "Partner"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 pt-5 pb-2">
            <p className="micro-11 px-2 text-mute">ADD TO YOUR ARCHIVE</p>

            <div className="mt-3 flex flex-col gap-1">
              <button
                className={row}
                style={{ minHeight: 64 }}
                onClick={onToday}
                data-autofocus
              >
                <span
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{ width: 40, height: 40, background: "var(--color-ember)" }}
                  aria-hidden
                >
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <rect x="1.8" y="4.2" width="14.4" height="11" rx="2.6" stroke="var(--color-canvas)" strokeWidth="1.4" />
                    <path d="M6 4.2l1.2-2h3.6l1.2 2" stroke="var(--color-canvas)" strokeWidth="1.4" strokeLinejoin="round" />
                    <circle cx="9" cy="9.6" r="2.9" stroke="var(--color-canvas)" strokeWidth="1.4" />
                  </svg>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="micro-11 text-bone">TODAY&apos;S CHECK-IN</span>
                  <span className="text-[13px] leading-snug text-mute">Camera</span>
                </span>
              </button>

              <button className={row} style={{ minHeight: 64 }} onClick={onPast}>
                <span
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: 40,
                    height: 40,
                    border: "1px solid var(--pm-border-strong)",
                  }}
                  aria-hidden
                >
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="7" stroke="#F3F1ED" strokeWidth="1.3" />
                    <path d="M9 5v4.3l2.8 1.8" stroke="#F3F1ED" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 3.4L3.4 2" stroke="#F3F1ED" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="micro-11 text-bone">ADD PAST PHOTOS</span>
                  <span className="text-[13px] leading-snug text-mute">Gallery</span>
                </span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
