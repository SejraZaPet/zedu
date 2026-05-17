/**
 * Helpers pro vytváření prázdného WorksheetSpec a defaultních bloků.
 */

import type {
  WorksheetSpec,
  WorksheetItem,
  ItemType,
  Difficulty,
  AnswerKeyEntry,
} from "@/lib/worksheet-spec";
import { WORKSHEET_SPEC_VERSION } from "@/lib/worksheet-spec";

export function emptyWorksheetSpec(opts?: {
  title?: string;
  subject?: string;
  gradeBand?: string;
  worksheetMode?: string;
}): WorksheetSpec {
  return {
    version: WORKSHEET_SPEC_VERSION,
    header: {
      title: opts?.title ?? "Nový pracovní list",
      subject: opts?.subject ?? "",
      gradeBand: opts?.gradeBand ?? "",
      worksheetMode: opts?.worksheetMode ?? "classwork",
      studentNameField: true,
      dateField: true,
      classField: true,
      instructions: "",
    },
    variants: [
      {
        variantId: "A",
        seed: Math.floor(Math.random() * 10000),
        items: [],
      },
    ],
    answerKeys: { A: [] },
    metadata: {
      totalPoints: 0,
      totalTimeMin: 0,
      difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
      typeDistribution: {},
      createdAt: new Date().toISOString(),
    },
    randomizationRules: [],
    renderConfig: {
      target: "web",
      showPoints: true,
      showDifficulty: false,
      showTimeEstimate: false,
      showTypeLabels: true,
      paper: "A4",
      includeAnswerKey: false,
      pointsEnabled: true,
    },
  };
}

let _idCounter = 0;
export function nextItemId(): string {
  _idCounter += 1;
  return `q-${Date.now().toString(36)}-${_idCounter}`;
}

