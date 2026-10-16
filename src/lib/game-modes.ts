export type GameMode = "standard" | "race" | "tower" | "steal";

export interface GameModeDef {
  id: GameMode;
  name: string;
  emoji: string;
  description: string;
  scoringHint: string;
  themes: { id: string; name: string; emoji: string }[];
}

export const GAME_MODES: GameModeDef[] = [
  {
    id: "standard",
    name: "Klasický kvíz",
    emoji: "🎯",
    description: "Body podle rychlosti a správnosti odpovědí (jako Kahoot).",
    scoringHint: "400 – 1000 bodů za otázku",
    themes: [{ id: "default", name: "Klasické", emoji: "🎯" }],
  },
  {
    id: "race",
    name: "Závod",
    emoji: "🏁",
    description: "Každý odpovídá svým tempem, za správnou odpověď postoupí. Avataři běží po trati.",
    scoringHint: "+10 bodů za správnou odpověď",
    themes: [
      { id: "f1", name: "Formule", emoji: "🏎️" },
      { id: "forest", name: "Lesní stezka", emoji: "🌲" },
      { id: "space", name: "Vesmír", emoji: "🚀" },
    ],
  },
  {
    id: "tower",
    name: "Stavění věže",
    emoji: "🧱",
    description: "Každá správná odpověď přidá kostku. Nejvyšší věž vyhrává.",
    scoringHint: "+1 kostka za správnou odpověď",
    themes: [
      { id: "bricks", name: "Cihly", emoji: "🧱" },
      { id: "lego", name: "Lego", emoji: "🟦" },
      { id: "candy", name: "Cukroví", emoji: "🍬" },
    ],
  },
  {
    id: "steal",
    name: "Krádež bodů",
    emoji: "🏴‍☠️",
    description: "Správně = 100 bodů a krádež 10 % bodů vedoucímu soupeři (50–300). Špatně = −100. Tři správně v řadě = lupič, krade dvojnásobek. Spoluhráčům se nekrade.",
    scoringHint: "+100 a krádež, chyba −100",
    themes: [
      { id: "pirate", name: "Piráti", emoji: "🏴‍☠️" },
      { id: "thief", name: "Lupiči", emoji: "🦝" },
    ],
  },
];

export const getModeDef = (id?: string): GameModeDef =>
  GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];

export const getThemeDef = (modeId?: string, themeId?: string) => {
  const mode = getModeDef(modeId);
  return mode.themes.find((t) => t.id === themeId) ?? mode.themes[0];
};
