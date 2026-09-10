/**
 * Jediná společná paleta barev pro celou appku (barva textu, pozadí bloku…).
 * Používá ji `ColorPalettePopover`, aby appka neměla dvě nesourodé cesty
 * k volbě barvy.
 */

export interface PaletteColor {
  name: string;
  value: string;
}

export interface PaletteGroup {
  label: string;
  colors: PaletteColor[];
}

export const COLOR_GROUPS: PaletteGroup[] = [
  {
    label: "Neutrální",
    colors: [
      { name: "Černá", value: "#000000" },
      { name: "Tmavě šedá", value: "#4a4a4a" },
      { name: "Šedá", value: "#8c8c8c" },
      { name: "Světle šedá", value: "#c8c8c8" },
      { name: "Bílá", value: "#f2f0eb" },
    ],
  },
  {
    label: "Hlavní",
    colors: [
      { name: "Červená", value: "#dc2626" },
      { name: "Oranžová", value: "#ea580c" },
      { name: "Žlutá", value: "#ca8a04" },
      { name: "Zelená", value: "#16a34a" },
      { name: "Modrá", value: "#2563eb" },
      { name: "Fialová", value: "#9333ea" },
    ],
  },
  {
    label: "Světlé",
    colors: [
      { name: "Světle modrá", value: "#60a5fa" },
      { name: "Světle zelená", value: "#4ade80" },
      { name: "Světle oranžová", value: "#fb923c" },
      { name: "Růžová", value: "#f472b6" },
      { name: "Lila", value: "#c084fc" },
      { name: "Tyrkysová", value: "#22d3ee" },
    ],
  },
];
