import { DEFAULT_ROUNDED_RADIUS_PX } from "@/lib/shape-corner-radius";
import { BEZLI_TEMPLATE_GRADIENT } from "@/lib/presentation-themes";
import { DEFAULT_ACTIVITY_COLORS } from "@/lib/activity-colors";

/** Datové šablony: žádný obrázek náhledu, vše jsou běžné upravitelné slidy a bloky. */
export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
  build: () => any[];
}

export interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  build: () => any;
}

let seq = 0;
const sid = (prefix: string) => `tpl-${Date.now()}-${prefix}-${seq++}`;
const HEADING_FONT = '"Oswald", "Arial Narrow", sans-serif';
const BODY_FONT = '"DM Sans", system-ui, sans-serif';
const C = {
  violet: "#663196", violetDeep: "#5D3D7F", teal: "#63C7CF",
  cream: "#F3F1E6", ink: "#2B1A3F", white: "#FFFFFF",
} as const;

const framed = (type: string, props: Record<string, any>, frame: { x: number; y: number; w: number; h: number }, zIndex = 2) => ({
  id: sid(type), type, visible: true, frame, zIndex, props,
});
const heading = (text: string, frame: any, size = 44, color: string = C.white, align = "left") => framed("heading", {
  level: 2, text: text.toUpperCase(), fontSize: size, color, fontFamily: HEADING_FONT, bold: true, align, lineHeight: 1.05,
}, frame, 3);
const text = (value: string, frame: any, size = 24, color: string = C.white, extra: Record<string, any> = {}) => framed("paragraph", {
  text: value, fontSize: size, color, fontFamily: BODY_FONT, lineHeight: 1.25, ...extra,
}, frame, 3);
const shape = (frame: any, fillColor: string = C.cream, shapeKind = "rounded-rect") => framed("shape", {
  shapeKind, fillColor, strokeColor: fillColor, strokeWidth: 0, borderRadius: shapeKind === "pill" ? 999 : 28, cornerRadiusPx: shapeKind === "pill" ? undefined : DEFAULT_ROUNDED_RADIUS_PX, opacity: 100,
}, frame, 1);
const pill = (label: string, frame: any) => framed("shape", {
  shapeKind: "pill", fillColor: C.teal, strokeColor: C.teal, strokeWidth: 0, borderRadius: 999,
  text: label.toUpperCase(), fontSize: 14, color: C.ink, fontFamily: BODY_FONT, bold: true, align: "center",
}, frame, 3);
const image = (frame: any) => framed("image", {
  url: "/placeholder.svg", alt: "Místo pro vlastní obrázek", caption: "Popisek obrázku", fit: "cover",
}, frame, 3);

function footerBlocks() {
  return [
    shape({ x: 0, y: 90, w: 100, h: 10 }, C.cream, "rectangle"),
    text("Bez·li | Učení bez limitu", { x: 4, y: 92, w: 38, h: 5 }, 14, C.violetDeep, { bold: true }),
    text("tvoř · inspiruj · sdílej · uč", { x: 57, y: 92, w: 39, h: 5 }, 13, C.violetDeep, { align: "right", italic: true }),
  ];
}

function baseSlide(blocks: any[], extra: Record<string, any> = {}) {
  return {
    slideId: sid("slide"), type: "explain", themeId: "bezli-gradient",
    backgroundOverride: { gradient: { ...BEZLI_TEMPLATE_GRADIENT } },
    projector: { headline: "", body: "", assetRefs: [] },
    device: { instructions: "Sledujte projektor." },
    teacherNotes: "", layout: "full", hideEmptyEditorPlaceholders: true,
    blocks: [...blocks, ...footerBlocks()], ...extra,
  };
}

