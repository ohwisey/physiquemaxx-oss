import type { CheckIn, Scope } from "./types";

/**
 * Seeded fixture check-ins for the visual/motion prototype phases.
 * Replaced by Supabase data in Phase 5. Palettes are precomputed dominant
 * colors (in production they are computed once at upload time).
 *
 * The append-only fields (createdAt, canAnalyze) are synthesized uniformly for
 * these static fixtures: a noon createdAt derived from the date, and canAnalyze
 * true (the prototype viewer "owns" the seed).
 */

type SeedCheckIn = Omit<CheckIn, "createdAt" | "canAnalyze">;

function seedToCheckIn(c: SeedCheckIn): CheckIn {
  return { ...c, createdAt: `${c.date}T12:00:00.000Z`, canAnalyze: true };
}

const luke: SeedCheckIn[] = [
  {
    id: "luke-2026-08-24",
    owner: "luke",
    date: "2026-08-24",
    photos: {
      front: "/seed/luke-01-front.jpg",
      left: "/seed/luke-01-left.jpg",
      back: "/seed/luke-01-back.jpg",
      right: "/seed/luke-01-right.jpg",
    },
    palette: { top: "#b8b3ac", mid: "#8b6a5b", bottom: "#6b584a" },
    weightKg: 73.4,
    rating: 67,
    delta: 2,
    analysisStatus: "complete",
  },
  {
    id: "luke-2026-08-17",
    owner: "luke",
    date: "2026-08-17",
    photos: { front: "/seed/luke-f-02.jpg" },
    palette: { top: "#b1aca4", mid: "#826251", bottom: "#625243" },
    weightKg: 73.0,
    rating: null,
    delta: null,
    analysisStatus: "limited",
  },
  {
    id: "luke-2026-08-10",
    owner: "luke",
    date: "2026-08-10",
    photos: {
      front: "/seed/luke-f-03.jpg",
      left: "/seed/luke-01-left.jpg",
      back: "/seed/luke-01-back.jpg",
      right: "/seed/luke-01-right.jpg",
    },
    palette: { top: "#b9b7ad", mid: "#8e6d59", bottom: "#6d5b48" },
    weightKg: 72.7,
    rating: 65,
    delta: 3,
    analysisStatus: "complete",
  },
  {
    id: "luke-2026-08-03",
    owner: "luke",
    date: "2026-08-03",
    photos: {
      front: "/seed/luke-f-04.jpg",
      back: "/seed/luke-01-back.jpg",
      right: "/seed/luke-01-right.jpg",
    },
    palette: { top: "#aeaaa2", mid: "#7d5e4e", bottom: "#5e4d3e" },
    weightKg: 72.1,
    rating: 62,
    delta: -1,
    analysisStatus: "complete",
  },
  {
    id: "luke-2026-07-27",
    owner: "luke",
    date: "2026-07-27",
    photos: {
      front: "/seed/luke-f-05.jpg",
      left: "/seed/luke-01-left.jpg",
      back: "/seed/luke-01-back.jpg",
      right: "/seed/luke-01-right.jpg",
    },
    palette: { top: "#b6aea9", mid: "#896657", bottom: "#69574a" },
    weightKg: 72.3,
    rating: 63,
    delta: 3,
    analysisStatus: "complete",
  },
  {
    id: "luke-2026-07-20",
    owner: "luke",
    date: "2026-07-20",
    photos: {
      front: "/seed/luke-f-06.jpg",
      left: "/seed/luke-01-left.jpg",
      back: "/seed/luke-01-back.jpg",
      right: "/seed/luke-01-right.jpg",
    },
    palette: { top: "#b2aea5", mid: "#856652", bottom: "#655443" },
    weightKg: 72.2,
    rating: 60,
    delta: null,
    analysisStatus: "complete",
  },
];

const rowan: SeedCheckIn[] = [
  {
    id: "rowan-2026-08-23",
    owner: "rowan",
    date: "2026-08-23",
    photos: {
      front: "/seed/rowan-01-front.jpg",
      left: "/seed/rowan-01-left.jpg",
      back: "/seed/rowan-01-back.jpg",
      right: "/seed/rowan-01-right.jpg",
    },
    palette: { top: "#a9a59f", mid: "#72594f", bottom: "#544740" },
    weightKg: 70.6,
    rating: 63,
    delta: 2,
    analysisStatus: "complete",
  },
  {
    id: "rowan-2026-08-16",
    owner: "rowan",
    date: "2026-08-16",
    photos: {
      front: "/seed/rowan-f-02.jpg",
      left: "/seed/rowan-01-left.jpg",
      back: "/seed/rowan-01-back.jpg",
      right: "/seed/rowan-01-right.jpg",
    },
    palette: { top: "#a9a6a0", mid: "#73594e", bottom: "#544740" },
    weightKg: 70.2,
    rating: 61,
    delta: 0,
    analysisStatus: "complete",
  },
  {
    id: "rowan-2026-08-09",
    owner: "rowan",
    date: "2026-08-09",
    photos: { front: "/seed/rowan-f-03.jpg" },
    palette: { top: "#a9a6a1", mid: "#745a4f", bottom: "#554740" },
    weightKg: 70.0,
    rating: null,
    delta: null,
    analysisStatus: "limited",
  },
  {
    id: "rowan-2026-08-02",
    owner: "rowan",
    date: "2026-08-02",
    photos: {
      front: "/seed/rowan-f-04.jpg",
      left: "/seed/rowan-01-left.jpg",
      back: "/seed/rowan-01-back.jpg",
      right: "/seed/rowan-01-right.jpg",
    },
    palette: { top: "#a9a6a1", mid: "#755b50", bottom: "#56473f" },
    weightKg: 69.8,
    rating: 61,
    delta: -1,
    analysisStatus: "complete",
  },
  {
    id: "rowan-2026-07-26",
    owner: "rowan",
    date: "2026-07-26",
    photos: {
      front: "/seed/rowan-f-05.jpg",
      left: "/seed/rowan-01-left.jpg",
      back: "/seed/rowan-01-back.jpg",
      right: "/seed/rowan-01-right.jpg",
    },
    palette: { top: "#a9a6a1", mid: "#775c51", bottom: "#574740" },
    weightKg: 70.1,
    rating: 62,
    delta: null,
    analysisStatus: "complete",
  },
];

const us: SeedCheckIn[] = [...luke, ...rowan].sort((a, b) =>
  b.date.localeCompare(a.date),
);

export const SEED: Record<Scope, CheckIn[]> = {
  luke: luke.map(seedToCheckIn),
  rowan: rowan.map(seedToCheckIn),
  us: us.map(seedToCheckIn),
};
