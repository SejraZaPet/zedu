/**
 * Druh pracovního listu (`header.worksheetMode` / sloupec `worksheet_mode`)
 * a sekce pro AI sestavení listu. Druh ≠ zaměření AI (study / technique / worksheet).
 */
export type WorksheetKind = "classwork" | "test" | "exam" | "revision" | "homework" | "project";

export const WORKSHEET_KINDS: WorksheetKind[] = ["classwork", "test", "exam", "revision", "homework", "project"];

export const WORKSHEET_KIND_LABELS: Record<WorksheetKind, string> = {
  classwork: "Pracovní list",
  test: "Test",
  exam: "Písemná práce",
  revision: "Opakování",
  homework: "Domácí úkol",
  project: "Projekt",
};

/** Barevné štítky v seznamu listů (sémantické tokeny). */
export const WORKSHEET_KIND_BADGE_CLASS: Record<WorksheetKind, string> = {
  classwork: "bg-secondary text-secondary-foreground",
  test: "bg-primary/15 text-primary",
  exam: "bg-destructive/15 text-destructive",
  revision: "bg-accent text-accent-foreground",
  homework: "bg-muted text-foreground",
  project: "bg-primary text-primary-foreground",
};

export function isWorksheetKind(v: unknown): v is WorksheetKind {
  return typeof v === "string" && (WORKSHEET_KINDS as string[]).includes(v);
}

/** Neznámé / chybějící hodnoty → Pracovní list (staré listy beze změny). */
export function normalizeWorksheetKind(v: unknown): WorksheetKind {
  return isWorksheetKind(v) ? v : "classwork";
}

export function worksheetKindLabel(v: unknown): string {
  return WORKSHEET_KIND_LABELS[normalizeWorksheetKind(v)];
}

/** Štítek nad názvem v tisku; Pracovní list žádný štítek nemá. */
export function worksheetKindPrintLabel(v: unknown): string {
  const k = normalizeWorksheetKind(v);
  return k === "classwork" ? "" : WORKSHEET_KIND_LABELS[k].toLocaleUpperCase("cs-CZ");
}

/** Název dokumentu PDF: „Test – Název“, u Pracovního listu jen název. */
export function worksheetDocumentTitle(title: string, kind: unknown, variantLabel?: string): string {
  const k = normalizeWorksheetKind(kind);
  const base = k === "classwork" ? title : `${WORKSHEET_KIND_LABELS[k]} – ${title}`;
  return variantLabel ? `${base} — ${variantLabel}` : base;
}

// ── Sekce AI sestavení ──
export type SectionQuestionType =
  | "mcq" | "true_false" | "fill_blank" | "matching" | "ordering" | "short_answer" | "open_answer";

export const SECTION_QUESTION_TYPES: SectionQuestionType[] = [
  "mcq", "true_false", "fill_blank", "matching", "ordering", "short_answer", "open_answer",
];

export const SECTION_TYPE_LABELS: Record<SectionQuestionType, string> = {
  mcq: "Výběr z možností",
  true_false: "Pravda / nepravda",
  fill_blank: "Doplňování",
  matching: "Spojování",
  ordering: "Řazení",
  short_answer: "Krátká odpověď",
  open_answer: "Otevřená odpověď",
};

export interface WorksheetSection {
  type: SectionQuestionType;
  count: number;
  pointsPerItem?: number | null;
  title?: string;
}

export type SectionPresetId = "quick_test" | "exam" | "revision" | "classwork" | "custom";

export const SECTION_PRESETS: Record<Exclude<SectionPresetId, "custom">, { label: string; kind: WorksheetKind; sections: WorksheetSection[] }> = {
  quick_test: {
    label: "Rychlý test",
    kind: "test",
    sections: [
      { type: "mcq", count: 5, pointsPerItem: 1, title: "Vyber správnou odpověď" },
      { type: "true_false", count: 5, pointsPerItem: 1, title: "Pravda, nebo nepravda?" },
    ],
  },
  exam: {
    label: "Písemka",
    kind: "exam",
    sections: [
      { type: "mcq", count: 5, pointsPerItem: 1, title: "Výběr z možností" },
      { type: "fill_blank", count: 4, pointsPerItem: 2, title: "Doplň" },
      { type: "short_answer", count: 3, pointsPerItem: 3, title: "Odpověz" },
      { type: "open_answer", count: 1, pointsPerItem: 5, title: "Rozveď" },
    ],
  },
  revision: {
    label: "Opakování",
    kind: "revision",
    sections: [
      { type: "matching", count: 2, pointsPerItem: 2, title: "Spoj" },
      { type: "ordering", count: 2, pointsPerItem: 2, title: "Seřaď" },
      { type: "fill_blank", count: 4, pointsPerItem: 1, title: "Doplň" },
    ],
  },
  classwork: {
    label: "Pracovní list",
    kind: "classwork",
    sections: [
      { type: "mcq", count: 3, pointsPerItem: 1 },
      { type: "fill_blank", count: 3, pointsPerItem: 1 },
      { type: "short_answer", count: 2, pointsPerItem: 2 },
    ],
  },
};

export function clampSectionCount(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(1, Math.min(20, v)) : 1;
}

/** Očistí sekce pro odeslání na server (typy z allowlistu, počet 1–20, body ≥ 0). */
export function sanitizeSections(sections: WorksheetSection[]): WorksheetSection[] {
  return sections
    .filter((s) => (SECTION_QUESTION_TYPES as string[]).includes(s.type))
    .map((s) => {
      const p = s.pointsPerItem;
      const points = p === null || p === undefined || (p as unknown) === "" || !Number.isFinite(Number(p))
        ? null
        : Math.max(0, Number(p));
      return { type: s.type, count: clampSectionCount(s.count), pointsPerItem: points, title: (s.title ?? "").trim() };
    });
}

export function sectionTotals(sections: WorksheetSection[]): { questions: number; points: number } {
  let questions = 0;
  let points = 0;
  for (const s of sanitizeSections(sections)) {
    questions += s.count;
    points += s.count * (s.pointsPerItem ?? 1);
  }
  return { questions, points };
}

/** Zaměření AI (není druh listu). */
export type AiFocus = "general" | "study" | "technique" | "worksheet";