const titleSlide = () => baseSlide([
  pill("Nová hodina", { x: 6, y: 10, w: 20, h: 6 }),
  heading("Název hodiny", { x: 6, y: 25, w: 82, h: 22 }, 62),
  text("Podtitulek · předmět · ročník", { x: 7, y: 52, w: 72, h: 10 }, 25, C.cream),
  shape({ x: 7, y: 68, w: 22, h: 2 }, C.teal, "pill"),
]);
const goalSlide = () => baseSlide([
  pill("Cíl hodiny", { x: 6, y: 7, w: 20, h: 6 }),
  heading("Co se dnes naučíme", { x: 6, y: 16, w: 86, h: 13 }, 42),
  shape({ x: 6, y: 34, w: 88, h: 44 }),
  text("Na konci hodiny dokážu …", { x: 12, y: 42, w: 76, h: 12 }, 32, C.ink, { bold: true }),
  text("Doplňte jeden jasný a ověřitelný cíl.", { x: 12, y: 58, w: 76, h: 10 }, 22, C.ink),
]);
const textImageSlide = () => baseSlide([
  heading("Téma ve zkratce", { x: 6, y: 8, w: 86, h: 12 }, 42),
  shape({ x: 6, y: 25, w: 42, h: 52 }),
  text("Hlavní myšlenka", { x: 10, y: 31, w: 34, h: 10 }, 28, C.ink, { bold: true }),
  text("Vysvětlení vlastními slovy. Text můžete upravit, přesunout i změnit jeho barvu.", { x: 10, y: 45, w: 34, h: 23 }, 21, C.ink),
  image({ x: 53, y: 25, w: 41, h: 52 }),
]);
function cardsSlide(count: 2 | 3) {
  const gap = 3; const width = (88 - gap * (count - 1)) / count;
  const blocks: any[] = [heading(count === 2 ? "Dvě klíčové myšlenky" : "Tři kroky k cíli", { x: 6, y: 8, w: 88, h: 12 }, 42)];
  for (let i = 0; i < count; i++) {
    const x = 6 + i * (width + gap);
    blocks.push(shape({ x, y: 27, w: width, h: 50 }));
    blocks.push(pill(`${i + 1}`, { x: x + 3, y: 31, w: 8, h: 6 }));
    blocks.push(text(["První myšlenka", "Druhá myšlenka", "Třetí myšlenka"][i], { x: x + 3, y: 42, w: width - 6, h: 10 }, 25, C.ink, { bold: true }));
    blocks.push(text("Doplňte krátké vysvětlení nebo konkrétní příklad.", { x: x + 3, y: 56, w: width - 6, h: 15 }, 18, C.ink));
  }
  return baseSlide(blocks);
}
const statsSlide = () => {
  const blocks: any[] = [heading("Téma v číslech", { x: 6, y: 8, w: 88, h: 12 }, 42)];
  [["123", "PRŮMĚR"], ["80 %", "PODÍL"], ["3×", "ČETNOST"]].forEach(([number, label], i) => {
    const x = 6 + i * 30;
    blocks.push(shape({ x, y: 29, w: 27, h: 43 }));
    blocks.push(text(number, { x: x + 2, y: 37, w: 23, h: 15 }, 48, C.violetDeep, { bold: true, align: "center" }));
    blocks.push(text(label, { x: x + 2, y: 56, w: 23, h: 7 }, 15, C.ink, { bold: true, align: "center" }));
  });
  return baseSlide(blocks);
};
const quoteSlide = () => baseSlide([
  pill("Citát", { x: 6, y: 8, w: 15, h: 6 }),
  shape({ x: 10, y: 23, w: 80, h: 51 }),
  text("„Sem napište vlastní citát.“", { x: 17, y: 32, w: 66, h: 19 }, 34, C.violetDeep, { italic: true, align: "center" }),
  text("Jméno autora", { x: 17, y: 57, w: 66, h: 7 }, 18, C.ink, { align: "center" }),
]);
const quizSlide = () => {
  const spec = {
    activityType: "mcq", question: "Otázka pro třídu",
    options: [{ text: "Odpověď A", correct: true, isCorrect: true }, { text: "Odpověď B", correct: false, isCorrect: false }],
    correctIndex: 0, timeLimitSec: 30, points: 1, colors: { ...DEFAULT_ACTIVITY_COLORS },
  };
  return baseSlide([
    pill("Aktivita · Kvíz", { x: 6, y: 7, w: 25, h: 6 }),
    { ...framed("activity", spec, { x: 8, y: 17, w: 84, h: 65 }, 3), renderAs: "activity-preview" },
  ], { type: "activity", activitySpec: spec, device: { instructions: "Vyberte správnou odpověď." } });
};
const summarySlide = () => baseSlide([
  heading("Co si odnášíme", { x: 6, y: 8, w: 88, h: 12 }, 42),
  shape({ x: 6, y: 26, w: 88, h: 51 }),
  framed("bullet_list", { items: ["První klíčová myšlenka", "Druhá klíčová myšlenka", "Na co se chci ještě zeptat"], fontSize: 25, color: C.ink, fontFamily: BODY_FONT }, { x: 12, y: 33, w: 76, h: 36 }, 3),
]);
const closingSlide = () => baseSlide([
  pill("Závěr", { x: 6, y: 10, w: 15, h: 6 }),
  heading("Děkuji za pozornost", { x: 6, y: 29, w: 88, h: 18 }, 54),
  text("Otázky a diskuze", { x: 7, y: 54, w: 70, h: 10 }, 26, C.cream),
]);
const breakSlide = () => baseSlide([
  pill("Přestávka", { x: 6, y: 10, w: 20, h: 6 }),
  heading("Přestávka", { x: 6, y: 29, w: 88, h: 18 }, 58),
  text("Za chvíli pokračujeme.", { x: 7, y: 54, w: 70, h: 10 }, 26, C.cream),
]);

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  { id: "title", name: "Titulní", description: "Název hodiny a podtitulek", build: titleSlide },
  { id: "goal", name: "Cíl hodiny", description: "Jeden jasný výstup hodiny", build: goalSlide },
  { id: "text-image", name: "Text + obrázek", description: "Vysvětlení s vlastním obrázkem", build: textImageSlide },
  { id: "two-cards", name: "Dvě karty", description: "Porovnání dvou myšlenek", build: () => cardsSlide(2) },
  { id: "three-cards", name: "Tři karty", description: "Tři kroky nebo pojmy", build: () => cardsSlide(3) },
  { id: "stats", name: "Statistiky / čísla", description: "Tři výrazné číselné údaje", build: statsSlide },
  { id: "quote", name: "Citát", description: "Vlastní citát a autor", build: quoteSlide },
  { id: "quiz", name: "Aktivita / kvíz", description: "Upravitelná otázka a odpovědi", build: quizSlide },
  { id: "summary", name: "Shrnutí", description: "Tři odnášené myšlenky", build: summarySlide },
  { id: "closing", name: "Závěr", description: "Poděkování a prostor pro dotazy", build: closingSlide },
  { id: "break", name: "Přestávka", description: "Jasná zpráva pro třídu", build: breakSlide },
];

