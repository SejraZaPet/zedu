import { useId } from "react";

/**
 * Custom Bar shape for Recharts that renders each bar with its OWN
 * linearGradient scaled to that bar's height (userSpaceOnUse).
 * Guarantees every bar — regardless of value — shows the full purple→teal transition.
 */
export const BrandGradientBar = (props: any) => {
  const { x, y, width, height, radius } = props;
  const uid = useId().replace(/:/g, "");
  const gid = `brandBar-${uid}-${x}-${y}`;

  if (width <= 0 || height <= 0) return null;

  const r = Array.isArray(radius) ? radius[0] ?? 0 : (radius ?? 0);
  const rx = Math.min(r, width / 2, height / 2);

  // Rounded-top rectangle path (matches Recharts default radius=[r,r,0,0])
  const path =
    `M ${x},${y + rx}` +
    ` Q ${x},${y} ${x + rx},${y}` +
    ` L ${x + width - rx},${y}` +
    ` Q ${x + width},${y} ${x + width},${y + rx}` +
    ` L ${x + width},${y + height}` +
    ` L ${x},${y + height} Z`;

  return (
    <g>
      <defs>
        <linearGradient
          id={gid}
          gradientUnits="userSpaceOnUse"
          x1={x}
          y1={y}
          x2={x}
          y2={y + height}
        >
          <stop offset="0%" stopColor="hsl(var(--brand-gradient-from))" />
          <stop offset="100%" stopColor="hsl(var(--brand-gradient-to))" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${gid})`} />
    </g>
  );
};