export function createDefaultItem(type: ItemType, itemNumber: number): WorksheetItem {
  const base: WorksheetItem = {
    id: nextItemId(),
    itemNumber,
    type,
    prompt: "",
    points: 1,
    difficulty: "easy" as Difficulty,
    timeEstimateSec: 30,
    answerSpace: { type: "none", heightMm: 0 },
  };

  switch (type) {
    case "mcq":
      return { ...base, prompt: "Otázka s výběrem", choices: ["Volba A", "Volba B", "Volba C", "Volba D"] };
    case "true_false":
      return { ...base, prompt: "Tvrzení k posouzení (pravda/nepravda)" };
    case "fill_blank":
      return { ...base, prompt: "Doplň chybějící slova:", blankText: "Toto je věta s ___ doplněním." };
    case "matching":
      return {
        ...base,
        prompt: "Spoj páry:",
        matchPairs: [
          { left: "A", right: "1" },
          { left: "B", right: "2" },
          { left: "C", right: "3" },
        ],
      };
    case "ordering":
      return {
        ...base,
        prompt: "Seřaď ve správném pořadí:",
        orderItems: ["První krok", "Druhý krok", "Třetí krok"],
      };
    case "short_answer":
      return {
        ...base,
        prompt: "Krátká otázka",
        answerSpace: { type: "lines", heightMm: 15, lineCount: 2 },
      };
    case "open_answer":
      return {
        ...base,
        prompt: "Otevřená otázka – vysvětlete vlastními slovy.",
        points: 5,
        timeEstimateSec: 180,
        answerSpace: { type: "lines", heightMm: 50, lineCount: 8 },
      };
    case "offline_activity":
      return {
        ...base,
        prompt: "Diskutujte ve třídě o tématu a zapište si hlavní závěry.",
        points: 2,
        timeEstimateSec: 600, // 10 min
        difficulty: "medium",
        offlineMode: "discussion",
        groupSize: "class",
        durationMin: 10,
        answerSpace: { type: "lines", heightMm: 40, lineCount: 6 },
      };
    case "section_header":
      return { ...base, prompt: "Název sekce", points: 0, timeEstimateSec: 0,
        answerSpace: { type: "none", heightMm: 0 }, tags: ["section_heading"] };
    case "write_lines":
      return { ...base, prompt: "Zapište definici:", points: 0, timeEstimateSec: 120,
        lineCount: 4, lineStyle: "dotted",
        answerSpace: { type: "lines", heightMm: 30, lineCount: 4 } };
    case "instruction_box":
      return { ...base, prompt: "Pracujte s učebnicí a zapište si hlavní body.", points: 0,
        timeEstimateSec: 0, instructionVariant: "blue", instructionIcon: "info",
        answerSpace: { type: "none", heightMm: 0 } };
    case "two_boxes":
      return { ...base, prompt: "Porovnejte:", points: 0, timeEstimateSec: 120,
        leftTitle: "Box 1", leftContent: "lines:4",
        rightTitle: "Box 2", rightContent: "lines:4",
        answerSpace: { type: "none", heightMm: 0 } };
    case "qr_link":
      return { ...base, prompt: "Naskenuj QR kód:", points: 0, timeEstimateSec: 0,
        qrUrl: "", answerSpace: { type: "none", heightMm: 0 } };
    case "flow_steps":
      return { ...base, prompt: "Postup:", points: 0, timeEstimateSec: 60,
        flowSteps: ["Krok 1", "Krok 2", "Krok 3"], flowDirection: "vertical",
        answerSpace: { type: "none", heightMm: 0 } };
    case "crossword":
      return { ...base, prompt: "Vylušti křížovku:", points: 5, timeEstimateSec: 600, difficulty: "medium",
        crosswordCols: 12, crosswordRows: 10,
        crosswordEntries: [
          { answer: "PRAHA", clue: "Hlavní město ČR", direction: "across", row: 0, col: 0, number: 1 },
          { answer: "BRNO", clue: "Moravská metropole", direction: "down", row: 0, col: 0, number: 1 },
        ],
        answerSpace: { type: "none", heightMm: 0 } };
    case "word_search":
      return { ...base, prompt: "Najdi v osmisměrce všechna slova:", points: 3, timeEstimateSec: 300, difficulty: "easy",
        wordSearchSize: 12, wordSearchWords: ["PRAHA", "BRNO", "OSTRAVA", "PLZEN"],
        answerSpace: { type: "none", heightMm: 0 } };
    case "sorting":
      return { ...base, prompt: "Zařaď položky do správných kategorií:", points: 4, timeEstimateSec: 180, difficulty: "easy",
        sortingCategories: [
          { id: "a", label: "Kategorie A" },
          { id: "b", label: "Kategorie B" },
        ],
        sortingItems: [
          { text: "Položka 1", categoryId: "a" },
          { text: "Položka 2", categoryId: "b" },
          { text: "Položka 3", categoryId: "a" },
          { text: "Položka 4", categoryId: "b" },
        ],
        answerSpace: { type: "none", heightMm: 0 } };
    case "flashcards":
      return { ...base, prompt: "Kartičky k vystřižení a procvičování:", points: 0, timeEstimateSec: 60,
        flashcards: [
          { front: "Pojem 1", back: "Vysvětlení 1" },
          { front: "Pojem 2", back: "Vysvětlení 2" },
          { front: "Pojem 3", back: "Vysvětlení 3" },
          { front: "Pojem 4", back: "Vysvětlení 4" },
        ],
        answerSpace: { type: "none", heightMm: 0 } };
    case "image_label":
      return { ...base, prompt: "Popiš očíslované části obrázku:", points: 3, timeEstimateSec: 180, difficulty: "medium",
        imageUrl: "",
        imageLabels: [
          { number: 1, xPercent: 25, yPercent: 30, answer: "Část 1" },
          { number: 2, xPercent: 70, yPercent: 30, answer: "Část 2" },
          { number: 3, xPercent: 50, yPercent: 70, answer: "Část 3" },
        ],
        answerSpace: { type: "lines", heightMm: 30, lineCount: 3 } };
    case "image_hotspot":
      return { ...base, prompt: "Odpověz na otázky k označeným bodům obrázku:", points: 3, timeEstimateSec: 240, difficulty: "medium",
        imageUrl: "",
        imageHotspots: [
          { number: 1, xPercent: 30, yPercent: 30, question: "Co je v bodě 1?" },
          { number: 2, xPercent: 70, yPercent: 60, question: "Co je v bodě 2?" },
        ],
        answerSpace: { type: "lines", heightMm: 30, lineCount: 4 } };
    case "lesson_reference":
      return { ...base, prompt: "Obsah z lekce:", points: 0, timeEstimateSec: 0,
        lessonRefBlockIds: [], lessonRefContent: "",
        answerSpace: { type: "none", heightMm: 0 } };
  }
}

