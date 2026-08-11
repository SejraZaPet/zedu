/** Startovací šablony pro novou prezentaci (prázdný obsah, správné typy slidů). */

export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
  build: () => any[];
}

let seq = 0;
const sid = (prefix: string) => `tpl-${Date.now()}-${prefix}-${seq++}`;

const explainSlide = (headline: string) => ({
  slideId: sid("explain"),
  type: "explain",
  projector: { headline, body: "" },
  device: { instructions: "Sledujte projektor." },
  blocks: [],
  layout: "full",
});

const mcqSlide = (headline: string) => ({
  slideId: sid("mcq"),
  type: "activity",
  projector: { headline, body: "" },
  device: { instructions: "Vyberte správnou odpověď." },
  activitySpec: {
    activityType: "mcq",
    question: "",
    options: [
      { text: "", correct: true, isCorrect: true },
      { text: "", correct: false, isCorrect: false },
    ],
    correctIndex: 0,
  },
});

const teamsSlide = () => ({
  slideId: sid("teams"),
  type: "activity",
  projector: { headline: "Rozdělení do skupin", body: "" },
  device: { instructions: "Podívej se, ve které jsi skupině." },
  activitySpec: { activityType: "teams", teamMode: "random", teamCount: 3 },
});

const differentiatedSlide = () => ({
  slideId: sid("diff"),
  type: "activity",
  projector: { headline: "Diferencovaná aktivita", body: "" },
  device: { instructions: "Podívej se na úkol pro svou skupinu." },
  activitySpec: {
    activityType: "differentiated",
    topic: "",
    tasks: [
      { title: "Skupina A", content: "" },
      { title: "Skupina B", content: "" },
      { title: "Skupina C", content: "" },
    ],
    teamCount: 3,
  },
});

const wallSlide = (headline: string) => ({
  slideId: sid("wall"),
  type: "activity",
  projector: { headline, body: "" },
  device: { instructions: "Napište svou odpověď." },
  activitySpec: { activityType: "wall", question: "", anonymous: false, allowMultiple: false },
});

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: "classic-lesson",
    name: "Klasická hodina",
    description: "Úvod → výklad → procvičení → shrnutí",
    build: () => [
      explainSlide("Úvod hodiny"),
      explainSlide("Výklad"),
      mcqSlide("Procvičení"),
      explainSlide("Shrnutí"),
    ],
  },
  {
    id: "quiz-only",
    name: "Jen kvíz",
    description: "Jeden prázdný kvízový slide",
    build: () => [mcqSlide("Kvízová otázka")],
  },
  {
    id: "discussion-groups",
    name: "Diskuze a skupinová práce",
    description: "Výklad → rozdělení do skupin → diferencovaná aktivita → diskuzní zeď",
    build: () => [
      explainSlide("Zadání a kontext"),
      teamsSlide(),
      differentiatedSlide(),
      wallSlide("Co jste zjistili?"),
    ],
  },
  {
    id: "blank",
    name: "Prázdná prezentace",
    description: "Jeden prázdný slide, doplníte si vše sami",
    build: () => [explainSlide("Nový slide")],
  },
];
