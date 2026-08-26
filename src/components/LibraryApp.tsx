"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { SEED } from "@/lib/seed";
import { ANALYSIS_FIXTURES } from "@/lib/analysis/fixtures";
import type { CheckIn, Owner, Profile, Scope } from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { SaveCheckInFn } from "@/lib/checkin-meta";
import type { LibraryData } from "@/lib/data";
import { buildDemoLibrary } from "@/lib/demo-library";
import { useDeckLayout } from "@/lib/use-deck-layout";
import { useLibrary } from "@/lib/use-library";
import { AmbientBackdrop } from "./AmbientBackdrop";
import { ScopeSelector } from "./ScopeSelector";
import { ConsistencyEmber } from "./ConsistencyEmber";
import { Deck } from "./Deck";
import { BottomPill } from "./BottomPill";
import { DetailView } from "./DetailView";
import { CaptureSheet } from "./CaptureSheet";
import { AddCheckInMenu } from "./AddCheckInMenu";
import { HistoricalImportSheet } from "./HistoricalImportSheet";
import { AccountSheet } from "./AccountSheet";
import { EmptyLibrary } from "./EmptyLibrary";
import { TimelineList } from "./TimelineList";
import { ViewToggle } from "./ViewToggle";
import { DesktopModal, DesktopWorkspace } from "./DesktopWorkspace";

/**
 * The one main application surface: LUKE / ROWAN / US scopes over a single
 * cinematic deck (or the vertical timeline). NEXT_PUBLIC_DEMO=1 keeps the
 * seeded fixture behavior; otherwise everything flows from Supabase via
 * useLibrary(). VIEW EXAMPLE enters an in-memory demo library that never
 * touches live data.
 */

const ENV_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export function LibraryApp() {
  return ENV_DEMO ? <SeededLibraryApp /> : <LiveLibraryApp />;
}

/**
 * Resolve owner handle → subject profile id from the loaded library. The data
 * layer exposes this as `ownerIds` (from profiles — never hard-coded); the
 * fallbacks tolerate the concurrent append-only work landing the map under a
 * different field. Returns an empty map when ids are not yet available
 * (seeded / example mode, where saves are a no-op).
 */
function resolveOwnerIds(data: LibraryData): Partial<Record<Owner, string>> {
  const d = data as unknown as {
    ownerIds?: Partial<Record<Owner, string>>;
    subjects?: Partial<Record<Owner, { id?: string } | string>>;
    profiles?: Partial<Record<Owner, { id?: string } | string>>;
  };
  if (d.ownerIds && (d.ownerIds.luke || d.ownerIds.rowan)) return d.ownerIds;
  const fromMap = (
    m?: Partial<Record<Owner, { id?: string } | string>>,
  ): Partial<Record<Owner, string>> | undefined => {
    if (!m) return undefined;
    const pick = (v: { id?: string } | string | undefined) =>
      typeof v === "string" ? v : v?.id;
    const out: Partial<Record<Owner, string>> = {};
    const l = pick(m.luke);
    const r = pick(m.rowan);
    if (l) out.luke = l;
    if (r) out.rowan = r;
    return out.luke || out.rowan ? out : undefined;
  };
  return fromMap(d.subjects) ?? fromMap(d.profiles) ?? d.ownerIds ?? {};
}

/* ----------------------------------------------------- seeded (env demo) */

