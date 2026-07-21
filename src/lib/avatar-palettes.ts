/**
 * Per-category color palettes for the avatar editor.
 * Each entry is a HEX string (#RRGGBB). Users can also pick any custom color.
 */

export const SKIN_SWATCHES: string[] = [
  "#1B1B1B", // black
  "#FFFFFF", // white
  "#8A8A8A", // grey
  "#B23A48", // red
  "#E08A2A", // orange
  "#F2C94C", // yellow
  "#3AA35A", // green
  "#2D6EDB", // blue
  "#A065D7", // brand purple
  "#63C7CF", // brand teal
];

export const HAIR_SWATCHES: string[] = [
  "#1B1B1B", // black
  "#3A2416", // dark brown
  "#6B4423", // brown
  "#A67B4A", // light brown
  "#D9B96A", // dark blond
  "#F2D98A", // blond
  "#C64B1B", // red/ginger
  "#8A8A8A", // grey
  "#FFFFFF", // white
  "#A065D7", // brand purple (fantasy)
  "#63C7CF", // brand teal (fantasy)
];

export const OUTFIT_SWATCHES: string[] = [
  "#1B1B1B", // black
  "#FFFFFF", // white
  "#8A8A8A", // grey
  "#B23A48", // red
  "#E08A2A", // orange
  "#F2C94C", // yellow
  "#3AA35A", // green
  "#2D6EDB", // blue
  "#A065D7", // brand purple
  "#63C7CF", // brand teal
];

export const ACCESSORY_SWATCHES: string[] = [
  "#1B1B1B",
  "#FFFFFF",
  "#8A8A8A",
  "#C89C4E", // gold
  "#B87333", // copper
  "#B23A48",
  "#3AA35A",
  "#2D6EDB",
  "#A065D7",
  "#63C7CF",
];

export type TintableCategory =
  | "base"
  | "hairstyle"
  | "outfit"
  | "face_accessory"
  | "head_accessory";

export const TINTABLE_CATEGORIES: TintableCategory[] = [
  "base",
  "hairstyle",
  "outfit",
  "face_accessory",
  "head_accessory",
];

/** Column on `avatar_profiles` that stores the picked color for each category. */
export const CATEGORY_COLOR_COLUMN: Record<TintableCategory, string> = {
  base: "base_color",
  hairstyle: "hairstyle_color",
  outfit: "outfit_color",
  face_accessory: "face_accessory_color",
  head_accessory: "head_accessory_color",
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
  }
}

export function isTintable(category: string): category is TintableCategory {
  return (TINTABLE_CATEGORIES as string[]).includes(category);
}
