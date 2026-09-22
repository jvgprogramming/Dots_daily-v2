"use client";

import { useEffect, useRef } from "react";

/** How often a visible admin view re-checks the API for new patient activity. */
export const AUTO_REFRESH_MS = 30_000;

/**
 * Keeps an admin view current without a manual click.
 *
 * Re-runs `refresh` every `intervalMs` while the tab is visible, and again the
 * moment it regains focus — so a dose a patient logs on their phone appears on
 * the dashboard without anyone pressing Refresh.
 *
 * Pass a *quiet* refresh: one that leaves the page's `loading` state alone. That
 * way polling updates the numbers in place instead of flashing a skeleton over
 * perfectly good data every 30 seconds. The manual Refresh button stays as it
 * is, for when someone wants an answer right now.
 */
export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  intervalMs: number = AUTO_REFRESH_MS
) {
  // Held in a ref, updated after render, so the fresh closure each render never
  // restarts the timer and the interval never closes over stale state.
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    const tick = () => {
      // A hidden tab has no one looking at it; the focus handler covers coming back.
      if (document.visibilityState !== "visible") return;
      void refreshRef.current();
    };

    const id = window.setInterval(tick, intervalMs);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);
}
