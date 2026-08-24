/**
 * Vizuální témata prezentací.
 *
 * Téma platí pro CELOU prezentaci (ukládá se jako `theme_id` u lekce a zároveň
 * jako `themeId` na každém slidu, aby ho živé obrazovky uměly přečíst z
 * `activity_data` bez dalšího dotazu).
 */

export type CornerStyle = "sharp" | "rounded" | "pill";

export interface PresentationTheme {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  /** CSS `background` hodnota (barva nebo gradient). */
  backgroundStyle: string;
  fontFamily: string;
  cornerStyle: CornerStyle;
  /** Tmavé pozadí → světlý text. */
  isDark: boolean;
}

export const DEFAULT_THEME_ID = "zedu-classic";

export const PRESENTATION_THEMES: PresentationTheme[] = [
  {
    id: "zedu-classic",
    name: "Klasický Bezli",
    description: "Výchozí tmavý gradient s tealovým a lavendrovým akcentem",
    primaryColor: "#6EC6D9",
    secondaryColor: "#9B6CFF",
    backgroundStyle: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
    fontFamily: '"Poppins", system-ui, sans-serif',
    cornerStyle: "rounded",
    isDark: true,
  },
  {
    id: "dark-pro",
    name: "Tmavý profesionál",
    description: "Střízlivá tmavá plocha, jemný modrý akcent",
    primaryColor: "#7EA6F5",
    secondaryColor: "#B8C4D9",
    backgroundStyle: "linear-gradient(160deg, #101215, #1b1f26)",
    fontFamily: '"Inter", system-ui, sans-serif',
    cornerStyle: "sharp",
    isDark: true,
  },
  {
    id: "pastel-playful",
    name: "Hravý pastelový",
    description: "Světlé pastelové barvy a kulaté rohy",
    primaryColor: "#F58BB2",
    secondaryColor: "#7FD1C1",
    backgroundStyle: "linear-gradient(135deg, #FFF6FA, #EAF7FF 55%, #FFF9E8)",
    fontFamily: '"Quicksand", "Poppins", system-ui, sans-serif',
    cornerStyle: "pill",
    isDark: false,
  },
  {
    id: "nature",
    name: "Přírodní",
    description: "Zelené odstíny, klidná a čitelná plocha",
    primaryColor: "#2F855A",
    secondaryColor: "#A3C9A8",
    backgroundStyle: "linear-gradient(135deg, #F2F8F3, #E2F0E6)",
    fontFamily: '"Source Sans 3", system-ui, sans-serif',
    cornerStyle: "rounded",
    isDark: false,
  },
  {
    id: "energetic",
    name: "Energický",
    description: "Oranžovo-červený gradient pro dynamické hodiny",
    primaryColor: "#FFD166",
    secondaryColor: "#FF7A59",
    backgroundStyle: "linear-gradient(135deg, #7A1F12, #C2410C 55%, #F97316)",
    fontFamily: '"Poppins", system-ui, sans-serif',
    cornerStyle: "rounded",
    isDark: true,
  },
  {
    id: "minimal",
    name: "Minimalistický",
    description: "Černobílý, ostré rohy, maximální kontrast",
    primaryColor: "#111111",
    secondaryColor: "#666666",
    backgroundStyle: "#FFFFFF",
    fontFamily: '"Inter", system-ui, sans-serif',
    cornerStyle: "sharp",
    isDark: false,
  },
];

export function getPresentationTheme(id?: string | null): PresentationTheme {
  return (
    PRESENTATION_THEMES.find((t) => t.id === id) ??
    PRESENTATION_THEMES[0]
  );
}

const RADIUS: Record<CornerStyle, string> = {
  sharp: "0px",
  rounded: "0.75rem",
  pill: "1.75rem",
};

/** CSS proměnné + základní styl plochy slidu pro dané téma. */
export function themeStageStyle(theme: PresentationTheme): React.CSSProperties {
  return {
    background: theme.backgroundStyle,
    fontFamily: theme.fontFamily,
    ["--slide-primary" as any]: theme.primaryColor,
    ["--slide-secondary" as any]: theme.secondaryColor,
    ["--slide-radius" as any]: RADIUS[theme.cornerStyle],
  };
}

/** Vytáhne themeId z pole slidů (téma je pro celou prezentaci stejné). */
export function themeIdFromSlides(slides: any[]): string {
  return slides?.find((s) => s?.themeId)?.themeId || DEFAULT_THEME_ID;
}

/** Zapíše téma na všechny slidy prezentace. */
export function applyThemeToSlides<T extends Record<string, any>>(slides: T[], themeId: string): T[] {
  return (slides || []).map((s) => ({ ...s, themeId }));
}
