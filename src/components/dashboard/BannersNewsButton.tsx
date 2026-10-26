import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyBanners } from "@/hooks/useMyBanners";
import { DISMISS_KEY } from "@/lib/banners";

export const BANNERS_RESTORE_EVENT = "bezli:banners-restore";
export const BANNERS_ANCHOR_ID = "dashboard-banners";

/** Clears stored dismissals (safe if storage is unavailable) and asks the carousel to reappear. */
export function restoreDismissedBanners() {
  try { window.localStorage.removeItem(DISMISS_KEY); } catch { /* storage unavailable */ }
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

/** "Novinky" — rendered only when the user has active banners. */
export function BannersNewsButton() {
  const { data } = useMyBanners();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 2500);
    return () => clearTimeout(t);
  }, [shown]);
  if (!data || data.length === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => { restoreDismissedBanners(); scrollToBanners(); setShown(true); }}
    >
      <Megaphone className="mr-1 h-4 w-4" aria-hidden />
      Novinky
      <span className="sr-only" aria-live="polite">{shown ? "Novinky jsou zobrazeny" : ""}</span>
    </Button>
  );
}

export default BannersNewsButton;
