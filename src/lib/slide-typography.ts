/**
 * Typografie a animace jednotlivých bloků slidu.
 *
 * Vše je volitelné – když hodnota chybí (null/undefined), blok dědí vzhled
 * podle typu bloku a podle vizuálního tématu prezentace.
 */

/** Standardní bodové velikosti jako ve Wordu / PowerPointu. */
export const SLIDE_FONT_SIZES = [14, 18, 24, 28, 32, 36, 40, 48, 60, 72, 96, 120] as const;

export interface SlideFontOption {
  value: string;
  label: string;
}

/** Kurátorovaná nabídka fontů (Google Fonts + systémové fallbacky). */
export const SLIDE_FONTS: SlideFontOption[] = [
  { value: '"Poppins", system-ui, sans-serif', label: "Poppins" },
  { value: '"Inter", system-ui, sans-serif', label: "Inter" },
  { value: '"Quicksand", system-ui, sans-serif', label: "Quicksand" },
  { value: '"Source Sans 3", system-ui, sans-serif', label: "Source Sans 3" },
  { value: '"Playfair Display", Georgia, serif', label: "Playfair Display" },
  { value: '"Roboto Slab", Georgia, serif', label: "Roboto Slab" },
  { value: '"Comic Neue", "Comic Sans MS", cursive', label: "Comic Neue" },
  { value: 'Georgia, "Times New Roman", serif', label: "Georgia" },
  { value: '"Courier New", ui-monospace, monospace', label: "Courier New" },
];

export type SlideAnimation = "none" | "scale" | "from-bottom" | "from-top";

export const SLIDE_ANIMATIONS: { value: SlideAnimation; label: string }[] = [
  { value: "none", label: "Bez animace" },
  { value: "scale", label: "Zvětšení" },
  { value: "from-bottom", label: "Zezadu (zespodu)" },
  { value: "from-top", label: "Zezhora" },
];

/** Paleta barev textu nabízená v editoru. */
export const SLIDE_TEXT_COLORS = [
  "#FFFFFF",
  "#111111",
  "#64748B",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#9B6CFF",
  "#6EC6D9",
];

/** 1 bod ≈ 1.333 px při nativním měřítku scény 1600×900. */
export const PT_TO_PX = 4 / 3;

export interface SlideTextStyleProps {
  fontSize?: number | null;
  color?: string | null;
  fontFamily?: string | null;
  /** Barva zvýraznění (pozadí za textem). */
  highlightColor?: string | null;
  /** Tučné písmo celého bloku. */
  bold?: boolean | null;
  /** Kurzíva celého bloku. */
  italic?: boolean | null;
  /** Zarovnání textu (výchozí = left). */
  align?: "left" | "center" | "right" | null;
  /** Řádkování (násobek, např. 1.2 / 1.5 / 2). */
  lineHeight?: number | null;
}

/** Paleta barev zvýrazňovače. */
export const SLIDE_HIGHLIGHT_COLORS = [
  "#FEF08A",
  "#FDE68A",
  "#BBF7D0",
  "#BFDBFE",
  "#DDD6FE",
  "#FBCFE8",
  "#FECACA",
  "#E2E8F0",
];

/** Inline styl textového bloku podle jeho props (prázdný objekt = dědí se). */
export function slideTextStyle(props?: SlideTextStyleProps | null): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (!props) return style;
  if (typeof props.fontSize === "number" && props.fontSize > 0) {
    style.fontSize = `${Math.round(props.fontSize * PT_TO_PX)}px`;
    style.lineHeight = 1.35;
  }
  if (props.color) style.color = props.color;
  if (props.fontFamily) style.fontFamily = props.fontFamily;
  if (props.bold) style.fontWeight = 700;
  if (props.italic) style.fontStyle = "italic";
  if (props.align) style.textAlign = props.align;
  if (typeof props.lineHeight === "number" && props.lineHeight > 0) {
    style.lineHeight = props.lineHeight;
  }

  if (props.highlightColor) {
    style.backgroundColor = props.highlightColor;
    style.boxDecorationBreak = "clone" as any;
    (style as any).WebkitBoxDecorationBreak = "clone";
    style.borderRadius = "0.25rem";
    style.padding = "0.05em 0.2em";
  }
  return style;
}

/** CSS class animace vstupu bloku (jen pro živou projekci, ne pro editor). */
export function slideAnimationClass(animation?: string | null): string {
  switch (animation) {
    case "scale":
      return "slide-anim-scale";
    case "from-bottom":
      return "slide-anim-from-bottom";
    case "from-top":
      return "slide-anim-from-top";
    default:
      return "";
  }
}

/** Pozadí slidu: vlastní přepis (barva nebo obrázek) má přednost před tématem. */
export function slideBackgroundOverride(slide: any): string | null {
  const image = slide?.backgroundOverride?.image;
  if (typeof image === "string" && image) {
    return `#000 url("${image.replace(/"/g, "%22")}") center / cover no-repeat`;
  }
  const color = slide?.backgroundOverride?.color;
  return typeof color === "string" && color ? color : null;
}

/**
 * Pozadí slidu jako EXPLICITNÍ CSS vlastnosti (bez shorthandu `background`).
 * Shorthand + `backgroundImage` na jednom elementu se navzájem přepisují —
 * proto se tady vždy vrací jen konkrétní vlastnosti.
 */
export function slideBackgroundOverrideStyle(slide: any): Record<string, string> | null {
  const image = slide?.backgroundOverride?.image;
  if (typeof image === "string" && image) {
    return {
      backgroundImage: `url("${image.replace(/"/g, "%22")}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: "transparent",
    };
  }
  const color = slide?.backgroundOverride?.color;
  if (typeof color === "string" && color) {
    return { backgroundColor: color, backgroundImage: "none" };
  }
  return null;
}


/** Paleta barev pozadí slidu nabízená v nastavení slidu. */
export const SLIDE_BACKGROUND_COLORS = [
  "#0F172A",
  "#111111",
  "#1F2937",
  "#FFFFFF",
  "#F8FAFC",
  "#FEF3C7",
  "#E0F2FE",
  "#DCFCE7",
  "#FCE7F3",
];
