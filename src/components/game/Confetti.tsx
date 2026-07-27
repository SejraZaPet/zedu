import { useMemo } from "react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--brand-purple))",
  "hsl(var(--brand-turquoise))",
  "#F59E0B",
  "#EF4444",
  "#10B981",
];

interface Props {
  count?: number;
  /** Duration range in seconds for each piece to fall. */
  minDuration?: number;
  maxDuration?: number;
  className?: string;
}

/**
 * Lightweight CSS-only confetti overlay. Absolutely positioned; drop into a
 * relatively-positioned parent (usually the podium container). Non-interactive.
 */
export default function Confetti({ count = 60, minDuration = 3.5, maxDuration = 6.5, className = "" }: Props) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const left = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 30; // vw
      const dur = minDuration + Math.random() * (maxDuration - minDuration);
      const delay = Math.random() * 1.5;
      const size = 6 + Math.random() * 8;
      const rot = Math.random() * 360;
      const color = COLORS[i % COLORS.length];
      const rounded = Math.random() > 0.6;
      return { left, drift, dur, delay, size, rot, color, rounded, key: i };
    });
  }, [count, minDuration, maxDuration]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {pieces.map((p) => (
        <span
          key={p.key}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: p.rounded ? "50%" : "2px",
            transform: `rotate(${p.rot}deg)`,
            animation: `game-confetti-fall ${p.dur}s linear ${p.delay}s infinite`,
            // Custom prop consumed by the keyframe
            ["--confetti-x" as any]: `${p.drift}vw`,
          }}
        />
      ))}
    </div>
  );
}
