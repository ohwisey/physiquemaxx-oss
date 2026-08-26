"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Gender, Profile } from "@/lib/types";
import { useFocusTrap } from "@/lib/use-focus-trap";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * The Profile destination — identity, the three profile facts the analysis
 * uses (birthday, height, gender), pair status, sign out. A sheet, not a
 * settings dashboard.
 */
export function AccountSheet({
  profile,
  email,
  pairedWith,
  onClose,
  onSaveProfile,
  onSignOut,
  desktop = false,
}: {
  profile: Profile;
  email: string | null;
  pairedWith: string | null;
  onClose: () => void;
  onSaveProfile: (p: Profile) => void;
  onSignOut: () => void;
  /** centered desktop modal presentation (§7: 220ms fade + 0.985→1 scale) */
  desktop?: boolean;
}) {
  const reduced = useReducedMotion();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [birthdate, setBirthdate] = useState(profile.birthdate ?? "");
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? "");
  const [gender, setGender] = useState<Gender | null>(profile.gender);

  const save = () => {
    const h = Number(height);
    onSaveProfile({
      ...profile,
      birthdate: birthdate || null,
      heightCm: Number.isFinite(h) && h > 0 ? h : null,
      gender,
    });
    onClose();
  };

  const label = "micro-11 text-mute";
  const field =
    "mt-1.5 w-full bg-transparent pb-2 text-[16px] text-bone outline-none border-b";
  const border = { borderColor: "rgba(243,241,237,0.14)" };

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex justify-center ${desktop ? "items-center" : "items-end"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.2 }}
    >
      <button
        aria-label="Close profile"
        tabIndex={-1}
        className="absolute inset-0"
        style={{ background: "rgba(3,3,3,0.7)" }}
        onClick={onClose}
      />
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        tabIndex={-1}
        className="card-finish relative w-full overflow-hidden bg-raised"
        style={{
          maxWidth: desktop ? 460 : 430,
          maxHeight: desktop ? "min(720px, calc(100dvh - 96px))" : undefined,
          overflowY: desktop ? "auto" : undefined,
          borderTopLeftRadius: desktop ? 24 : 28,
          borderTopRightRadius: desktop ? 24 : 28,
          borderBottomLeftRadius: desktop ? 24 : 0,
          borderBottomRightRadius: desktop ? 24 : 0,
          paddingBottom: desktop
            ? 0
            : "max(env(safe-area-inset-bottom), 24px)",
        }}
        initial={
          desktop
            ? reduced
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.985 }
            : reduced
              ? { opacity: 0 }
              : { y: 90 }
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
              : { y: 90, transition: { duration: 0.2 } }
        }
        transition={{
          duration: desktop ? (reduced ? 0.12 : 0.22) : reduced ? 0.12 : 0.32,
          ease: EASE,
        }}
      >
        <div className="p-6">
          <p className="micro-11 text-mute">PROFILE</p>
          <p className="masthead mt-1 text-bone" style={{ fontSize: 30 }}>
            {profile.displayName.toUpperCase()}
          </p>
          {email && <p className="mt-1 text-[13px] text-mute">{email}</p>}

          {/* the three facts the analysis uses */}
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <p className={label}>BIRTHDAY</p>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className={field}
                style={{ ...border, colorScheme: "dark" }}
                aria-label="Birthday"
              />
            </div>
            <div>
              <p className={label}>HEIGHT (CM)</p>
              <input
                type="number"
                inputMode="numeric"
                min="120"
                max="230"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="180"
                className={field}
                style={border}
                aria-label="Height in centimeters"
              />
            </div>
            <div className="col-span-2">
              <p className={label}>GENDER</p>
              <div className="mt-2 flex gap-2">
                {(["male", "female"] as Gender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    aria-pressed={gender === g}
                    className="micro rounded-full border px-4"
                    style={{
                      minHeight: 44,
                      borderColor:
                        gender === g
                          ? "rgba(243,241,237,0.9)"
                          : "rgba(243,241,237,0.18)",
                      color:
                        gender === g ? "#F3F1ED" : "rgba(243,241,237,0.55)",
                      background:
                        gender === g ? "rgba(243,241,237,0.08)" : "transparent",
                    }}
                  >
                    {g.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 border-t pt-5" style={border}>
            <p className={label}>PAIR</p>
            <p className="mt-1.5 text-[14px] text-bone/85">
              {pairedWith ?? "Not paired"}
            </p>
          </div>

          <button
            onClick={save}
            className="micro-11 mt-6 w-full rounded-full py-3.5"
            style={{
              minHeight: 48,
              background: "var(--color-ember)",
              color: "var(--color-canvas)",
            }}
          >
            SAVE
          </button>
          <button
            onClick={onSignOut}
            className="micro-11 mt-2.5 w-full rounded-full border py-3.5 text-bone/85"
            style={{ minHeight: 48, borderColor: "rgba(243,241,237,0.18)" }}
          >
            SIGN OUT
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
