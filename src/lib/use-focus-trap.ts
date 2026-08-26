"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus containment for sheets/modals (spec §8): moves focus in on mount
 * (honoring [data-autofocus]), cycles Tab/Shift+Tab inside the node, fires
 * `onEscape` on Escape, and restores focus to the previously focused element
 * on unmount. Attach the returned ref to the dialog element and give it
 * tabIndex={-1} so it can take focus when nothing else is focusable.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  onEscape?: () => void,
) {
  const ref = useRef<T | null>(null);
  const escape = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    escape.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );

    const initial =
      node.querySelector<HTMLElement>("[data-autofocus]") ??
      focusables()[0] ??
      node;
    initial.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        escape.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && node.contains(active);
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      // Restore only when focus is still ours (or was lost to the body). A
      // successor dialog that has already claimed focus — e.g. the capture
      // sheet opened from the add menu, whose exit animation delays this
      // cleanup — must never have it stolen back.
      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement) ||
        active === document.body ||
        node.contains(active)
      ) {
        previous?.focus({ preventScroll: true });
      }
    };
  }, []);

  return ref;
}
