import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyBanners } from "@/hooks/useMyBanners";
import {
  MAX_VIDEO_LOOPS, bannerPublicUrl, dismissBanner, filterDismissed, isSafeHttpsUrl, type Banner,
} from "@/lib/banners";

import { BANNERS_ANCHOR_ID, BANNERS_RESTORE_EVENT } from "./BannersNewsButton";

const SEEN_KEY = "bezli.banner.hadAny";

function prefersReducedMotion(): boolean {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; }
}
function saveData(): boolean {
  try { return !!(navigator as any).connection?.saveData; } catch { return false; }
}

/** Banner slides on dashboards only. `preview` = admin live preview (no RPC, no dismiss). */
export function DashboardBanners({ preview }: { preview?: Banner[] }) {
  const query = useMyBanners();
  const [dismissTick, setDismissTick] = useState(0);
  const source = preview ?? query.data ?? [];
  const banners = useMemo(
    () => (preview ? source : filterDismissed(source)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, preview, dismissTick],
  );
  useEffect(() => {
    if (preview) return;
    const onRestore = () => setDismissTick((t) => t + 1);
    window.addEventListener(BANNERS_RESTORE_EVENT, onRestore);
    return () => window.removeEventListener(BANNERS_RESTORE_EVENT, onRestore);
  }, [preview]);
  const hadAny = (() => { try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } })();
  useEffect(() => {
    if (!preview && query.data) {
      try { sessionStorage.setItem(SEEN_KEY, query.data.length ? "1" : "0"); } catch { /* ignore */ }
    }
  }, [query.data, preview]);

  if (!preview && query.isLoading) {
    return hadAny ? <div className="mb-6 aspect-[3/1] w-full max-w-[720px] rounded-xl bg-muted animate-pulse" aria-hidden /> : null;
  }
  if (banners.length === 0) return null;
  const carousel = <BannerCarousel banners={banners} preview={!!preview} onDismiss={() => setDismissTick((t) => t + 1)} />;
  return preview ? carousel : <div id={BANNERS_ANCHOR_ID} className="scroll-mt-24">{carousel}</div>;
}

export function BannerCarousel({ banners, preview, onDismiss }: { banners: Banner[]; preview?: boolean; onDismiss?: () => void }) {
  const [index, setIndex] = useState(0);
  const [hoverPause, setHoverPause] = useState(false);
  const [userPause, setUserPause] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduced = useMemo(prefersReducedMotion, []);
  const lite = useMemo(saveData, []);
  const count = banners.length;
  const current = banners[Math.min(index, count - 1)];
  const paused = hoverPause || userPause || hidden || reduced;

  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  useEffect(() => {
    if (paused || count < 2 || !current) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), current.display_seconds * 1000);
    return () => window.clearTimeout(t);
  }, [paused, count, current, index]);

  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);
  if (!current) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Oznámení"
      className="relative mb-6 w-full max-w-[720px] overflow-hidden rounded-xl border border-border bg-muted shadow-sm aspect-[3/1]"
      onMouseEnter={() => setHoverPause(true)}
      onMouseLeave={() => setHoverPause(false)}
      onFocus={() => setHoverPause(true)}
      onBlur={() => setHoverPause(false)}
      onTouchStart={() => setHoverPause(true)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      {banners.map((b, i) => (
        <div
          key={b.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} z ${count}`}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0",
            !reduced && "transition-opacity duration-700 ease-in-out",
            i === index ? "opacity-100 z-10" : "opacity-0 pointer-events-none",
          )}
        >
          <BannerSlide banner={b} active={i === index} posterOnly={lite || reduced} tabbable={i === index} />
        </div>
      ))}

      {!preview && (
        <button
          type="button"
          aria-label="Skrýt oznámení na 7 dní"
          className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => { dismissBanner(current.id, current.ends_at); onDismiss?.(); }}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {count > 1 && (
        <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5">
          <button type="button" aria-label="Předchozí oznámení" onClick={() => go(-1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Oznámení ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="grid h-6 w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("block h-2 w-2 rounded-full", i === index ? "bg-primary" : "bg-muted-foreground/40")} />
            </button>
          ))}
          <button type="button" aria-label="Další oznámení" onClick={() => go(1)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!reduced && (
            <button type="button" aria-label={userPause ? "Spustit střídání" : "Pozastavit střídání"} onClick={() => setUserPause((p) => !p)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {userPause ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function BannerSlide({ banner, active, posterOnly, tabbable }: { banner: Banner; active: boolean; posterOnly: boolean; tabbable: boolean }) {
  const media = banner.media_type === "video" && !posterOnly
    ? <BannerVideo banner={banner} active={active} />
    : (
      <img
        src={bannerPublicUrl(banner.media_type === "video" ? banner.poster_path : banner.image_path) ?? ""}
        alt={banner.alt_text}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  if (isSafeHttpsUrl(banner.link_url)) {
    return (
      <a href={banner.link_url!} target="_blank" rel="noopener noreferrer" tabIndex={tabbable ? 0 : -1} className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {media}
      </a>
    );
  }
  return media;
}

function BannerVideo({ banner, active }: { banner: Banner; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const loops = useRef(0);
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const poster = bannerPublicUrl(banner.poster_path) ?? undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active && visible && !done) {
      el.muted = true;
      el.play?.()?.catch?.(() => {});
    } else {
      el.pause?.();
    }
  }, [active, visible, done]);

  if (done) {
    return <img src={poster} alt={banner.alt_text} className="h-full w-full object-contain" />;
  }
  return (
    <video
      ref={ref}
      src={bannerPublicUrl(banner.video_path) ?? undefined}
      poster={poster}
      muted
      playsInline
      preload="metadata"
      aria-label={banner.alt_text}
      className="h-full w-full object-contain"
      onEnded={(e) => {
        loops.current += 1;
        if (loops.current >= MAX_VIDEO_LOOPS) setDone(true);
        else { e.currentTarget.currentTime = 0; e.currentTarget.play?.()?.catch?.(() => {}); }
      }}
    />
  );
}

export default DashboardBanners;
