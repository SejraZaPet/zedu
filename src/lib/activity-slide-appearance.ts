/**
 * Vzhled aktivit na snímku prezentace.
 *
 * Aktivity se v prezentaci vykreslují stejným rendererem jako v lekci, takže
 * dědily barvy tmavého snímku a text byl často nečitelný. Tenhle modul drží
 * nastavení vzhledu (uložené v `block.props.slideAppearance`) a převádí ho na
 * CSS proměnné, které přepíší tokeny uvnitř karty aktivity.
 */

export type ActivityLook = "light" | "dark" | "custom";

export interface ActivitySlideAppearance {
  look: ActivityLook;
  /** Vlastní barva textu (hex) – jen pro `look: "custom"`. */
  textColor?: string;
  /** Vlastní barva karty (hex) – jen pro `look: "custom"`. */
  cardColor?: string;
  /** Násobek velikosti textu, 0.6–1.6. */
  fontScale: number;
  /** Aktivita je na snímku rozbalená. */
  expanded: boolean;
  /** Zobrazit hlavičku aktivity (název, typ, čas, povinnost). */
  showHeader: boolean;
}

export const DEFAULT_ACTIVITY_APPEARANCE: ActivitySlideAppearance = {
  look: "light",
  fontScale: 1,
  expanded: true,
  showHeader: true,
};

export const FONT_SCALE_MIN = 0.6;
export const FONT_SCALE_MAX = 1.6;

const clampScale = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(n * 100) / 100));
};

/** Načte nastavení vzhledu z props bloku a doplní výchozí hodnoty. */
export function getActivitySlideAppearance(raw: unknown): ActivitySlideAppearance {
  const a = (raw || {}) as Record<string, unknown>;
  const look: ActivityLook =
    a.look === "dark" || a.look === "custom" || a.look === "light"
      ? (a.look as ActivityLook)
      : DEFAULT_ACTIVITY_APPEARANCE.look;
  return {
    look,
    textColor: typeof a.textColor === "string" ? a.textColor : undefined,
    cardColor: typeof a.cardColor === "string" ? a.cardColor : undefined,
    fontScale: a.fontScale === undefined ? 1 : clampScale(a.fontScale),
    expanded: a.expanded === undefined ? true : a.expanded !== false,
    showHeader: a.showHeader === undefined ? true : a.showHeader !== false,
  };
}

/** `#1a2b3c` → `"210 40% 20%"` (formát HSL tokenů v index.css). */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let hue = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const round = (n: number) => Math.round(n);
  return `${round(hue)} ${round(s * 100)}% ${round(l * 100)}%`;
}

/** Relativní světlost 0–1 z hex barvy (pro volbu čitelného textu). */
function lightness(hex: string): number {
  const triplet = hexToHslTriplet(hex);
  if (!triplet) return 1;
  const parts = triplet.split(" ");
  return Number(parts[2].replace("%", "")) / 100;
}

const LIGHT_VARS: Record<string, string> = {
  "--background": "0 0% 100%",
  "--foreground": "222 26% 16%",
  "--card": "0 0% 100%",
  "--card-foreground": "222 26% 16%",
  "--muted": "225 33% 94%",
  "--muted-foreground": "220 13% 40%",
  "--border": "228 24% 88%",
};

const DARK_VARS: Record<string, string> = {
  "--background": "222 30% 12%",
  "--foreground": "0 0% 100%",
  "--card": "222 30% 16%",
  "--card-foreground": "0 0% 100%",
  "--muted": "222 20% 26%",
  "--muted-foreground": "215 20% 80%",
  "--border": "222 18% 34%",
};

/**
 * CSS proměnné + měřítko textu pro obal aktivity na snímku. Tokeny se přepisují
 * lokálně, takže `bg-card`, `text-foreground` i `text-muted-foreground` uvnitř
 * aktivity dostanou čitelné barvy nezávisle na barvě snímku.
 */
export function activitySlideAppearanceStyle(
  a: ActivitySlideAppearance,
): React.CSSProperties & Record<string, string | number> {
  const vars: Record<string, string> = { ...(a.look === "dark" ? DARK_VARS : LIGHT_VARS) };

  if (a.look === "custom") {
    if (a.cardColor) {
      const card = hexToHslTriplet(a.cardColor);
      if (card) {
        vars["--card"] = card;
        vars["--background"] = card;
        const dark = lightness(a.cardColor) < 0.5;
        Object.assign(vars, dark ? { ...DARK_VARS, "--card": card, "--background": card } : { ...LIGHT_VARS, "--card": card, "--background": card });
      }
    }
    if (a.textColor) {
      const text = hexToHslTriplet(a.textColor);
      if (text) {
        vars["--foreground"] = text;
        vars["--card-foreground"] = text;
        vars["--muted-foreground"] = text;
      }
    }
  }

  return {
    ...vars,
    color: "hsl(var(--foreground))",
    fontSize: `${a.fontScale}em`,
  } as React.CSSProperties & Record<string, string | number>;
}
