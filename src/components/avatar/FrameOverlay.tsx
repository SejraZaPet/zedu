import { useEffect, useState } from "react";

interface Props {
  slug: string;
  size?: number;
  reduceMotion?: boolean;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Decorative circular frame drawn as inline SVG, mapped by item.slug.
 * Occupies the full container (position: absolute inset-0).
 * Respects prefers-reduced-motion (system) — animations disabled if requested.
 */
export default function FrameOverlay({ slug, size = 100 }: Props) {
  const reduced = usePrefersReducedMotion();
  const animate = !reduced;

  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 100 100",
    "aria-hidden": true as const,
    className: "absolute inset-0 w-full h-full pointer-events-none",
  };

  const uid = `frame-${slug}`;

  switch (slug) {
    case "frame_basic_line":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
        </svg>
      );

    case "frame_soft_blue":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3FB8AF" />
              <stop offset="100%" stopColor="#9B87C9" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="47.5" fill="none" stroke={`url(#${uid})`} strokeWidth="3" opacity="0.75" />
        </svg>
      );

    case "frame_violet_pulse":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="47" fill="none" stroke="#9B87C9" strokeWidth="2.5">
            {animate && (
              <>
                <animate attributeName="opacity" values="0.7;1;0.7" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="r" values="46;48;46" dur="2.4s" repeatCount="indefinite" />
              </>
            )}
          </circle>
        </svg>
      );

    case "frame_electric_blue":
      return (
        <svg {...common}>
          <defs>
            <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="#2A7BF0"
            strokeWidth="2.5"
            filter={`url(#${uid}-glow)`}
          />
        </svg>
      );

    case "frame_golden_mind":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={uid} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFE58A" />
              <stop offset="50%" stopColor="#F5B301" />
              <stop offset="100%" stopColor="#B8860B" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="none" stroke={`url(#${uid})`} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${uid})`} strokeWidth="1.5" opacity="0.85" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" opacity="0.6" />
        </svg>
      );
  }
}
