import type { CheckIn, Owner, Scope } from "@/lib/types";
import type { AnalysisResult } from "@/lib/analysis/types";
import { ANALYSIS_FIXTURES } from "@/lib/analysis/fixtures";
import { localISODate } from "@/lib/checkin-meta";

/**
 * In-memory example library for VIEW EXAMPLE (state matrix §5 "Demo"): two
 * records over the synthetic /demo figure imagery plus canonical fixture
 * results remapped onto them. Purely local — never touches live data, never
 * counts toward momentum, and every surface renders a persistent DEMO chip.
 */

export interface DemoLibrary {
  items: Record<Scope, CheckIn[]>;
  analyses: Record<string, AnalysisResult>;
}

const DEMO_PALETTE = { top: "#8a8a86", mid: "#5a544e", bottom: "#3a3632" };

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return localISODate(date);
}

export function buildDemoLibrary(me: Owner): DemoLibrary {
  const today = localISODate();

  const full: CheckIn = {
    id: "demo-full",
    owner: me,
    date: shiftDays(today, -1),
    createdAt: `${shiftDays(today, -1)}T12:00:00.000Z`,
    photos: {
      front: "/demo/front.jpg",
      left: "/demo/left.jpg",
      back: "/demo/back.jpg",
      right: "/demo/right.jpg",
    },
    palette: DEMO_PALETTE,
    weightKg: 73.4,
    // example-only values (matrix row "Demo") — never a real user's score
    rating: 67,
    delta: 2,
    analysisStatus: "complete",
    canAnalyze: true,
  };

  const limited: CheckIn = {
    id: "demo-limited",
    owner: me,
    date: shiftDays(today, -8),
    createdAt: `${shiftDays(today, -8)}T12:00:00.000Z`,
    photos: { front: "/demo/front.jpg" },
    palette: DEMO_PALETTE,
    weightKg: 73.0,
    rating: null,
    delta: null,
    analysisStatus: "limited",
    canAnalyze: true,
  };

  const analyses: Record<string, AnalysisResult> = {};
  const fullFixture: AnalysisResult | undefined =
    ANALYSIS_FIXTURES["luke-2026-08-24"];
  const limitedFixture: AnalysisResult | undefined =
    ANALYSIS_FIXTURES["luke-2026-08-17"];
  if (fullFixture) analyses[full.id] = fullFixture;
  if (limitedFixture) analyses[limited.id] = limitedFixture;

  const mine = [full, limited];
  return {
    items: {
      luke: me === "luke" ? mine : [],
      rowan: me === "rowan" ? mine : [],
      us: mine,
    } as Record<Scope, CheckIn[]>,
    analyses,
  };
}

export { DEMO_PALETTE };
