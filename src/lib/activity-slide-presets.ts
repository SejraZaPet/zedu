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
  | "differentiated";

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
    label: "Hlasování",
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
];

export const getActivityPreset = (id: string): ActivityPreset | undefined =>
  ACTIVITY_PRESETS.find((p) => p.id === id);
