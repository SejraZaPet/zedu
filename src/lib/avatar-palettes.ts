/**
 * Per-category color palettes for the avatar editor.
 * Each entry is a HEX string (#RRGGBB) OR a special sentinel value.
 *
 * Special values:
 *  - "gradient:brand" → brand linear gradient (purple #A065D7 → teal #63C7CF).
 *    Not a hex, so it MUST be handled explicitly in renderers.
 */

export const SKIN_SWATCHES: string[] = [
  "#1B1B1B", "#FFFFFF", "#8A8A8A",
  "#B23A48", "#E08A2A", "#F2C94C",
  "#3AA35A", "#2D6EDB", "#A065D7",
  "gradient:brand",
];

export const HAIR_SWATCHES: string[] = [
  "#1B1B1B", "#3A2416", "#6B4423", "#A67B4A",
  "#D9B96A", "#F2D98A", "#C64B1B", "#8A8A8A",
  "#FFFFFF",
  "gradient:brand",
];

export const OUTFIT_SWATCHES: string[] = [
  "#1B1B1B", "#FFFFFF", "#8A8A8A",
  "#B23A48", "#E08A2A", "#F2C94C",
  "#3AA35A", "#2D6EDB", "#A065D7",
  "gradient:brand",
];

export const ACCESSORY_SWATCHES: string[] = [
  "#1B1B1B", "#FFFFFF", "#8A8A8A",
  "#B23A48", "#E08A2A", "#F2C94C",
  "#3AA35A", "#2D6EDB", "#A065D7",
  "gradient:brand",
];

/**
 * Backgrounds — light/pastel variants so the character stays legible on top.
 * Last entry is the brand gradient sentinel (see BRAND_GRADIENT_CSS).
 */
export const BACKGROUND_SWATCHES: string[] = [
  "#EDEDED", // light grey (instead of black)
  "#FFFFFF", // white
  "#FBD5D9", // light red / pink
  "#FBE0C4", // light orange
  "#FDF3BF", // light yellow
  "#CDEBD6", // light green
  "#CFE1F7", // light blue
  "#E4D2F4", // light purple
  "#D4F0F3", // light teal
  "gradient:brand", // brand purple → teal gradient
];

export const BRAND_GRADIENT_CSS = "linear-gradient(135deg, #A065D7, #63C7CF)";

export function isGradientValue(v: string | null | undefined): v is "gradient:brand" {
  return v === "gradient:brand";
}

export type TintableCategory =
  | "base"
  | "hairstyle"
  | "outfit"
  | "face_accessory"
  | "head_accessory"
  | "background";

export const TINTABLE_CATEGORIES: TintableCategory[] = [
  "base",
  "hairstyle",
  "outfit",
  "face_accessory",
  "head_accessory",
  "background",
];

/** Column on `avatar_profiles` that stores the picked color for each category. */
export const CATEGORY_COLOR_COLUMN: Record<TintableCategory, string> = {
  base: "base_color",
  hairstyle: "hairstyle_color",
  outfit: "outfit_color",
  face_accessory: "face_accessory_color",
  head_accessory: "head_accessory_color",
  background: "background_color",
};

export function paletteFor(category: TintableCategory): string[] {
  switch (category) {
    case "base":
      return SKIN_SWATCHES;
    case "hairstyle":
      return HAIR_SWATCHES;
    case "outfit":
      return OUTFIT_SWATCHES;
    case "face_accessory":
    case "head_accessory":
      return ACCESSORY_SWATCHES;
    case "background":
      return BACKGROUND_SWATCHES;
  }
}

export function isTintable(category: string): category is TintableCategory {
  return (TINTABLE_CATEGORIES as string[]).includes(category);
}