function SeededLibraryApp() {
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("pmx-profile");
        if (raw) return JSON.parse(raw) as Profile;
      } catch {}
    }
    return { displayName: "Luke", birthdate: null, heightCm: null, gender: null };
  });

  const saveProfile = useCallback((p: Profile) => {
    setProfile(p);
    try {
      localStorage.setItem("pmx-profile", JSON.stringify(p));
    } catch {}
  }, []);

  // QA knob (env-demo builds only): ?qa=empty renders the empty-library
  // states so every state can be screenshot-verified. Lazy-read once.
  const [qaEmpty] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("qa") === "empty",
  );

  // The example experience works here exactly as in live mode.
  const [demoOn, setDemoOn] = useState(false);
  const [demoSeed, setDemoSeed] = useState(0);
  const demoLib = useMemo(() => {
    void demoSeed;
    return demoOn ? buildDemoLibrary("luke") : null;
  }, [demoOn, demoSeed]);

  const empty = qaEmpty && !demoLib;

  return (
    <LibraryShell
      items={
        demoLib ? demoLib.items : empty ? { luke: [], rowan: [], us: [] } : SEED
      }
      analyses={demoLib ? demoLib.analyses : empty ? {} : ANALYSIS_FIXTURES}
      profile={profile}
      email={null}
      partnerName="Rowan"
      lastWeightKg={empty ? null : (SEED.luke[0]?.weightKg ?? null)}
      defaultScope="luke"
      me="luke"
      ownerIds={{}}
      momentumCount={empty || demoLib ? 0 : 3}
      demo={Boolean(demoLib)}
      demoSeed={demoSeed}
      onEnterDemo={() => setDemoOn(true)}
      onExitDemo={() => setDemoOn(false)}
      onResetDemo={() => setDemoSeed((s) => s + 1)}
      onSaveCheckIn={async () => undefined}
      onSaveProfile={saveProfile}
      onSignOut={() => {}}
    />
  );
}

/* ---------------------------------------------------------------- live */

function LiveLibraryApp() {
  const router = useRouter();
  const lib = useLibrary();
  const { loading, error, data, saveProfile, requestAnalysis, signOut } = lib;
  // Contract narrowing over the (separately owned) data layer: prefer the
  // detailed save (returns {checkinId, …}), degrade to the void-returning
  // legacy signature; loadMore/fetchAnalysis/hasMore/momentumCount are all
  // optional so both contract generations compile and behave.
  const saveCheckIn: SaveCheckInFn =
    (lib as { saveCheckInDetailed?: SaveCheckInFn }).saveCheckInDetailed ??
    (lib.saveCheckIn as unknown as SaveCheckInFn);
  const loadMore = (lib as { loadMore?: () => Promise<void> }).loadMore;
  const fetchAnalysis = (
    lib as {
      fetchAnalysis?: (checkinId: string) => Promise<AnalysisResult | null>;
    }
  ).fetchAnalysis;
  const momentumCount = data
    ? ((data as { momentumCount?: number }).momentumCount ?? 0)
    : 0;
  const hasMore = data
    ? (data as { hasMore?: Record<Owner, boolean> }).hasMore
    : undefined;

  const [demoOn, setDemoOn] = useState(false);
  const [demoSeed, setDemoSeed] = useState(0);
  const me = data?.me;
  const demoLib = useMemo(() => {
    void demoSeed; // RESET DEMO bumps the seed to rebuild the example library
    return demoOn && me ? buildDemoLibrary(me) : null;
  }, [demoOn, me, demoSeed]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      router.replace("/login");
    }
  }, [signOut, router]);

  if (loading || !data) {
    return (
      <main
        className="fixed inset-0 flex items-center justify-center bg-ink"
        style={{ height: "100dvh" }}
      >
        <span
          className="micro"
          style={{
            color: !loading && error ? "#F04438" : "rgba(243,241,237,0.35)",
          }}
        >
          {!loading && error ? error : "PHYSIQUEMAXX"}
        </span>
      </main>
    );
  }

  const lastWeightKg =
    data[data.me].find((c) => c.weightKg !== null)?.weightKg ?? null;

  return (
    <LibraryShell
      items={
        demoLib
          ? demoLib.items
          : { luke: data.luke, rowan: data.rowan, us: data.us }
      }
      analyses={demoLib ? demoLib.analyses : data.analyses}
      profile={data.myProfile}
      email={data.email}
      partnerName={data.partnerName}
      lastWeightKg={lastWeightKg}
      defaultScope={data.me}
      me={data.me}
      ownerIds={resolveOwnerIds(data)}
      momentumCount={momentumCount}
      demo={demoOn}
      demoSeed={demoSeed}
      onEnterDemo={() => setDemoOn(true)}
      onExitDemo={() => setDemoOn(false)}
      onResetDemo={() => setDemoSeed((s) => s + 1)}
      onSaveCheckIn={saveCheckIn}
      onSaveProfile={(p) => {
        saveProfile(p).catch(() => {});
      }}
      onSignOut={() => {
        void handleSignOut();
      }}
      onRequestAnalysis={async (checkinId) => {
        await requestAnalysis(checkinId);
      }}
      onFetchAnalysis={fetchAnalysis}
      onLoadMore={loadMore}
      hasMore={hasMore}
    />
  );
}

