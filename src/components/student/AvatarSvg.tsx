import { AVATARS, getAvatar } from "@/lib/avatars";

interface AvatarSvgProps {
  slug?: string | null;
  size?: number;
  locked?: boolean;
  className?: string;
}

/** Inline SVG avatar (kruh + emoji v <text>). Pro zamčené – šedé. */
export const AvatarSvg = ({ slug, size = 40, locked = false, className }: AvatarSvgProps) => {
  const a = getAvatar(slug);
  const fontSize = Math.round(size * 0.55);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={a.name}
      className={className}
    >
      <circle cx="32" cy="32" r="30" fill={locked ? "#9CA3AF" : a.bg} />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        style={{ filter: locked ? "grayscale(1) opacity(0.5)" : undefined }}
      >
        {a.emoji}
      </text>
    </svg>
  );
};

export { AVATARS };
