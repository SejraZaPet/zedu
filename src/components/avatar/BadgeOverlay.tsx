import { icons, Award, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

// Mirrors RARITY_TONE from AvatarEditor grid tiles so the badge dot matches.
const RARITY_TONE: Record<Rarity, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-primary/15 text-primary",
  rare: "bg-secondary/15 text-secondary",
  epic: "bg-accent/20 text-accent-foreground",
  legendary: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  mythic: "bg-gradient-brand-sm text-white",
};

function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Award;
  const map = icons as unknown as Record<string, LucideIcon>;
  return map[name] ?? Award;
}

interface Props {
  iconName: string | null | undefined;
  rarity?: Rarity;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Small round badge shown in the bottom-left corner of a square avatar preview.
 * Renders a Lucide icon looked up from the `icons` map (falls back to Award).
 */
export default function BadgeOverlay({
  iconName,
  rarity = "common",
  size = 28,
  className,
  title,
}: Props) {
  const Icon = resolveIcon(iconName);
  const iconSize = Math.max(12, Math.round(size * 0.55));
  return (
    <span
      aria-hidden="true"
      title={title}
      className={cn(
        "absolute bottom-1 left-1 rounded-full flex items-center justify-center shadow ring-2 ring-background border border-border/60",
        RARITY_TONE[rarity],
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: iconSize, height: iconSize }} />
    </span>
  );
}
