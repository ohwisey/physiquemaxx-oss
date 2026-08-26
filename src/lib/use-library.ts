"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckIn, Profile, ViewAngle } from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { SourceKind } from "@/lib/db-types";
import {
  AnalysisRequestError,
  SIGNED_URL_REFRESH_AGE_MS,
  fetchAnalysis as fetchAnalysisData,
  fetchLibrary,
  loadMoreLibrary,
  refreshLibraryUrls,
  requestAnalysis as requestAnalysisData,
  saveCheckIn as saveCheckInData,
  saveProfile as saveProfileData,
  signOut as signOutData,
  type LibraryData,
  type SaveCheckInResult,
} from "@/lib/data";

export interface SaveCheckInOptions {
  /**
   * REQUIRED. Profile id of the depicted subject, frozen when the capture
   * session begins (the active scope's owner — self or the pair partner).
   */
  subjectUserId: string;
  /**
   * REQUIRED. Per-capture-session UUID, frozen at capture start and reused
   * across retries; a new session mints a new one. Append-only idempotency key.
   */
  submissionId: string;
  /** historical local date (YYYY-MM-DD); omitted → today's live check-in */
  date?: string;
  /** historical archive-only: kept on the timeline, never scored/compared */
  archiveOnly?: boolean;
  /** provenance of this save's photos; defaults to live_capture */
  sourceKind?: SourceKind;
}

/**
 * Client state over the data layer — paged load, explicit refresh, on-demand
 * full analyses, signed-URL upkeep, and the transient "error" overlay for
 * failed analysis requests (never persisted; §5 state matrix).
 */
export function useLibrary(): {
  loading: boolean;
  error: string | null;
  data: LibraryData | null;
  refresh: () => Promise<void>;
  /** legacy-compatible signature; use saveCheckInDetailed for the result */
  saveCheckIn: (
    files: Partial<Record<ViewAngle, File>>,
    weightKg: number | null,
    options: SaveCheckInOptions,
  ) => Promise<void>;
  saveCheckInDetailed: (
    files: Partial<Record<ViewAngle, File>>,
    weightKg: number | null,
    options: SaveCheckInOptions,
  ) => Promise<SaveCheckInResult>;
  saveProfile: (p: Profile) => Promise<void>;
  requestAnalysis: (checkinId: string) => Promise<AnalysisResult>;
  /** full latest result on demand; merged into data.analyses */
  fetchAnalysis: (checkinId: string) => Promise<AnalysisResult | null>;
  /** next (older) page for scopes that still have more */
  loadMore: () => Promise<void>;
  /** re-sign photo URLs — image-error retry; auto-run when a visible tab's URLs age out */
  refreshUrls: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<LibraryData | null>(null);
  // Check-ins whose last analysis REQUEST failed (transport/server/model) —
  // a client-runtime overlay, distinct from the persisted retake_needed.
  const [failedRequests, setFailedRequests] = useState<ReadonlySet<string>>(new Set());
  const alive = useRef(true);
  const lastUrlRefresh = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchLibrary();
      if (!alive.current) return;
      setRawData(next);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // False positive: every setState inside refresh() happens after an await,
    // never synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const refreshUrls = useCallback(async () => {
    const current = rawData;
    if (!current) return;
    // Throttle: at most one re-sign per 30s regardless of how many images error.
    if (Date.now() - lastUrlRefresh.current < 30_000) return;
    lastUrlRefresh.current = Date.now();
    try {
      const next = await refreshLibraryUrls(current);
      if (alive.current) setRawData(next);
    } catch {
      // Losing a URL refresh is benign — the next visibility change retries.
    }
  }, [rawData]);

  // Signed URLs age out after ~50min: refresh them when the tab comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (rawData && Date.now() - rawData.signedAt > SIGNED_URL_REFRESH_AGE_MS) {
        void refreshUrls();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [rawData, refreshUrls]);

  const saveCheckInDetailed = useCallback(
    async (
      files: Partial<Record<ViewAngle, File>>,
      weightKg: number | null,
      options: SaveCheckInOptions,
    ): Promise<SaveCheckInResult> => {
      const result = await saveCheckInData({
        files,
        weightKg,
        subjectUserId: options.subjectUserId,
        submissionId: options.submissionId,
        sourceKind: options.sourceKind ?? "live_capture",
        date: options.date,
        archiveOnly: options.archiveOnly,
      });
      await refresh();
      return result;
    },
    [refresh],
  );

  const saveCheckIn = useCallback(
    async (
      files: Partial<Record<ViewAngle, File>>,
      weightKg: number | null,
      options: SaveCheckInOptions,
    ): Promise<void> => {
      await saveCheckInDetailed(files, weightKg, options);
    },
    [saveCheckInDetailed],
  );

  const saveProfile = useCallback(
    async (p: Profile) => {
      await saveProfileData(p);
      await refresh();
    },
    [refresh],
  );

  const requestAnalysis = useCallback(
    async (checkinId: string): Promise<AnalysisResult> => {
      try {
        // data.ts dedupes concurrent requests per check-in (shared promise).
        const { result } = await requestAnalysisData(checkinId);
        if (alive.current) {
          setFailedRequests((prev) => {
            if (!prev.has(checkinId)) return prev;
            const next = new Set(prev);
            next.delete(checkinId);
            return next;
          });
          setRawData((prev) =>
            prev
              ? { ...prev, analyses: { ...prev.analyses, [checkinId]: result } }
              : prev,
          );
        }
        await refresh();
        return result;
      } catch (e) {
        // Only request/transport/persistence failures become the ERROR state;
        // ownership/photo/cooldown refusals surface as messages, and the
        // persisted card state (e.g. retake_needed) stays authoritative.
        if (
          alive.current &&
          e instanceof AnalysisRequestError &&
          (e.code === "transport" || e.code === "server" || e.code === "model_invalid")
        ) {
          setFailedRequests((prev) => new Set(prev).add(checkinId));
        }
        throw e;
      }
    },
    [refresh],
  );

  const fetchAnalysis = useCallback(
    async (checkinId: string): Promise<AnalysisResult | null> => {
      const result = await fetchAnalysisData(checkinId);
      if (result && alive.current) {
        setRawData((prev) =>
          prev
            ? { ...prev, analyses: { ...prev.analyses, [checkinId]: result } }
            : prev,
        );
      }
      return result;
    },
    [],
  );

  const loadMore = useCallback(async () => {
    const current = rawData;
    if (!current || (!current.hasMore.luke && !current.hasMore.rowan)) return;
    const next = await loadMoreLibrary(current);
    if (alive.current) setRawData(next);
  }, [rawData]);

  const signOut = useCallback(async () => {
    await signOutData();
  }, []);

  // Overlay the transient request-error state onto the persisted statuses.
  const data = useMemo((): LibraryData | null => {
    if (!rawData || failedRequests.size === 0) return rawData;
    const overlay = (items: CheckIn[]): CheckIn[] =>
      items.map((c) =>
        failedRequests.has(c.id)
          ? { ...c, analysisStatus: "error", rating: null, delta: null }
          : c,
      );
    return {
      ...rawData,
      luke: overlay(rawData.luke),
      rowan: overlay(rawData.rowan),
      us: overlay(rawData.us),
    };
  }, [rawData, failedRequests]);

  return {
    loading,
    error,
    data,
    refresh,
    saveCheckIn,
    saveCheckInDetailed,
    saveProfile,
    requestAnalysis,
    fetchAnalysis,
    loadMore,
    refreshUrls,
    signOut,
  };
}
