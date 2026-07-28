import { Handshake, HeartHandshake, Zap, Lightbulb, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BehaviorCategory =
  | "spoluprace"
  | "ohleduplnost"
  | "aktivni_zapojeni"
  | "samostatnost"
  | "pomoc_druhym";

export interface BehaviorCategoryMeta {
  key: BehaviorCategory;
  label: string;
  icon: LucideIcon;
}

export const BEHAVIOR_CATEGORIES: BehaviorCategoryMeta[] = [
  { key: "spoluprace", label: "Spolupráce", icon: Handshake },
  { key: "ohleduplnost", label: "Ohleduplnost", icon: HeartHandshake },
  { key: "aktivni_zapojeni", label: "Aktivní zapojení", icon: Zap },
  { key: "samostatnost", label: "Samostatnost", icon: Lightbulb },
  { key: "pomoc_druhym", label: "Pomoc druhým", icon: Users },
];

export const BEHAVIOR_CATEGORY_MAP: Record<BehaviorCategory, BehaviorCategoryMeta> =
  Object.fromEntries(BEHAVIOR_CATEGORIES.map((c) => [c.key, c])) as Record<
    BehaviorCategory,
    BehaviorCategoryMeta
  >;

export function getBehaviorCategoryLabel(key: string): string {
  return BEHAVIOR_CATEGORY_MAP[key as BehaviorCategory]?.label ?? key;
}
