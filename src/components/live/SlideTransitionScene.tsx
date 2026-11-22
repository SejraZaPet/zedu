import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  normalizeTransitionDuration,
  slideTransitionClass,
  slideTransitionStyle,
  type SlideTransitionConfig,
} from "@/lib/slide-transitions";

type MatchRect = { left: number; top: number; width: number; height: number };

function captureMatches(root: HTMLElement): Map<string, MatchRect> {
  const matches = new Map<string, MatchRect>();
  root.querySelectorAll<HTMLElement>("[data-slide-transition-match]").forEach((element) => {
    const key = element.dataset.slideTransitionMatch;
    const rect = element.getBoundingClientRect();
    if (!key || matches.has(key) || rect.width <= 0 || rect.height <= 0) return;
    matches.set(key, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  });
  return matches;
}

/**
 * Sdílený přechod scény. Match & move používá FLIP na skutečných blocích;
 * základní CSS prolnutí scény je současně fallback bez shodných prvků,
 * ve starších prohlížečích a při omezení pohybu.
 */
export default function SlideTransitionScene({
  config,
  transitionKey,
  className = "",
  style,
  children,
}: {
  config: SlideTransitionConfig;
  transitionKey: string | number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<{ key: string | number; matches: Map<string, MatchRect> } | null>(null);
  const animationsRef = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const currentMatches = captureMatches(root);
    const previous = previousRef.current;
    animationsRef.current.forEach((animation) => animation.cancel());
    animationsRef.current = [];

    if (
      config.style === "match-move" && previous && previous.key !== transitionKey
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      root.querySelectorAll<HTMLElement>("[data-slide-transition-match]").forEach((element) => {
        const key = element.dataset.slideTransitionMatch || "";
        const before = previous.matches.get(key);
        const after = currentMatches.get(key);
        if (!before || !after || typeof element.animate !== "function") return;
        const dx = before.left + before.width / 2 - (after.left + after.width / 2);
        const dy = before.top + before.height / 2 - (after.top + after.height / 2);
        const scaleX = before.width / after.width;
        const scaleY = before.height / after.height;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scaleX - 1) < 0.005 && Math.abs(scaleY - 1) < 0.005) return;
        // Samostatné translate/scale zachovají původní CSS rotaci bloku.
        const animation = element.animate([
          { translate: `${dx}px ${dy}px`, scale: `${scaleX} ${scaleY}` },
          { translate: "0px 0px", scale: "1 1" },
        ], {
          duration: normalizeTransitionDuration(config.duration) * 1000,
          easing: "cubic-bezier(.2,.7,.3,1)",
        });
        animationsRef.current.push(animation);
      });
    }
    previousRef.current = { key: transitionKey, matches: currentMatches };
  }, [transitionKey, config.style, config.duration]);

  useLayoutEffect(() => () => {
    animationsRef.current.forEach((animation) => animation.cancel());
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${className} ${slideTransitionClass(config.style, config.direction)}`.trim()}
      style={{ ...style, ...slideTransitionStyle(config) }}
      data-slide-transition={config.style}
    >
      <div key={transitionKey} className="flex h-full min-h-0 w-full flex-col">
        {children}
      </div>
    </div>
  );
}