/* --------------------------------------------------------------- shell */

type SheetKind = "menu" | "capture" | "import" | "profile" | null;

function LibraryShell({
  items,
  analyses,
  profile,
  email,
  partnerName,
  lastWeightKg,
  defaultScope,
  me,
  ownerIds,
  momentumCount,
  demo = false,
  demoSeed = 0,
  onEnterDemo,
  onExitDemo,
  onResetDemo,
  onSaveCheckIn,
  onSaveProfile,
  onSignOut,
  onRequestAnalysis,
  onFetchAnalysis,
  onLoadMore,
  hasMore,
}: {
  items: Record<Scope, CheckIn[]>;
  analyses: Record<string, AnalysisResult>;
  profile: Profile;
  email: string | null;
  partnerName: string | null;
  lastWeightKg: number | null;
  defaultScope: Scope;
  /** the signed-in member — only their own check-ins can run an analysis */
  me?: Owner;
  /** owner handle → subject profile id (from the loaded library; never hard-coded) */
  ownerIds?: Partial<Record<Owner, string>>;
  /** live_capture check-ins with a front photo, trailing 90 days (server-computed) */
  momentumCount: number;
  demo?: boolean;
  demoSeed?: number;
  onEnterDemo?: () => void;
  onExitDemo?: () => void;
  onResetDemo?: () => void;
  onSaveCheckIn: SaveCheckInFn;
  onSaveProfile: (p: Profile) => void;
  onSignOut: () => void;
  onRequestAnalysis?: (checkinId: string) => Promise<void>;
  /** loads the full latest result on demand (merged into `analyses`) */
  onFetchAnalysis?: (checkinId: string) => Promise<AnalysisResult | null>;
  /** next older page across scopes */
  onLoadMore?: () => Promise<void>;
  /** whether an older page exists per owner scope */
  hasMore?: Record<Owner, boolean>;
}) {
  const layout = useDeckLayout();
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [view, setView] = useState<"cards" | "timeline">("cards");
  const [indices, setIndices] = useState<Record<Scope, number>>({
    luke: 0,
    rowan: 0,
    us: 0,
  });
  // Ambient can lead the committed index by one during a drag (30% rule).
  const [ambientIndex, setAmbientIndex] = useState(0);
  const [detail, setDetail] = useState<CheckIn | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // The subject + submission id are FROZEN when a capture session begins, in
  // their own state — a later Luke/Rowan tab change never retargets an
  // in-progress capture. A retry reuses this submissionId; a fresh Add flow
  // generates a new one (see openAdd / handleSubject).
  const [capture, setCapture] = useState<{
    subject: Owner;
    submissionId: string;
  } | null>(null);

  // Entering/resetting demo re-seats the library view on the example data —
  // adjusted during render (never a sync set in an effect), same pattern as
  // the ambient A/B buffer.
  const demoKey = demo ? `demo-${demoSeed}` : "live";
  const [seenDemoKey, setSeenDemoKey] = useState(demoKey);
  if (seenDemoKey !== demoKey) {
    setSeenDemoKey(demoKey);
    if (demo) {
      setIndices({ luke: 0, rowan: 0, us: 0 });
      setAmbientIndex(0);
      setDetail(null);
      setView("cards");
      setSheet(null);
    }
  }

  const scoped = items[scope];
  const activeIndex = Math.min(indices[scope], Math.max(0, scoped.length - 1));
  const active = scoped.length > 0 ? scoped[activeIndex] : null;
  const ambient =
    scoped.length > 0
      ? (scoped[Math.min(ambientIndex, scoped.length - 1)] ?? active)
      : null;

  const handleScope = useCallback(
    (s: Scope) => {
      setScope(s);
      setAmbientIndex(indices[s]);
    },
    [indices],
  );

  const handleNavigate = useCallback(
    (index: number) => {
      setIndices((prev) => ({ ...prev, [scope]: index }));
      setAmbientIndex(index);
    },
    [scope],
  );

  const handleOpenActive = useCallback(() => {
    const list = items[scope];
    if (list.length === 0) return;
    setDetail(list[Math.min(indices[scope], list.length - 1)] ?? null);
  }, [items, indices, scope]);

  // ---- analysis (with in-flight state for honest ANALYZING labels) ----
  const runAnalysis = useMemo(() => {
    if (!onRequestAnalysis || demo) return undefined;
    return async (checkinId: string) => {
      setAnalyzingId(checkinId);
      try {
        await onRequestAnalysis(checkinId);
      } finally {
        setAnalyzingId(null);
      }
    };
  }, [onRequestAnalysis, demo]);

  // ---- frozen capture subject (resolved to the subject's profile id) ----
  const captureSubject = capture?.subject ?? null;
  const captureSubmissionId = capture?.submissionId ?? "";
  const captureSubjectUserId = captureSubject
    ? (ownerIds?.[captureSubject] ?? "")
    : "";
  const captureSubjectLabel = captureSubject ? captureSubject.toUpperCase() : "";

  const myOwner: Owner = me ?? (defaultScope === "us" ? "luke" : defaultScope);
  // Historical "already have this date" hint reflects the FROZEN subject.
  const subjectDates = useMemo(
    () => new Set(items[captureSubject ?? myOwner].map((c) => c.date)),
    [items, captureSubject, myOwner],
  );

  const scopeHasMore = hasMore
    ? scope === "us"
      ? hasMore.luke || hasMore.rowan
      : hasMore[scope]
    : true; // old contract exposes no paging flags — keep the row available
  const handleLoadMore =
    onLoadMore && !demo && scopeHasMore ? onLoadMore : undefined;

  // ---- derived chrome ----
  const chromeOut = detail !== null;
  const selectorWidth = layout.desktop
    ? 342
    : Math.min(layout.viewportW, 430) - 32;

  const scopeTitle =
    scope === "us"
      ? "SHARED ARCHIVE"
      : scope === myOwner
        ? "YOUR ARCHIVE"
        : `${(partnerName ?? scope).toUpperCase()}'S ARCHIVE`;

  const showEmber = !demo && scope === myOwner;
  const emberDisplay =
    momentumCount >= 12 ? "12+" : String(Math.max(0, momentumCount));

  const emptyVariant: "own" | "partner" | "us" =
    scope === "us" ? "us" : scope === myOwner ? "own" : "partner";

  // Detail always reflects the freshest data for that check-in id.
  const detailItem = detail
    ? (items.us.find((c) => c.id === detail.id) ?? detail)
    : null;
  const detailAnalysis = detailItem ? (analyses[detailItem.id] ?? null) : null;

  // The library page loads summary columns only — pull the full result on
  // demand when a record opens (merged upstream into `analyses`).
  const fetchedAnalyses = useRef<Set<string>>(new Set());
  const detailId = detailItem?.id ?? null;
  useEffect(() => {
    if (!detailId || demo || !onFetchAnalysis) return;
    if (fetchedAnalyses.current.has(detailId)) return;
    fetchedAnalyses.current.add(detailId);
    onFetchAnalysis(detailId).catch(() => {
      fetchedAnalyses.current.delete(detailId);
    });
  }, [detailId, demo, onFetchAnalysis]);
  // Analysis is a CREATOR right (canAnalyze === creator is me), not a subject
  // one — fall back to owner === me until the field lands.
  const detailRequest =
    runAnalysis &&
    detailItem &&
    ((detailItem as { canAnalyze?: boolean }).canAnalyze ??
      detailItem.owner === me)
      ? () => runAnalysis(detailItem.id)
      : undefined;

  const openAdd = () => {
    if (demo) onExitDemo?.();
    // Freeze the subject + a fresh submission id at capture start. Individual
    // scopes freeze the current subject immediately; US defers to the menu's
    // LUKE / ROWAN step (never defaulted silently).
    setCapture(
      scope === "us"
        ? null
        : { subject: scope, submissionId: crypto.randomUUID() },
    );
    setSheet("menu");
  };

  // US subject chosen in the menu — freeze it with a fresh submission id.
  const handleSubject = (owner: Owner) => {
    setCapture({ subject: owner, submissionId: crypto.randomUUID() });
  };

  // ≥768px: the three-zone archive workspace (§4) — 768–1023 in drawer mode,
  // ≥1024 with the full rail/stage/snapshot row. Below 768 the phone
  // experience renders unchanged. (Initial SSR layout is the 390px baseline,
  // so both environments hydrate identically before measuring.)
  const workspace = layout.viewportW >= 768;

  if (workspace) {
    return (
      <main
        className="pm-grain pm-vignette fixed inset-0 overflow-hidden bg-ink"
        style={{ height: "100dvh" }}
      >
        <AmbientBackdrop
          mode={active ? "photo" : "empty"}
          palette={active?.palette}
        />

        <DesktopWorkspace
          items={scoped}
          scope={scope}
          onScopeChange={handleScope}
          view={view}
          onViewChange={setView}
          activeIndex={activeIndex}
          onNavigate={handleNavigate}
          analyses={analyses}
          archiveTitle={scopeTitle}
          showOwner={scope === "us"}
          demo={demo}
          analyzingId={analyzingId}
          momentumCount={momentumCount}
          showEmber={showEmber}
          emptyVariant={emptyVariant}
          partnerName={partnerName}
          me={myOwner}
          onRequestAnalysis={runAnalysis}
          onFetchAnalysis={demo ? undefined : onFetchAnalysis}
          onLoadMore={handleLoadMore}
          onOpenDetail={(item) => setDetail(item)}
          onAdd={openAdd}
          onProfile={() => setSheet("profile")}
          onEnterDemo={
            emptyVariant === "own" && !demo && onEnterDemo
              ? onEnterDemo
              : undefined
          }
          keysEnabled={!detail && !sheet}
          drawer={layout.viewportW < 1024}
        />

        {/* demo controls — always visible while the example library is on */}
        {demo && (
          <div
            className="absolute inset-x-0 z-40 flex justify-center"
            style={{ bottom: 28 }}
          >
            <div
              className="flex items-center rounded-full pl-3 pr-1"
              style={{
                height: 44,
                background: "rgba(10, 11, 10, 0.85)",
                border: "1px solid rgba(255, 101, 55, 0.5)",
              }}
            >
              <span className="micro" style={{ color: "var(--color-ember)" }}>
                EXAMPLE DATA
              </span>
              <button
                onClick={onResetDemo}
                className="micro px-3 text-bone/75"
                style={{ minHeight: 44 }}
              >
                RESET DEMO
              </button>
              <button
                onClick={onExitDemo}
                className="micro px-3 text-bone"
                style={{ minHeight: 44 }}
              >
                EXIT DEMO
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {detailItem && (
            <DetailView
              key={detailItem.id}
              item={detailItem}
              analysis={detailAnalysis}
              layout={layout}
              onClose={() => setDetail(null)}
              onRequestAnalysis={detailRequest}
            />
          )}
          {sheet === "menu" && (
            <AddCheckInMenu
              key="menu"
              desktop
              requireSubject={scope === "us"}
              subject={captureSubject}
              me={myOwner}
              onSubject={handleSubject}
              onClose={() => setSheet(null)}
              onToday={() => setSheet("capture")}
              onPast={() => setSheet("import")}
            />
          )}
          {sheet === "capture" && (
            <DesktopModal
              key="capture"
              width={760}
              onClose={() => setSheet(null)}
            >
              <CaptureSheet
                contained
                lastWeightKg={lastWeightKg}
                subjectUserId={captureSubjectUserId}
                submissionId={captureSubmissionId}
                subjectLabel={captureSubjectLabel}
                onClose={() => setSheet(null)}
                onSave={onSaveCheckIn}
                onAnalyze={runAnalysis}
              />
            </DesktopModal>
          )}
          {sheet === "import" && (
            <DesktopModal
              key="import"
              width={860}
              onClose={() => setSheet(null)}
            >
              <HistoricalImportSheet
                contained
                myDates={subjectDates}
                subjectUserId={captureSubjectUserId}
                submissionId={captureSubmissionId}
                subjectLabel={captureSubjectLabel}
                onClose={() => setSheet(null)}
                onSave={onSaveCheckIn}
                onAnalyze={runAnalysis}
              />
            </DesktopModal>
          )}
          {sheet === "profile" && (
            <AccountSheet
              key="profile"
              desktop
              profile={profile}
              email={email}
              pairedWith={partnerName}
              onClose={() => setSheet(null)}
              onSaveProfile={onSaveProfile}
              onSignOut={() => {
                setSheet(null);
                onSignOut();
              }}
            />
          )}
        </AnimatePresence>
      </main>
    );
  }

  return (
    <main
      className="pm-grain pm-vignette fixed inset-0 overflow-hidden bg-ink"
      style={{ height: "100dvh" }}
    >
      <AmbientBackdrop
        mode={ambient ?? active ? "photo" : "empty"}
        palette={(ambient ?? active)?.palette}
      />

      {/* header stack: scope control → 24 → title row — fades while detail is open */}
      <motion.div
        className="absolute inset-x-0 z-30"
        style={{ top: "max(env(safe-area-inset-top), 16px)" }}
        animate={{ opacity: chromeOut ? 0 : 1, y: chromeOut ? -14 : 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <div
          className="mx-auto w-full"
          style={{ maxWidth: 430, paddingLeft: 16, paddingRight: 16 }}
        >
          <ScopeSelector
            scope={scope}
            onChange={handleScope}
            width={selectorWidth}
          />
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 24, height: 44 }}
          >
            <h1
              className="masthead min-w-0 truncate text-bone"
              style={{ fontSize: 28, lineHeight: 1 }}
            >
              {scopeTitle}
            </h1>
            {/* Ember + view toggle only make sense with records — an empty
                archive keeps the header a clean, balanced single title. */}
            {scoped.length > 0 && (
              <div className="flex shrink-0 items-center gap-2.5">
                {!demo && showEmber && (
                  <span
                    className="pointer-events-none"
                    title={`${momentumCount} live check-ins in the trailing 90 days`}
                  >
                    <ConsistencyEmber
                      count={momentumCount}
                      reducedLabel={`${emberDisplay} · 90 DAYS`}
                    />
                  </span>
                )}
                <ViewToggle view={view} onChange={setView} />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* library body */}
      {scoped.length === 0 ? (
        <EmptyLibrary
          key={`empty-${scope}`}
          variant={emptyVariant}
          partnerName={partnerName}
          top={layout.headerBottom}
          onAdd={emptyVariant === "own" ? openAdd : undefined}
          onViewExample={
            emptyVariant === "own" && !demo && onEnterDemo
              ? onEnterDemo
              : undefined
          }
        />
      ) : view === "timeline" ? (
        <TimelineList
          key={`timeline-${scope}`}
          items={scoped}
          top={layout.headerBottom}
          showOwner={scope === "us"}
          demo={demo}
          analyzingId={analyzingId}
          onOpen={(item) => setDetail(item)}
          onLoadMore={handleLoadMore}
        />
      ) : (
        active && (
          <>
            {/* The date lives on the card in the redesign (§3 board): the
                behind-deck masthead is retired so the header, card, and
                background stop fighting. */}
            <Deck
              items={scoped}
              activeIndex={activeIndex}
              scopeKey={`${scope}-${demoKey}`}
              exitY={layout.exitY}
              cardW={layout.cardW}
              cardH={layout.cardH}
              deckTop={layout.deckTop}
              enabled={!detail && !sheet}
              cardRadius={layout.radius}
              showOwner={scope === "us"}
              demo={demo}
              analyzingId={analyzingId}
              onNavigate={handleNavigate}
              onAmbientTarget={setAmbientIndex}
              onOpenActive={handleOpenActive}
            />
          </>
        )
      )}

      {/* demo controls — always visible while the example library is on */}
      {demo && (
        <motion.div
          className="absolute inset-x-0 z-40 flex justify-center"
          style={{
            bottom: "calc(max(env(safe-area-inset-bottom), 18px) + 80px)",
          }}
          animate={{ opacity: chromeOut ? 0 : 1 }}
          transition={{ duration: 0.16 }}
        >
          <div
            className="flex items-center rounded-full pl-3 pr-1"
            style={{
              height: 44,
              background: "rgba(10, 11, 10, 0.85)",
              border: "1px solid rgba(255, 101, 55, 0.5)",
            }}
          >
            <span className="micro" style={{ color: "var(--color-ember)" }}>
              EXAMPLE DATA
            </span>
            <button
              onClick={onResetDemo}
              className="micro px-3 text-bone/75"
              style={{ minHeight: 44 }}
            >
              RESET DEMO
            </button>
            <button
              onClick={onExitDemo}
              className="micro px-3 text-bone"
              style={{ minHeight: 44 }}
            >
              EXIT DEMO
            </button>
          </div>
        </motion.div>
      )}

      {/* floating bottom navigation */}
      <motion.div
        className="absolute inset-x-0 z-40 flex justify-center"
        style={{ bottom: "max(env(safe-area-inset-bottom), 18px)" }}
        animate={{ opacity: chromeOut ? 0 : 1, y: chromeOut ? 16 : 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <BottomPill
          active={sheet === "profile" ? "profile" : "library"}
          onLibrary={() => {
            setDetail(null);
            setSheet(null);
          }}
          onAdd={openAdd}
          onProfile={() => setSheet("profile")}
        />
      </motion.div>

      <AnimatePresence>
        {detailItem && (
          <DetailView
            key={detailItem.id}
            item={detailItem}
            analysis={detailAnalysis}
            layout={layout}
            onClose={() => setDetail(null)}
            onRequestAnalysis={detailRequest}
          />
        )}
        {sheet === "menu" && (
          <AddCheckInMenu
            key="menu"
            requireSubject={scope === "us"}
            subject={captureSubject}
            me={myOwner}
            onSubject={handleSubject}
            onClose={() => setSheet(null)}
            onToday={() => setSheet("capture")}
            onPast={() => setSheet("import")}
          />
        )}
        {sheet === "capture" && (
          <CaptureSheet
            key="capture"
            lastWeightKg={lastWeightKg}
            subjectUserId={captureSubjectUserId}
            submissionId={captureSubmissionId}
            subjectLabel={captureSubjectLabel}
            onClose={() => setSheet(null)}
            onSave={onSaveCheckIn}
            onAnalyze={runAnalysis}
          />
        )}
        {sheet === "import" && (
          <HistoricalImportSheet
            key="import"
            myDates={subjectDates}
            subjectUserId={captureSubjectUserId}
            submissionId={captureSubmissionId}
            subjectLabel={captureSubjectLabel}
            onClose={() => setSheet(null)}
            onSave={onSaveCheckIn}
            onAnalyze={runAnalysis}
          />
        )}
        {sheet === "profile" && (
          <AccountSheet
            key="profile"
            profile={profile}
            email={email}
            pairedWith={partnerName}
            onClose={() => setSheet(null)}
            onSaveProfile={onSaveProfile}
            onSignOut={() => {
              setSheet(null);
              onSignOut();
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
