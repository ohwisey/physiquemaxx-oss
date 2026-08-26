"use client";

/**
 * Cards / Timeline switch (§3) — lives inside Library rather than becoming a
 * duplicate navigation destination. Shared by the phone header row and the
 * desktop workspace top bar.
 */
export function ViewToggle({
  view,
  onChange,
}: {
  view: "cards" | "timeline";
  onChange: (v: "cards" | "timeline") => void;
}) {
  const seg =
    "flex items-center justify-center outline-none transition-opacity";
  return (
    <div
      className="flex items-center rounded-full p-0.5"
      style={{
        height: 40,
        background: "rgba(9, 10, 9, 0.85)",
        border: "1px solid var(--pm-border)",
      }}
    >
      <button
        aria-label="Card view"
        aria-pressed={view === "cards"}
        className={seg}
        style={{
          width: 40,
          height: 36,
          borderRadius: 18,
          background:
            view === "cards" ? "var(--color-surface-raised)" : "transparent",
          opacity: view === "cards" ? 1 : 0.5,
        }}
        onClick={() => onChange("cards")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="3" y="1.5" width="10" height="3" rx="1.5" stroke="#F3F1ED" strokeWidth="1.2" opacity="0.55" />
          <rect x="2" y="6.5" width="12" height="8" rx="2" stroke="#F3F1ED" strokeWidth="1.2" />
        </svg>
      </button>
      <button
        aria-label="Timeline view"
        aria-pressed={view === "timeline"}
        className={seg}
        style={{
          width: 40,
          height: 36,
          borderRadius: 18,
          background:
            view === "timeline" ? "var(--color-surface-raised)" : "transparent",
          opacity: view === "timeline" ? 1 : 0.5,
        }}
        onClick={() => onChange("timeline")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="2" y="2" width="4" height="4" rx="1.2" stroke="#F3F1ED" strokeWidth="1.2" />
          <rect x="2" y="10" width="4" height="4" rx="1.2" stroke="#F3F1ED" strokeWidth="1.2" />
          <path d="M8.5 4h5.5M8.5 12h5.5" stroke="#F3F1ED" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