const fromSlide = (id: string) => SLIDE_TEMPLATES.find((template) => template.id === id)!.build();
export const BEZLI_DECK_TEMPLATES: PresentationTemplate[] = [
  { id: "three-steps", name: "Hodina ve třech krocích", description: "Titulek → tři kroky → shrnutí", build: () => [fromSlide("title"), fromSlide("three-cards"), fromSlide("summary")] },
  { id: "topic-intro", name: "Úvod do tématu", description: "Titulek → cíl → vysvětlení → závěr", build: () => [fromSlide("title"), fromSlide("goal"), fromSlide("text-image"), fromSlide("closing")] },
  { id: "quiz-review", name: "Opakování s kvízem", description: "Titulek → kvíz → čísla → shrnutí", build: () => [fromSlide("title"), fromSlide("quiz"), fromSlide("stats"), fromSlide("summary")] },
];

// Původní startovní struktury zůstávají dostupné pro starší dialogy i obsah.
const explainSlide = (headline: string) => ({ slideId: sid("explain"), type: "explain", projector: { headline, body: "" }, device: { instructions: "Sledujte projektor." }, blocks: [], layout: "full" });
const teamsSlide = () => ({ slideId: sid("teams"), type: "activity", projector: { headline: "Rozdělení do skupin", body: "" }, device: { instructions: "Podívej se, ve které jsi skupině." }, activitySpec: { activityType: "teams", teamMode: "random", teamCount: 3 } });
const differentiatedSlide = () => ({ slideId: sid("diff"), type: "activity", projector: { headline: "Diferencovaná aktivita", body: "" }, device: { instructions: "Podívej se na úkol pro svou skupinu." }, activitySpec: { activityType: "differentiated", topic: "", tasks: [{ title: "Skupina A", content: "" }, { title: "Skupina B", content: "" }, { title: "Skupina C", content: "" }], teamCount: 3 } });
const wallSlide = (headline: string) => ({ slideId: sid("wall"), type: "activity", projector: { headline, body: "" }, device: { instructions: "Napište svou odpověď." }, activitySpec: { activityType: "wall", question: "", anonymous: false, allowMultiple: false } });

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  { id: "classic-lesson", name: "Klasická hodina", description: "Úvod → výklad → procvičení → shrnutí", build: () => [fromSlide("title"), fromSlide("goal"), fromSlide("quiz"), fromSlide("summary")] },
  { id: "quiz-only", name: "Jen kvíz", description: "Jeden prázdný kvízový slide", build: () => [fromSlide("quiz")] },
  { id: "discussion-groups", name: "Diskuze a skupinová práce", description: "Výklad → rozdělení do skupin → diferencovaná aktivita → diskuzní zeď", build: () => [explainSlide("Zadání a kontext"), teamsSlide(), differentiatedSlide(), wallSlide("Co jste zjistili?")] },
  { id: "blank", name: "Prázdná prezentace", description: "Jeden prázdný slide, doplníte si vše sami", build: () => [explainSlide("Nový slide")] },
];

export function cloneTemplateSlides(slides: any[]): any[] {
  return (slides || []).map((slide) => ({
    ...structuredClone(slide), slideId: sid("custom-slide"),
    blocks: (slide.blocks || []).map((block: any) => ({ ...structuredClone(block), id: sid(`custom-${block.type || "block"}`) })),
  }));
}

/** Vložení nikdy nemutuje původní slidy ani existující obsah. */
export function insertTemplateSlidesAfter(slides: any[], templates: any[], index: number): any[] {
  const inserted = cloneTemplateSlides(templates);
  const at = Math.max(-1, Math.min(index, slides.length - 1));
  return [...slides.slice(0, at + 1), ...inserted, ...slides.slice(at + 1)];
}
