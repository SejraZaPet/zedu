// Visual themes for live games. Independent of the game mode (standard/race/tower/steal).
// A theme provides: background style, accent colors, in-game icons, and optional sound effects.

export type VisualTheme = "default" | "castle" | "space" | "pirate";

export interface VisualThemeDef {
  id: VisualTheme;
  name: string;
  emoji: string;
  description: string;
  // CSS variables applied to the projector / play container
  cssVars: Record<string, string>;
  // Tailwind utility classes for the page background (gradient + decorative layer)
  bgClass: string;
  decorEmoji?: string[]; // floating decorative icons
  // Icons used in answer tiles (override default shapes)
  answerIcons: [string, string, string, string];
  // Web Audio sound recipes (optional, played only when soundsEnabled)
  sounds?: {
    correct?: SoundRecipe;
    wrong?: SoundRecipe;
  };
}

export interface SoundRecipe {
  type: OscillatorType;
  notes: { freq: number; durMs: number; gain?: number }[];
}

export const VISUAL_THEMES: VisualThemeDef[] = [
  {
    id: "default",
    name: "Klasické",
    emoji: "🎯",
    description: "Čisté výchozí téma bez dekorací.",
    cssVars: {
      "--game-bg": "hsl(var(--background))",
      "--game-accent": "hsl(var(--primary))",
    },
    bgClass: "bg-background",
    answerIcons: ["▲", "◆", "●", "■"],
  },
  {
    id: "castle",
    name: "Středověký hrad",
    emoji: "🏰",
    description: "Kamenné pozadí, vlajky a trumpety za správnou odpověď.",
    cssVars: {
      "--game-bg": "#3b2f24",
      "--game-accent": "#d4a24a",
      "--game-stone": "#5a4a3a",
    },
    bgClass:
      "bg-[radial-gradient(circle_at_20%_10%,#5a4a3a_0%,#3b2f24_60%,#2a1f17_100%)]",
    decorEmoji: ["🏰", "⚔️", "🛡️", "🚩", "👑"],
    answerIcons: ["⚔️", "🛡️", "🏹", "🚩"],
    sounds: {
      correct: {
        type: "square",
        notes: [
          { freq: 523, durMs: 120 },
          { freq: 659, durMs: 120 },
          { freq: 784, durMs: 220 },
        ],
      },
      wrong: {
        type: "sawtooth",
        notes: [
          { freq: 220, durMs: 180 },
          { freq: 175, durMs: 240 },
        ],
      },
    },
  },
  {
    id: "space",
    name: "Vesmír",
    emoji: "🚀",
    description: "Hvězdné pozadí, rakety a exploze při chybě.",
    cssVars: {
      "--game-bg": "#0a0a23",
      "--game-accent": "#7dd3fc",
    },
    bgClass:
      "bg-[radial-gradient(ellipse_at_top,#1e1b4b_0%,#0a0a23_70%)] [background-image:radial-gradient(white_1px,transparent_1px),radial-gradient(white_1px,transparent_1px)] [background-size:40px_40px,80px_80px] [background-position:0_0,20px_20px]",
    decorEmoji: ["🚀", "🛸", "🪐", "⭐", "🌌", "👽"],
    answerIcons: ["🚀", "🛸", "🪐", "⭐"],
    sounds: {
      correct: {
        type: "sine",
        notes: [
          { freq: 880, durMs: 80 },
          { freq: 1320, durMs: 200 },
        ],
      },
      wrong: {
        type: "sawtooth",
        notes: [
          { freq: 120, durMs: 60 },
          { freq: 80, durMs: 80 },
          { freq: 60, durMs: 200 },
        ],
      },
    },
  },
  {
    id: "pirate",
    name: "Pirátská loď",
    emoji: "🏴‍☠️",
    description: "Mořské pozadí, truhlice s pokladem a kanóny.",
    cssVars: {
      "--game-bg": "#0c4a6e",
      "--game-accent": "#fbbf24",
    },
    bgClass:
      "bg-[linear-gradient(to_bottom,#075985_0%,#0c4a6e_55%,#082f49_100%)]",
    decorEmoji: ["🏴‍☠️", "⚓", "🦜", "💰", "🗺️", "⛵"],
    answerIcons: ["⚓", "💰", "🗺️", "🏴‍☠️"],
    sounds: {
      correct: {
        type: "triangle",
        notes: [
          { freq: 440, durMs: 100 },
          { freq: 660, durMs: 100 },
          { freq: 880, durMs: 200 },
        ],
      },
      wrong: {
        type: "square",
        notes: [
          { freq: 90, durMs: 250, gain: 0.3 },
        ],
      },
    },
  },
];

export const getVisualTheme = (id?: string): VisualThemeDef =>
  VISUAL_THEMES.find((t) => t.id === id) ?? VISUAL_THEMES[0];

// --- Sound playback helper (Web Audio, no assets) ---
let _ctx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return _ctx;
  } catch {
    return null;
  }
};

export function playRecipe(recipe?: SoundRecipe) {
  if (!recipe) return;
  const ctx = getCtx();
  if (!ctx) return;
  let t = ctx.currentTime;
  for (const note of recipe.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = recipe.type;
    osc.frequency.setValueAtTime(note.freq, t);
    const g = note.gain ?? 0.15;
    gain.gain.setValueAtTime(g, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + note.durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + note.durMs / 1000);
    t += note.durMs / 1000;
  }
}
