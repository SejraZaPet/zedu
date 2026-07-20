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
 * Decorative full-avatar effect drawn as inline SVG, mapped by item.slug.
 * Respects prefers-reduced-motion (system + profile). Unknown slug → nothing.
 */
export default function EffectOverlay({ slug, reduceMotion }: Props) {
  const sysReduced = usePrefersReducedMotion();
  const animate = !reduceMotion && !sysReduced;

  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 100 100",
    "aria-hidden": true as const,
    className: "absolute inset-0 w-full h-full pointer-events-none",
  };

  if (slug === "effect_sparkles") {
    // 6 sparkles in corners/edges; twinkle via staggered opacity
    const sparkles = [
      { cx: 12, cy: 14, delay: "0s" },
      { cx: 88, cy: 16, delay: "0.4s" },
      { cx: 90, cy: 82, delay: "0.8s" },
      { cx: 10, cy: 84, delay: "1.2s" },
      { cx: 50, cy: 6, delay: "0.6s" },
      { cx: 6, cy: 50, delay: "1.0s" },
    ];
    return (
      <svg {...common}>
        {sparkles.map((s, i) => (
          <g key={i} transform={`translate(${s.cx} ${s.cy})`} opacity={animate ? 0 : 0.85}>
            <path
              d="M0 -3 L0.9 -0.9 L3 0 L0.9 0.9 L0 3 L-0.9 0.9 L-3 0 L-0.9 -0.9 Z"
              fill="#FFD86B"
              stroke="#fff"
              strokeWidth="0.3"
            />
            {animate && (
              <animate
                attributeName="opacity"
                values="0;1;0"
                dur="1.8s"
                begin={s.delay}
                repeatCount="indefinite"
              />
            )}
          </g>
        ))}
      </svg>
    );
  }

  if (slug === "effect_glow_ring") {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id="glow-ring-g" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#9B87C9" stopOpacity="0" />
            <stop offset="90%" stopColor="#9B87C9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#9B87C9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill="url(#glow-ring-g)">
          {animate && (
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2.6s" repeatCount="indefinite" />
          )}
        </circle>
      </svg>
    );
  }

  if (slug === "effect_particles") {
    // 8 dots around perimeter, slowly orbiting via rotation of a group
    const dots = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const r = 46;
      return { cx: 50 + Math.cos(angle) * r, cy: 50 + Math.sin(angle) * r };
    });
    return (
      <svg {...common}>
        <g>
          {dots.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r="1.3" fill="#3FB8AF" opacity="0.85" />
          ))}
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur="18s"
              repeatCount="indefinite"
            />
          )}
        </g>
      </svg>
    );
  }

  return null;
}
