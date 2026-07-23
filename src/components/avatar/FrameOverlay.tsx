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
 * Decorative rounded-rectangle frame drawn as inline SVG, mapped by item.slug.
 * Occupies the full container (position: absolute inset-0) and follows the
 * card shape (rounded-2xl), not a circle around the character.
 * Respects prefers-reduced-motion (system) — animations disabled if requested.
 */
export default function FrameOverlay({ slug, reduceMotion }: Props) {
  const sysReduced = usePrefersReducedMotion();
  const animate = !reduceMotion && !sysReduced;

  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none" as const,
    "aria-hidden": true as const,
    className: "absolute inset-0 w-full h-full pointer-events-none",
  };

  const uid = `frame-${slug}`;

  switch (slug) {
    case "frame_basic_line":
      return (
        <svg {...common}>
          <rect x="0" y="0" width="100" height="100" rx="14" ry="14" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" opacity="0.35" />
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
          <rect x="0" y="0" width="100" height="100" rx="14" ry="14" fill="none" stroke={`url(#${uid})`} strokeWidth="3" opacity="0.75" />
        </svg>
      );

    case "frame_violet_pulse":
      return (
        <svg {...common}>
          <rect x="0" y="0" width="100" height="100" rx="14" ry="14" fill="none" stroke="#9B87C9" strokeWidth="2.5">
            {animate && (
              <animate attributeName="opacity" values="0.6;1;0.6" dur="2.4s" repeatCount="indefinite" />
            )}
          </rect>
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
          <rect
            x="0.5"
            y="0.5"
            width="99"
            height="99"
            rx="14"
            ry="14"
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
          <rect x="0" y="0" width="100" height="100" rx="14" ry="14" fill="none" stroke={`url(#${uid})`} strokeWidth="2.5" />
          <rect x="3" y="3" width="94" height="94" rx="12" ry="12" fill="none" stroke={`url(#${uid})`} strokeWidth="1.5" opacity="0.85" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <rect x="0" y="0" width="100" height="100" rx="14" ry="14" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" opacity="0.35" />
        </svg>
      );
  }
}
