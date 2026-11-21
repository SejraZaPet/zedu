/**
 * Automatic textbook cover: picks one gradient from the fixed Bezli palette
 * (dashboard tile tokens, contrast-tested for white text) and a subject icon.
 * Deterministic so a textbook always gets the same cover.
 */
export const COVER_GRADIENTS = [
  "learn", "subjects", "textbooks", "assignments", "notebook", "portfolio", "schedule", "studio",
] as const;
export type CoverGradient = (typeof COVER_GRADIENTS)[number];

export type CoverIcon =
  | "book" | "calculator" | "flask" | "globe" | "languages" | "landmark"
  | "music" | "palette" | "dumbbell" | "cpu" | "leaf" | "chef";

const ICON_RULES: Array<[RegExp, CoverIcon]> = [
  [/gastro|kuchar|vaře|vare|potrav|maso/i, "chef"],
  [/mat|algebr|geometr/i, "calculator"],
  [/chem|fyz|přírod|prirod/i, "flask"],
  [/biol|ekolog|zahrad/i, "leaf"],
  [/zeměp|zemep|geogr/i, "globe"],
  [/angl|němč|nemc|jazyk|franc|špan|span|rušt|rust|česk|cesk|literat/i, "languages"],
  [/dějep|dejep|histor|občan|obcan|společ|spolec/i, "landmark"],
  [/hud/i, "music"],
  [/výtv|vytv|umě|ume|design/i, "palette"],
  [/těl|tel\b|sport|tělocv/i, "dumbbell"],
  [/inform|ict|program|počít|pocit/i, "cpu"],
];

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function coverIconFor(subject: string | null | undefined, title = ""): CoverIcon {
  const text = `${subject ?? ""} ${title}`;
  for (const [re, icon] of ICON_RULES) if (re.test(text)) return icon;
  return "book";
}

export interface CoverInput {
  subjectId?: string | null;
  subject?: string | null;
  title: string;
}

export function autoCover(input: CoverInput): { gradient: CoverGradient; icon: CoverIcon } {
  const key = input.subjectId || input.subject?.trim() || input.title;
  const gradient = COVER_GRADIENTS[hashString(key.toLowerCase()) % COVER_GRADIENTS.length];
  return { gradient, icon: coverIconFor(input.subject, input.title) };
}

export function coverBackground(gradient: CoverGradient): string {
  return `linear-gradient(135deg, hsl(var(--dashboard-tile-${gradient}-from)), hsl(var(--dashboard-tile-${gradient}-to)))`;
}