export function createDefaultAnswerKey(item: WorksheetItem): AnswerKeyEntry {
  let correct: string | string[] = "";
  switch (item.type) {
    case "mcq":
      correct = item.choices?.[0] ?? "";
      break;
    case "true_false":
      correct = "true";
      break;
    case "matching":
      correct = (item.matchPairs ?? []).map((p) => `${p.left}=${p.right}`);
      break;
    case "ordering":
      correct = item.orderItems ?? [];
      break;
    default:
      correct = "";
  }
  return {
    itemId: item.id,
    itemNumber: item.itemNumber,
    correctAnswer: correct,
  };
}

export function recomputeMetadata(spec: WorksheetSpec): WorksheetSpec {
  const items = spec.variants[0]?.items ?? [];
  let totalPoints = 0;
  let totalSec = 0;
  const diff: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const typeDist: Record<string, number> = {};

  items.forEach((it, idx) => {
    it.itemNumber = idx + 1;
    totalPoints += it.points || 0;
    // Pro offline aktivity preferuj durationMin (v minutách), jinak timeEstimateSec
    if (it.type === "offline_activity" && typeof it.durationMin === "number" && it.durationMin > 0) {
      totalSec += it.durationMin * 60;
    } else {
      totalSec += it.timeEstimateSec || 0;
    }
    diff[it.difficulty] = (diff[it.difficulty] || 0) + 1;
    typeDist[it.type] = (typeDist[it.type] || 0) + 1;
  });

  return {
    ...spec,
    metadata: {
      ...spec.metadata,
      totalPoints,
      totalTimeMin: Math.round(totalSec / 60),
      difficultyDistribution: diff,
      typeDistribution: typeDist,
    },
  };
}

export const ITEM_TYPE_LABELS: Record<ItemType, { label: string; description: string }> = {
  mcq: { label: "Výběr z možností", description: "Otázka s jednou správnou volbou" },
  true_false: { label: "Pravda / Nepravda", description: "Posouzení tvrzení" },
  fill_blank: { label: "Doplňování", description: "Doplnění chybějících slov" },
  matching: { label: "Spojování", description: "Páruj položky levého a pravého sloupce" },
  ordering: { label: "Seřazení", description: "Uspořádání do správného pořadí" },
  short_answer: { label: "Krátká odpověď", description: "Pár slov nebo věta" },
  open_answer: { label: "Otevřená odpověď", description: "Delší slovní úvaha" },
  offline_activity: { label: "Offline aktivita", description: "Diskuse, skupinová práce nebo praktické cvičení" },
  section_header: { label: "Nadpis sekce", description: "Vizuální oddělení sekcí v PL" },
  write_lines: { label: "Řádky pro zápis", description: "Prázdné tečkované řádky pro ruční zápis" },
  instruction_box: { label: "Pokyn pro žáka", description: "Zvýrazněný box s instrukcí" },
  two_boxes: { label: "Dva boxy", description: "Dva boxy vedle sebe pro porovnání nebo úkoly" },
  qr_link: { label: "QR kód", description: "QR kód s odkazem na video, kvíz nebo web" },
  flow_steps: { label: "Diagram kroků", description: "Kroky propojené šipkami (postup, fáze)" },
};

export const OFFLINE_MODE_LABELS: Record<import("@/lib/worksheet-spec").OfflineMode, string> = {
  discussion: "Diskuse",
  group_work: "Skupinová práce",
  practical: "Praktická aktivita",
  observation: "Pozorování",
  reflection: "Reflexe",
};

export const GROUP_SIZE_LABELS: Record<import("@/lib/worksheet-spec").GroupSize, string> = {
  individual: "Jednotlivec",
  pair: "Dvojice",
  small_group: "Malá skupina (3–5)",
  class: "Celá třída",
};
