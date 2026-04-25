/**
 * Didaktické šablony pro pracovní listy.
 * Vrací sadu nových WorksheetItem + odpovídajících AnswerKeyEntry,
 * které lze přidat na konec pracovního listu.
 *
 * "Section heading" bloky jsou implementované jako open_answer
 * s tagem "section_heading" a prázdným answerSpace.
 */

import type {
  WorksheetItem,
  AnswerKeyEntry,
  ItemType,
} from "./worksheet-spec";

export type WorksheetTemplateId = "petilist" | "insert" | "eur";

export interface WorksheetTemplate {
  id: WorksheetTemplateId;
  label: string;
  description: string;
  /** počet vložených bloků (informativní) */
  blockCount: number;
}

export const WORKSHEET_TEMPLATES: WorksheetTemplate[] = [
  {
    id: "petilist",
    label: "Pětilístek",
    description: "5 řádků: podst. jméno, příd. jména, slovesa, věta, synonymum",
    blockCount: 6,
  },
  {
    id: "insert",
    label: "INSERT (kritické čtení)",
    description: "Značky ✓ + ? − a 4 sloupce poznámek",
    blockCount: 6,
  },
  {
    id: "eur",
    label: "EUR (Evokace–Uvědomění–Reflexe)",
    description: "Třífázový model s otázkou v každé fázi",
    blockCount: 6,
  },
];

// ─────────── helpers ───────────

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeItem(
  type: ItemType,
  itemNumber: number,
  prompt: string,
  opts?: Partial<WorksheetItem>,
): WorksheetItem {
  return {
    id: uid("itm"),
    itemNumber,
    type,
    prompt,
    points: opts?.points ?? (type === "open_answer" ? 0 : 1),
    difficulty: opts?.difficulty ?? "easy",
    timeEstimateSec: opts?.timeEstimateSec ?? 60,
    answerSpace:
      opts?.answerSpace ??
      (type === "short_answer"
        ? { type: "lines", heightMm: 14, lineCount: 1 }
        : type === "open_answer"
          ? { type: "lines", heightMm: 30, lineCount: 4 }
          : { type: "none", heightMm: 0 }),
    ...opts,
  };
}

function sectionHeading(itemNumber: number, title: string): WorksheetItem {
  return makeItem("open_answer", itemNumber, title, {
    points: 0,
    timeEstimateSec: 0,
    tags: ["section_heading"],
    answerSpace: { type: "none", heightMm: 0 },
  });
}

function makeKey(
  item: WorksheetItem,
  rubric?: string,
): AnswerKeyEntry {
  return {
    itemId: item.id,
    itemNumber: item.itemNumber,
    correctAnswer: "",
    rubric,
  };
}

// ─────────── jednotlivé šablony ───────────

function buildPetilist(startNumber: number): {
  items: WorksheetItem[];
  keys: AnswerKeyEntry[];
} {
  const items: WorksheetItem[] = [];
  let n = startNumber;

  items.push(sectionHeading(n++, "Pětilístek na téma…"));

  const rows: Array<{ prompt: string; lines: number }> = [
    { prompt: "1 podstatné jméno (téma)", lines: 1 },
    { prompt: "2 přídavná jména popisující téma", lines: 1 },
    { prompt: "3 slovesa vyjadřující děj kolem tématu", lines: 1 },
    { prompt: "Věta o 4 slovech vystihující téma", lines: 1 },
    { prompt: "1 synonymum nebo metafora pro téma", lines: 1 },
  ];
  for (const r of rows) {
    items.push(
      makeItem("short_answer", n++, r.prompt, {
        answerSpace: { type: "lines", heightMm: 14, lineCount: r.lines },
        difficulty: "easy",
      }),
    );
  }

  const keys = items.map((it) =>
    makeKey(
      it,
      it.tags?.includes("section_heading")
        ? undefined
        : "Hodnotí se kreativita a relevance k tématu.",
    ),
  );
  return { items, keys };
}

function buildInsert(startNumber: number): {
  items: WorksheetItem[];
  keys: AnswerKeyEntry[];
} {
  const items: WorksheetItem[] = [];
  let n = startNumber;

  items.push(sectionHeading(n++, "INSERT – kritické čtení textu"));

  items.push(
    makeItem(
      "open_answer",
      n++,
      "Při čtení textu si do textu značte: ✓ známé · + nové · ? nejasné · − v rozporu s tím, co znám.",
      {
        points: 0,
        timeEstimateSec: 0,
        tags: ["instruction"],
        answerSpace: { type: "none", heightMm: 0 },
        difficulty: "easy",
      },
    ),
  );

  const cols: Array<{ title: string; lines: number }> = [
    { title: "✓ Co už jsem věděl(a)", lines: 5 },
    { title: "+ Co je pro mě nové", lines: 5 },
    { title: "? Co mi není jasné / nad čím přemýšlím", lines: 5 },
    { title: "− S čím nesouhlasím / co je v rozporu", lines: 5 },
  ];
  for (const c of cols) {
    items.push(
      makeItem("short_answer", n++, c.title, {
        answerSpace: { type: "lines", heightMm: c.lines * 7, lineCount: c.lines },
        difficulty: "medium",
        timeEstimateSec: 180,
      }),
    );
  }

  const keys = items.map((it) =>
    makeKey(
      it,
      it.tags?.includes("section_heading") || it.tags?.includes("instruction")
        ? undefined
        : "Hodnotí se hloubka reflexe a osobní zaujetí k textu.",
    ),
  );
  return { items, keys };
}

function buildEur(startNumber: number): {
  items: WorksheetItem[];
  keys: AnswerKeyEntry[];
} {
  const items: WorksheetItem[] = [];
  let n = startNumber;

  const phases: Array<{ heading: string; question: string; rubric: string }> = [
    {
      heading: "1. Evokace",
      question:
        "Co už o tématu víš? Napiš vše, co tě k tématu napadá – své zkušenosti, dojmy, otázky.",
      rubric: "Hodnotí se aktivace předchozích znalostí a osobní vztah k tématu.",
    },
    {
      heading: "2. Uvědomění (si nového)",
      question:
        "Co nového ses dozvěděl(a)? Co tě překvapilo? Která informace byla pro tebe klíčová?",
      rubric: "Hodnotí se schopnost identifikovat nové poznatky a vztáhnout je k předchozímu.",
    },
    {
      heading: "3. Reflexe",
      question:
        "K čemu mi to bude? Jak nové informace mění můj pohled na téma? Co bych chtěl(a) ještě zjistit?",
      rubric: "Hodnotí se metakognitivní reflexe a propojení s vlastním životem či dalším učením.",
    },
  ];

  for (const p of phases) {
    items.push(sectionHeading(n++, p.heading));
    items.push(
      makeItem("open_answer", n++, p.question, {
        answerSpace: { type: "lines", heightMm: 35, lineCount: 5 },
        difficulty: "medium",
        timeEstimateSec: 240,
      }),
    );
  }

  const keys = items.map((it, idx) =>
    makeKey(
      it,
      it.tags?.includes("section_heading")
        ? undefined
        : phases[Math.floor(idx / 2)]?.rubric,
    ),
  );
  return { items, keys };
}

// ─────────── public API ───────────

export function buildTemplate(
  id: WorksheetTemplateId,
  startNumber: number,
): { items: WorksheetItem[]; keys: AnswerKeyEntry[] } {
  switch (id) {
    case "petilist":
      return buildPetilist(startNumber);
    case "insert":
      return buildInsert(startNumber);
    case "eur":
      return buildEur(startNumber);
  }
}
