export interface BadgeDef {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  howTo: string;
  category: "xp" | "level" | "streak";
}

export const BADGES: BadgeDef[] = [
  // XP
  { slug: "xp_100", name: "Začátečník", emoji: "🌱", category: "xp",
    description: "Získal/a jsi prvních 100 XP.", howTo: "Získej celkem 100 XP." },
  { slug: "xp_500", name: "Učenlivý", emoji: "📚", category: "xp",
    description: "Nasbíral/a jsi 500 XP.", howTo: "Získej celkem 500 XP." },
  { slug: "xp_1000", name: "Premiant", emoji: "🎓", category: "xp",
    description: "Dosáhl/a jsi 1 000 XP.", howTo: "Získej celkem 1 000 XP." },
  { slug: "xp_5000", name: "Mistr", emoji: "👑", category: "xp",
    description: "Neuvěřitelných 5 000 XP!", howTo: "Získej celkem 5 000 XP." },
  // Level
  { slug: "level_5", name: "Level 5", emoji: "⭐", category: "level",
    description: "Dosáhl/a jsi 5. úrovně.", howTo: "Dosáhni úrovně 5." },
  { slug: "level_10", name: "Level 10", emoji: "🌟", category: "level",
    description: "Dosáhl/a jsi 10. úrovně.", howTo: "Dosáhni úrovně 10." },
  // Streak
  { slug: "streak_7", name: "Týdenní série", emoji: "🔥", category: "streak",
    description: "Učil/a ses 7 dní v řadě.", howTo: "Uč se 7 dní v řadě." },
  { slug: "streak_30", name: "Měsíční série", emoji: "💎", category: "streak",
    description: "Učil/a ses 30 dní v řadě.", howTo: "Uč se 30 dní v řadě." },
];

export const getBadge = (slug: string): BadgeDef | undefined =>
  BADGES.find((b) => b.slug === slug);

/** total_xp potřebné pro dosažení daného levelu (level = floor(sqrt(xp/50))+1). */
export const xpForLevel = (level: number): number =>
  50 * Math.pow(Math.max(0, level - 1), 2);
