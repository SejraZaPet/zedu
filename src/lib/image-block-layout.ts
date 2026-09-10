/**
 * Sdílené rozměry/zarovnání pro obrázkový blok.
 * Používá se jak v editoru lekce (WYSIWYG náhled), tak v žákovském zobrazení,
 * aby obrázek měl v obou místech naprosto stejnou šířku i poměr stran.
 */
export type ImageBlockWidth = "full" | "half" | "medium" | "third" | "small" | undefined;

export const imageWidthClass = (width: ImageBlockWidth): string => {
  switch (width) {
    case "half":
    case "medium":
      return "w-1/2 inline-block";
    case "third":
    case "small":
      return "w-1/3 inline-block";
    case "full":
    default:
      return "w-full";
  }
};

export const imageAlignClass = (alignment?: string): string =>
  alignment === "center" ? "text-center" : alignment === "right" ? "text-right" : "text-left";

export const imageIconSize = (width: ImageBlockWidth): number =>
  width === "small" || width === "third" ? 48 : width === "medium" || width === "half" ? 96 : 144;

/**
 * Jednotný vzhled hero obrázku (banneru) lekce – stejný poměr/ořez
 * v editačním formuláři, v náhledu i v žákovském zobrazení.
 */
export const HERO_IMAGE_CLASS = "w-full rounded-lg object-cover max-h-80";
