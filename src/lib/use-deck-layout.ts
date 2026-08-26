"use client";

import { useEffect, useState } from "react";
import { CARD_ASPECT } from "./geometry";

/** Mobile card ratio per DESIGN_SPEC §3 — roughly 0.70 width/height. */
const MOBILE_ASPECT = 0.7;

/** Mobile header stack (px, below the 16px safe-area floor):
 * scope control 52 + 24 gap + header row 44 + 12 gap. */
const SCOPE_H = 52;
const SCOPE_GAP = 24;
const HEADER_ROW_H = 44;
const HEADER_GAP = 12;

export interface DeckLayout {
  viewportW: number;
  viewportH: number;
  safeTop: number;
  cardW: number;
  cardH: number;
  /** active-card corner radius (26 mobile, 28 desktop) */
  radius: number;
  dateTop: number;
  dateSize: number;
  deckTop: number;
  /** y below which library content (deck/timeline/empty) begins */
  headerBottom: number;
  /** y (deck-local) at which an exiting card is fully below the viewport */
  exitY: number;
  /** scale factor vs the 390px mobile baseline */
  f: number;
  desktop: boolean;
}

/**
 * The real top inset. The header is positioned with CSS
 * `max(env(safe-area-inset-top), 16px)`, so every JS-computed body offset
 * (deck, timeline, empty) must use the SAME value or it collides with the
 * header on notched devices. env() isn't readable in JS directly, so we probe
 * it once with a hidden element; SSR and the pre-measure client render use the
 * 16px floor and reflow to the true value on mount.
 */
function measureSafeTop(): number {
  if (typeof document === "undefined") return 16;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;height:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)";
  document.body.appendChild(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return Math.max(16, inset);
}

function compute(vw: number, vh: number, safeTop: number): DeckLayout {
  const desktop = vw >= 1024;

  if (desktop) {
    // Desktop: cinematic centered deck, active card ~440–480px, capped so the
    // full stack + masthead fit the viewport height. (A desktop pass follows —
    // keep these values stable for now.)
    let cardW = Math.min(460, Math.floor((vh - 320) * CARD_ASPECT));
    cardW = Math.max(cardW, 316);
    const cardH = Math.round(cardW / CARD_ASPECT);
    const f = cardW / 316;
    const s = Math.min(f, 1.45);
    const dateTop = safeTop + Math.round(142 * s);
    const dateSize = Math.round(62 * s);
    const deckTop = safeTop + Math.round(188 * s);
    return {
      viewportW: vw,
      viewportH: vh,
      safeTop,
      cardW,
      cardH,
      radius: 28,
      dateTop,
      dateSize,
      deckTop,
      headerBottom: safeTop + SCOPE_H + SCOPE_GAP + HEADER_ROW_H + HEADER_GAP,
      exitY: vh - deckTop + 80,
      f,
      desktop,
    };
  }

  // Mobile (§3): scope control → 24 → YOUR ARCHIVE row → 12, then a slim
  // date band. The giant date (54px) sits behind the deck so the rear card
  // caps clip its glyph bottoms — the load-bearing depth cue — without ever
  // fighting the header row above it.
  const headerBottom = safeTop + SCOPE_H + SCOPE_GAP + HEADER_ROW_H + HEADER_GAP;
  const dateSize = 54;
  const dateTop = headerBottom + 2;
  const deckTop = headerBottom + 38;

  // Active card: full-bleed minus 16px insets, max 398, ratio ~0.70 — shrunk
  // only when a short viewport would push it under the floating nav.
  let cardW = Math.min(vw - 32, 398);
  const maxCardH = vh - deckTop - 96; // floating nav + home indicator clearance
  cardW = Math.max(240, Math.min(cardW, Math.floor(maxCardH * MOBILE_ASPECT)));
  const cardH = Math.round(cardW / MOBILE_ASPECT);
  const f = cardW / 316;

  return {
    viewportW: vw,
    viewportH: vh,
    safeTop,
    cardW,
    cardH,
    radius: 26,
    dateTop,
    dateSize,
    deckTop,
    headerBottom,
    exitY: vh - deckTop + 80,
    f,
    desktop,
  };
}

export function useDeckLayout(): DeckLayout {
  // SSR-stable initial layout (390×844 baseline); measured after mount so the
  // server and first client render always match.
  const [layout, setLayout] = useState<DeckLayout>(() => compute(390, 844, 16));

  useEffect(() => {
    const update = () =>
      setLayout(compute(window.innerWidth, window.innerHeight, measureSafeTop()));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return layout;
}
