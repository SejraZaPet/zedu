import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyBanners } from "@/hooks/useMyBanners";
import { BANNERS_CHANGE_EVENT, clearDismissedBanners, countNewBanners, markBannersSeen } from "@/lib/banners";

export const BANNERS_RESTORE_EVENT = "bezli:banners-restore";
export const BANNERS_ANCHOR_ID = "dashboard-banners";

/** Clears stored dismissals (safe if storage is unavailable) and asks the carousel to reappear. */
export function restoreDismissedBanners() {
  clearDismissedBanners();
  try { window.dispatchEvent(new Event(BANNERS_RESTORE_EVENT)); } catch { /* ignore */ }
}

function scrollToBanners() {
  const run = () => {
    const el = document.getElementById(BANNERS_ANCHOR_ID);
    if (!el) return false;
    let reduce = false;
    try { reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { /* ignore */ }
    el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
    return true;
  };
  requestAnimationFrame(() => { if (!run()) setTimeout(run, 50); });
}

export function newsButtonLabel(count: number): string {
  if (count <= 0) return "Novinky";
  if (count === 1) return "Novinky, 1 nová";
  if (count <= 4) return `Novinky, ${count} nové`;
  return `Novinky, ${count} nových`;
}

/** "Novinky" — rendered only when the user has active banners; shows a quiet count of new ones. */
export function BannersNewsButton() {
  const { data } = useMyBanners();
  const [shown, setShown] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(BANNERS_CHANGE_EVENT, on);
    return () => window.removeEventListener(BANNERS_CHANGE_EVENT, on);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 2500);
    return () => clearTimeout(t);
  }, [shown]);
  if (!data || data.length === 0) return null;
  const count = countNewBanners(data);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={newsButtonLabel(count)}
      onClick={() => {
        markBannersSeen(data.map((b) => b.id));
        restoreDismissedBanners();
        scrollToBanners();
        setShown(true);
      }}
    >
      <Megaphone className="mr-1 h-4 w-4" aria-hidden />
      Novinky
      {count > 0 && (
        <span
          data-testid="news-count"
          aria-hidden
          className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-foreground"
        >
          {count}
        </span>
      )}
      <span className="sr-only" aria-live="polite">{shown ? "Novinky jsou zobrazeny" : ""}</span>
    </Button>
  );
}

export default BannersNewsButton;
