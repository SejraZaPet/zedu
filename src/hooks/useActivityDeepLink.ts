import { useEffect, useState } from "react";

/**
 * Deep-link na konkrétní aktivitu v lekci: `?aktivita=<index>`
 * (index = pozice bloku mezi viditelnými bloky lekce — stejná logika,
 * jakou používá ukládání výsledků aktivit).
 *
 * Po načtení obsahu odscrolluje na daný aktivitový blok a vrátí jeho index,
 * aby ho stránka mohla krátce vizuálně zvýraznit.
 */
export function useActivityDeepLink(ready: boolean, resetKey?: string | null) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("aktivita");
    if (raw === null) return;
    const idx = Number(raw);
    if (!Number.isInteger(idx) || idx < 0) return;

    setHighlightedIndex(idx);
    const scrollTimer = window.setTimeout(() => {
      document
        .querySelector(`[data-activity-index="${idx}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    const clearTimer = window.setTimeout(() => setHighlightedIndex(null), 6000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [ready, resetKey]);

  return highlightedIndex;
}

/** Třídy pro krátké zvýraznění bloku, na který mířil QR kód. */
export const ACTIVITY_HIGHLIGHT_CLASS =
  "rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-shadow duration-500";
