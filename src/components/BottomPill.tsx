"use client";

/**
 * Floating bottom navigation (§3 shell): minimal three-item pill — Library,
 * a dominant 56px ember Add button (dark glyph), Profile. The parent keeps
 * it clear of the home indicator. Cards/Timeline lives in the library
 * header, never here.
 */
export function BottomPill({
  active,
  onLibrary,
  onAdd,
  onProfile,
}: {
  active: "library" | "profile";
  onLibrary: () => void;
  onAdd: () => void;
  onProfile: () => void;
}) {
  const item =
    "relative flex flex-col items-center justify-center gap-1 outline-none";

  return (
    <div
      className="flex items-center gap-7 rounded-full px-6"
      style={{
        height: 68,
        background: "rgba(10, 11, 10, 0.78)",
        border: "1px solid var(--pm-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <button
        aria-label="Library"
        aria-current={active === "library" ? "page" : undefined}
        className={item}
        style={{ minWidth: 52, minHeight: 44, opacity: active === "library" ? 1 : 0.55 }}
        onClick={onLibrary}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <rect x="4.5" y="2.5" width="9" height="13" rx="2" stroke="var(--color-text)" strokeWidth="1.3" />
          <path d="M2.5 4.5v9M15.5 4.5v9" stroke="var(--color-text)" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
        </svg>
        <span className="micro" style={{ color: "var(--color-text)" }}>
          Library
        </span>
        {active === "library" && (
          <span
            aria-hidden
            className="absolute"
            style={{
              width: 14,
              height: 2,
              borderRadius: 1,
              background: "var(--color-ember)",
              transform: "translateY(21px)",
            }}
          />
        )}
      </button>

      <button
        aria-label="Add a check-in"
        className="flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background: "var(--color-ember)",
          boxShadow: "0 6px 22px rgba(255, 101, 55, 0.35)",
        }}
        onClick={onAdd}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 3v14M3 10h14"
            stroke="var(--color-canvas)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <button
        aria-label="Profile"
        aria-current={active === "profile" ? "page" : undefined}
        className={item}
        style={{ minWidth: 52, minHeight: 44, opacity: active === "profile" ? 1 : 0.55 }}
        onClick={onProfile}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <circle cx="9" cy="6" r="3" stroke="var(--color-text)" strokeWidth="1.3" />
          <path
            d="M3.5 15.5c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
            stroke="var(--color-text)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span className="micro" style={{ color: "var(--color-text)" }}>
          Profile
        </span>
      </button>
    </div>
  );
}
