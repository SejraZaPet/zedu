import type { CSSProperties } from "react";

/** Kategorie herního pozadí */
export type BackgroundCategory = "universal" | "subject" | "season" | "field";

export interface GameBackground {
  id: string;
  name: string;
  category: BackgroundCategory;
  subject_key: string | null;
  season_key: string | null;
  field_key: string | null;
  image_url: string;
  is_active: boolean;
  created_at?: string;
}

export const BACKGROUND_CATEGORY_LABEL: Record<BackgroundCategory, string> = {
  universal: "Univerzální",
  subject: "Podle předmětu",
  season: "Podle ročního období",
  field: "Podle oboru školy",
};

/** Klíče předmětů (slug) používané pro zařazení pozadí */
export const SUBJECT_KEYS: { key: string; label: string }[] = [
  { key: "matematika", label: "Matematika" },
  { key: "cestina", label: "Český jazyk a literatura" },
  { key: "anglictina", label: "Anglický jazyk" },
  { key: "nemcina", label: "Německý jazyk" },
  { key: "fyzika", label: "Fyzika" },
  { key: "chemie", label: "Chemie" },
  { key: "prirodopis", label: "Přírodopis / Biologie" },
  { key: "dejepis", label: "Dějepis" },
  { key: "zemepis", label: "Zeměpis" },
  { key: "obcanska", label: "Občanská výchova / ZSV" },
  { key: "informatika", label: "Informatika a programování" },
  { key: "hudebni", label: "Hudební výchova" },
  { key: "vytvarna", label: "Výtvarná výchova" },
  { key: "telesna", label: "Tělesná výchova" },
  { key: "ekonomie", label: "Ekonomie a účetnictví" },
  { key: "jine", label: "Jiné" },
];

export const SEASON_KEYS: { key: string; label: string }[] = [
  { key: "jaro", label: "Jaro" },
  { key: "leto", label: "Léto" },
  { key: "podzim", label: "Podzim" },
  { key: "zima", label: "Zima" },
];

/** Obory škol – volný text, tohle jsou jen předvyplněné návrhy */
export const FIELD_SUGGESTIONS: { key: string; label: string }[] = [
  { key: "gastronomie", label: "Gastronomie" },
  { key: "strojirenstvi", label: "Strojírenství" },
  { key: "zdravotnictvi", label: "Zdravotnictví" },
  { key: "it", label: "IT" },
  { key: "obchod", label: "Obchod a služby" },
  { key: "stavebnictvi", label: "Stavebnictví" },
  { key: "doprava", label: "Doprava" },
  { key: "pedagogika", label: "Pedagogika" },
  { key: "zemedelstvi", label: "Zemědělství" },
];

/** Roční období podle dnešního data (severní polokoule, meteorologické) */
export const currentSeasonKey = (date: Date = new Date()): string => {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "jaro";
  if (m >= 6 && m <= 8) return "leto";
  if (m >= 9 && m <= 11) return "podzim";
  return "zima";
};

export const seasonLabel = (key: string | null | undefined): string =>
  SEASON_KEYS.find((s) => s.key === key)?.label ?? "";

export const subjectLabel = (key: string | null | undefined): string =>
  SUBJECT_KEYS.find((s) => s.key === key)?.label ?? key ?? "";

/** Popisek zařazení pozadí pro seznam v administraci */
export const backgroundScopeLabel = (bg: GameBackground): string => {
  switch (bg.category) {
    case "subject":
      return `Předmět: ${subjectLabel(bg.subject_key)}`;
    case "season":
      return `Období: ${seasonLabel(bg.season_key)}`;
    case "field":
      return `Obor: ${bg.field_key ?? "—"}`;
    default:
      return "Univerzální";
  }
};

const DEFAULT_GRADIENT = "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)";

/**
 * Pozadí živé hry / prezentace.
 * Obrázek je vždy pod obsahem a jeho střed je ztmavený, aby text zůstal čitelný
 * (obrázky mají tlumený střed už samy, tohle je pojistka).
 */
export const gameBackgroundStyle = (url?: string | null): CSSProperties => {
  if (!url) return { background: DEFAULT_GRADIENT };
  return {
    backgroundColor: "#0f172a",
    backgroundImage: [
      "radial-gradient(ellipse at center, rgba(8,12,28,0.78) 0%, rgba(8,12,28,0.55) 45%, rgba(8,12,28,0.35) 100%)",
      `url("${url}")`,
    ].join(", "),
    backgroundSize: "cover, cover",
    backgroundPosition: "center, center",
    backgroundRepeat: "no-repeat, no-repeat",
  };
};

/** Vytáhne URL pozadí z nastavení session */
export const sessionBackgroundUrl = (settings: any): string | null =>
  typeof settings?.backgroundUrl === "string" && settings.backgroundUrl ? settings.backgroundUrl : null;
