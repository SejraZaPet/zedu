/**
 * Předpřipravené interaktivní aktivity pro editor prezentací.
 *
 * Jediné místo, kde se definují typy aktivit nabízené učiteli při tvorbě
 * prezentace (záložka „Aktivity“ v levém railu). Vytvoří slide s minimálním
 * `activitySpec`, který učitel doladí v panelu „Slide“.
 */

const newId = () => crypto.randomUUID();

export type ActivityPresetId =
  | "mcq"
  | "wordcloud"
  | "wall"
  | "poll"
  | "teams"
  | "escape"
  | "differentiated"
  | "fill_blanks"
  | "fill_choice"
  | "image_hotspot"
  | "crossword"
  | "flashcards"
  | "reveal_cards"
  | "memory_game"
  | "image_label"
  | "true_false"
  | "matching"
  | "ordering"
  | "sorting";


export interface ActivityPreset {
  id: ActivityPresetId;
  label: string;
  hint: string;
  /** Název ikony z lucide-react (mapuje se v UI). */
  icon: string;
  build: () => any;
}

const activitySlide = (
  activityType: string,
  headline: string,
  instructions: string,
  spec: Record<string, unknown> = {},
) => ({
  slideId: newId(),
  type: "activity",
  projector: { headline, body: "", assetRefs: [] },
  device: { instructions },
  activitySpec: { activityType, question: headline, ...spec },
});

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  {
    id: "mcq",
    label: "Kvíz",
    hint: "Otázka s výběrem odpovědi",
    icon: "HelpCircle",
    build: () =>
      activitySlide("mcq", "Nová otázka", "Vyberte správnou odpověď.", {
        options: [
          { text: "Odpověď A", correct: true, isCorrect: true },
          { text: "Odpověď B", correct: false, isCorrect: false },
          { text: "Odpověď C", correct: false, isCorrect: false },
          { text: "Odpověď D", correct: false, isCorrect: false },
        ],
        correctIndex: 0,
      }),
  },
  {
    id: "wordcloud",
    label: "Oblak slov",
    hint: "Žáci pošlou slovo nebo frázi",
    icon: "Cloud",
    build: () =>
      activitySlide("wordcloud", "Jaké slovo vás napadne?", "Pošlete slovo nebo krátkou frázi.", {
        anonymous: true,
      }),
  },
  {
    id: "wall",
    label: "Zeď odpovědí",
    hint: "Krátké odpovědi na společnou zeď",
    icon: "MessageSquare",
    build: () =>
      activitySlide("wall", "Napište svou odpověď", "Napište svou odpověď.", {
        anonymous: true,
        allowMultiple: false,
      }),
  },
  {
    id: "poll",
    label: "Anketa",
    hint: "Rychlá anketa bez správné odpovědi",
    icon: "BarChart3",
    build: () =>
      activitySlide("poll", "O čem hlasujeme?", "Vyberte jednu možnost.", {
        options: [{ text: "Možnost A" }, { text: "Možnost B" }],
      }),
  },
  {
    id: "teams",
    label: "Týmy",
    hint: "Rozdělení třídy do skupin",
    icon: "Users2",
    build: () =>
      activitySlide("teams", "Rozdělení do skupin", "Podívej se, ve které jsi skupině.", {
        teamMode: "random",
        teamCount: 3,
      }),
  },
  {
    id: "escape",
    label: "Escape úkol",
    hint: "Série zámků s kódy",
    icon: "KeyRound",
    build: () =>
      activitySlide("escape", "Úniková hra", "Vylušti postupně všechny zámky.", {
        intro: "",
        locks: [
          { clue: "Hádanka 1", code: "" },
          { clue: "Hádanka 2", code: "" },
          { clue: "Hádanka 3", code: "" },
        ],
        finalMessage: "",
      }),
  },
  {
    id: "differentiated",
    label: "Diferencovaná aktivita",
    hint: "Každá skupina dostane jiný úkol",
    icon: "SplitSquareHorizontal",
    build: () =>
      activitySlide("differentiated", "Diferencovaná aktivita", "Podívej se na úkol pro svou skupinu.", {
        topic: "",
        tasks: [
          { title: "Základní", content: "" },
          { title: "Rozšiřující", content: "" },
        ],
        teamCount: 2,
      }),
  },
  {
    id: "fill_blanks",
    label: "Doplň slova",
    hint: "Text s mezerami, žáci píší odpovědi",
    icon: "TextCursorInput",
    build: () =>
      activitySlide("fill_blanks", "Doplň slova", "Doplň chybějící slova do textu.", {
        fillBlanks: {
          text: "Hlavní město Česka je {{Praha}}.",
          caseSensitive: false,
          diacriticSensitive: true,
        },
      }),
  },
  {
    id: "fill_choice",
    label: "Doplň z nabídky",
    hint: "Text s mezerami a bankou slov",
    icon: "ListChecks",
    build: () =>
      activitySlide("fill_choice", "Doplň z nabídky", "Přetáhni nebo vyber správná slova.", {
        fillChoice: {
          tokens: [
            { type: "text", value: "Voda vře při " },
            { type: "blank", answer: "100" },
            { type: "text", value: " °C." },
          ],
          options: ["100", "90"],
        },
      }),
  },
  {
    id: "image_hotspot",
    label: "Klikni na správnou část",
    hint: "Aktivní body v obrázku",
    icon: "MousePointerClick",
    build: () =>
      activitySlide("image_hotspot", "Klikni na správnou část", "Klikni do obrázku na správné místo.", {
        imageHotspot: {
          imageUrl: "",
          hotspots: [{ label: "Klikni na…", x: 50, y: 50, radius: 8 }],
        },
      }),
  },
  {
    id: "crossword",
    label: "Křížovka",
    hint: "Mřížka s nápovědami",
    icon: "Grid3X3",
    build: () =>
      activitySlide("crossword", "Křížovka", "Vylušti křížovku.", {
        crossword: {
          entries: [
            { answer: "PRAHA", clue: "Hlavní město Česka" },
            { answer: "BRNO", clue: "Druhé největší město" },
          ],
        },
      }),
  },
  {
    id: "flashcards",
    label: "Otoč kartičky",
    hint: "Dvoustranné kartičky k opakování",
    icon: "Layers",
    build: () =>
      activitySlide("flashcards", "Otoč kartičky", "Klikni na kartičku a otoč ji.", {
        flashcards: [
          { front: "Přední strana", back: "Zadní strana" },
          { front: "Přední strana 2", back: "Zadní strana 2" },
        ],
      }),
  },
  {
    id: "reveal_cards",
    label: "Otevři kartičku",
    hint: "Skryté texty k postupnému odhalení",
    icon: "SquareStack",
    build: () =>
      activitySlide("reveal_cards", "Otevři kartičku", "Postupně odhal všechny kartičky.", {
        revealCards: {
          cards: [
            { title: "Kartička 1", content: "Skrytý text" },
            { title: "Kartička 2", content: "Skrytý text" },
          ],
        },
      }),
  },
  {
    id: "memory_game",
    label: "Najdi dvojice",
    hint: "Pexeso s páry pojmů",
    icon: "Grid2X2",
    build: () =>
      activitySlide("memory_game", "Najdi dvojice", "Najdi všechny dvojice.", {
        memoryGame: {
          pairs: [
            { left: "Pojem", right: "Význam" },
            { left: "Pojem 2", right: "Význam 2" },
          ],
        },
      }),
  },
  {
    id: "image_label",
    label: "Popiš obrázek",
    hint: "Slepá mapa – přetahování popisků",
    icon: "MapPin",
    build: () =>
      activitySlide("image_label", "Popiš obrázek", "Přetáhni popisky na správná místa.", {
        imageLabel: {
          imageUrl: "",
          markers: [{ label: "Popisek", x: 50, y: 50 }],
          tolerance: 5,
          shuffleWords: true,
        },
      }),
  },
  {
    id: "true_false",
    label: "Urči pravda/nepravda",
    hint: "Tvrzení k posouzení",
    icon: "CheckCheck",
    build: () =>
      activitySlide("true_false", "Pravda, nebo nepravda?", "Rozhodni u každého tvrzení.", {
        trueFalse: {
          statements: [
            { text: "Nové tvrzení", isTrue: true },
            { text: "Další tvrzení", isTrue: false },
          ],
        },
      }),
  },
  {
    id: "matching",
    label: "Přiřaď dvojice A–B",
    hint: "Spojování odpovídajících pojmů",
    icon: "ArrowLeftRight",
    build: () =>
      activitySlide("matching", "Přiřaď dvojice", "Ke každému pojmu vyber správnou dvojici.", {
        matching: {
          left: ["Pojem A", "Pojem B"],
          right: ["Odpověď A", "Odpověď B"],
        },
      }),
  },
  {
    id: "ordering",
    label: "Seřaď správně",
    hint: "Uspořádání kroků do pořadí",
    icon: "ListOrdered",
    build: () =>
      activitySlide("ordering", "Seřaď správně", "Přetáhni položky do správného pořadí.", {
        ordering: { items: ["První", "Druhý", "Třetí"] },
      }),
  },
  {
    id: "sorting",
    label: "Roztřiď do skupin",
    hint: "Třídění položek do kategorií",
    icon: "FolderTree",
    build: () =>
      activitySlide("sorting", "Roztřiď do skupin", "Zařaď každou položku do správné skupiny.", {
        sorting: {
          groups: ["Skupina 1", "Skupina 2"],
          items: [
            { text: "Položka 1", group: 0 },
            { text: "Položka 2", group: 1 },
          ],
        },
      }),
  },
];

export const getActivityPreset = (id: string): ActivityPreset | undefined =>
  ACTIVITY_PRESETS.find((p) => p.id === id);

