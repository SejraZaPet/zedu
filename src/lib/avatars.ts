export interface AvatarDef {
  slug: string;
  name: string;
  emoji: string;
  bg: string;
  minLevel: number;
}

export const AVATARS: AvatarDef[] = [
  // Odemčené od začátku (level 1)
  { slug: "bear", name: "Medvídek", emoji: "🐻", bg: "#FCD9A8", minLevel: 1 },
  { slug: "cat", name: "Kočka", emoji: "🐱", bg: "#F5C2D6", minLevel: 1 },
  { slug: "dog", name: "Pes", emoji: "🐶", bg: "#FFE0A3", minLevel: 1 },
  { slug: "rabbit", name: "Králík", emoji: "🐰", bg: "#E8D5F0", minLevel: 1 },
  // Level 3
  { slug: "owl", name: "Sova", emoji: "🦉", bg: "#C7A98B", minLevel: 3 },
  { slug: "dragon", name: "Drak", emoji: "🐉", bg: "#A8E6A1", minLevel: 3 },
  { slug: "robot", name: "Robot", emoji: "🤖", bg: "#B8C5D6", minLevel: 3 },
  { slug: "astronaut", name: "Astronaut", emoji: "🧑‍🚀", bg: "#9BB5E8", minLevel: 3 },
  // Level 5
  { slug: "pirate", name: "Pirát", emoji: "🏴‍☠️", bg: "#6B7280", minLevel: 5 },
  { slug: "knight", name: "Rytíř", emoji: "🛡️", bg: "#A0A0B8", minLevel: 5 },
  { slug: "unicorn", name: "Jednorožec", emoji: "🦄", bg: "#F0C8F0", minLevel: 5 },
  { slug: "panda", name: "Panda", emoji: "🐼", bg: "#E8E8E8", minLevel: 5 },
];

export const DEFAULT_AVATAR_SLUG = "bear";

export const getAvatar = (slug: string | null | undefined): AvatarDef =>
  AVATARS.find((a) => a.slug === slug) ?? AVATARS[0];
