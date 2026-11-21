/**
 * Barvy aktivity na slidu (pozadí karty, text, odpovědi, akcent).
 * Ukládají se do `activitySpec.colors` (blok aktivity je jejím zrcadlem), takže platí
 * v editoru, promítání, na telefonu žáka i v PDF. Čisté funkce, nic neukládají.
 *
 * Čitelnost: text se nikdy nezobrazí s kontrastem pod 4,5 : 1 – pokud zvolená
 * kombinace nevyhovuje, použije se čitelnější z tmavé / bílé a editor zobrazí varování.
 */
export interface ActivityColors {
  card?: string;
  text?: string;
  answer?: string;
  accent?: string;
}

export const ACTIVITY_PALETTE: { hex: string; name: string }[] = [
  { hex: "#663196", name: "Fialová" },
  { hex: "#5D3D7F", name: "Tmavě fialová" },
  { hex: "#63C7CF", name: "Tyrkysová" },
  { hex: "#F3F1E6", name: "Krémová" },
  { hex: "#2B1A3F", name: "Tmavá" },
  { hex: "#FFFFFF", name: "Bílá" },
];

export const DEFAULT_ACTIVITY_COLORS: Required<ActivityColors> = {
  card: "#F3F1E6",
  text: "#2B1A3F",
  answer: "#FFFFFF",
  accent: "#663196",
};

const DARK = "#2B1A3F";
const LIGHT = "#FFFFFF";
export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_ACCENT_CONTRAST = 3;

export function normalizeHex(v: unknown): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v ?? "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

function luminance(hex: string): number {
  const h = normalizeHex(hex) ?? LIGHT;
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Kontrastní poměr WCAG (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

export const isDarkColor = (hex: string) => contrastRatio(hex, LIGHT) > contrastRatio(hex, DARK);

/** Čitelnější z tmavé a bílé na daném pozadí. */
export const readableOn = (bg: string) => (contrastRatio(DARK, bg) >= contrastRatio(LIGHT, bg) ? DARK : LIGHT);

export function readActivityColors(raw: unknown): ActivityColors {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: ActivityColors = {};
  for (const k of ["card", "text", "answer", "accent"] as const) {
    const v = normalizeHex(r[k]);
    if (v) out[k] = v;
  }
  return out;
}

export const hasActivityColors = (raw: unknown) => Object.keys(readActivityColors(raw)).length > 0;

export interface ResolvedActivityColors {
  card: string;
  text: string;
  answer: string;
  answerText: string;
  accent: string;
  accentText: string;
  dark: boolean;
}

/** Výsledné barvy k vykreslení – vždy s čitelným textem. */
export function resolveActivityColors(raw: unknown): ResolvedActivityColors {
  const c = { ...DEFAULT_ACTIVITY_COLORS, ...readActivityColors(raw) };
  const text = contrastRatio(c.text, c.card) >= MIN_TEXT_CONTRAST ? c.text : readableOn(c.card);
  const answerText = contrastRatio(c.text, c.answer) >= MIN_TEXT_CONTRAST ? c.text : readableOn(c.answer);
  return { card: c.card, text, answer: c.answer, answerText, accent: c.accent, accentText: readableOn(c.accent), dark: isDarkColor(c.card) };
}

/** Varování k zvolené kombinaci (česky), prázdné = vše čitelné. */
export function activityColorWarnings(raw: unknown): string[] {
  const c = { ...DEFAULT_ACTIVITY_COLORS, ...readActivityColors(raw) };
  const w: string[] = [];
  const t = contrastRatio(c.text, c.card);
  if (t < MIN_TEXT_CONTRAST) w.push(`Text je na pozadí karty špatně čitelný (kontrast ${t.toFixed(1)} : 1, potřeba aspoň 4,5 : 1). Zobrazíme ho ${readableOn(c.card) === DARK ? "tmavě" : "bíle"}.`);
  const a = contrastRatio(c.text, c.answer);
  if (a < MIN_TEXT_CONTRAST) w.push(`Text odpovědí je na jejich barvě špatně čitelný (kontrast ${a.toFixed(1)} : 1). Zobrazíme ho ${readableOn(c.answer) === DARK ? "tmavě" : "bíle"}.`);
  const ac = Math.max(contrastRatio(c.accent, c.card), contrastRatio(c.accent, c.answer));
  if (ac < MIN_ACCENT_CONTRAST) w.push("Akcent (ohraničení a správná odpověď) téměř splývá s kartou i odpověďmi. Zvolte výraznější barvu.");
  return w;
}

/** Inline styl karty – inline barvy nepřebije dědění barvy ze slidu ani motiv. */
export function activityCardStyle(raw: unknown): React.CSSProperties & Record<string, string> {
  const r = resolveActivityColors(raw);
  return {
    backgroundColor: r.card,
    color: r.text,
    borderColor: r.accent,
    "--activity-card": r.card,
    "--activity-text": r.text,
    "--activity-answer": r.answer,
    "--activity-answer-text": r.answerText,
    "--activity-accent": r.accent,
    "--activity-accent-text": r.accentText,
  };
}
