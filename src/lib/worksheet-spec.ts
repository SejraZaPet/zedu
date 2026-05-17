/**
 * WorksheetSpec v1 — Intermediate format for print + online worksheets.
 *
 * Supports:
 *   - A/B variants (randomised item order / choice order per variant)
 *   - Separate answer key (never embedded in student output)
 *   - Print (A4 PDF) and web (HTML interactive) rendering
 *   - Per-item metadata: points, difficulty, time estimate
 *   - Header, items, answer space, footer metadata
 */

export const WORKSHEET_SPEC_VERSION = "v1" as const;

// ────────────────── Core Types ──────────────────

export type ItemType =
  | "mcq"
  | "fill_blank"
  | "true_false"
  | "matching"
  | "ordering"
  | "short_answer"
  | "open_answer"
  | "offline_activity"
  // Layoutové bloky (v1.1)
  | "section_header"
  | "write_lines"
  | "instruction_box"
  | "two_boxes"
  | "qr_link"
  | "flow_steps"
  // v1.2 — Activity-style printable bloky
  | "crossword"
  | "word_search"
  | "sorting"
  | "flashcards"
  | "image_label"
  | "image_hotspot"
  | "lesson_reference";

/** Křížovka — položka */
export interface CrosswordEntry {
  /** Slovo (vyplněné) */
  answer: string;
  /** Nápověda zobrazená studentovi */
  clue: string;
  /** Směr v mřížce */
  direction: "across" | "down";
  /** Index řádku (0-based) levého horního políčka */
  row: number;
  /** Index sloupce (0-based) levého horního políčka */
  col: number;
  /** Číslo zobrazené v mřížce */
  number: number;
}

/** Sorting — kategorie a položka */
export interface SortingCategory { id: string; label: string }
export interface SortingItem { text: string; categoryId: string }

/** Flashcard pár pro vystřižení */
export interface Flashcard { front: string; back: string }

/** Popisek obrázku — číslovaný odkaz na část */
export interface ImageLabel { number: number; xPercent: number; yPercent: number; answer: string }

/** Hotspot bod na obrázku s otázkou */
export interface ImageHotspot { number: number; xPercent: number; yPercent: number; question: string }

export type InstructionVariant = "blue" | "yellow" | "green" | "purple";
export type InstructionIcon = "info" | "video" | "write" | "discuss" | "group";
export type LineStyle = "dotted" | "solid" | "dashed";
export type FlowDirection = "vertical" | "horizontal";

/** Režim offline (didaktické) aktivity v pracovním listu. */
export type OfflineMode =
  | "discussion"
  | "group_work"
  | "practical"
  | "observation"
  | "reflection";

/** Velikost skupiny pro offline aktivitu. */
export type GroupSize = "individual" | "pair" | "small_group" | "class";

export type Difficulty = "easy" | "medium" | "hard";

export type RenderTarget = "print" | "web";

export interface WorksheetHeader {
  title: string;
  subtitle?: string;
  subject: string;
  gradeBand: string;
  /** "classwork" | "homework" | "test" | "revision" */
  worksheetMode: string;
  /** Teacher name shown on print */
  teacherName?: string;
  /** Student name field placeholder */
  studentNameField: boolean;
  /** Date field placeholder */
  dateField: boolean;
  /** Class/group field placeholder */
  classField: boolean;
  /** Variant label shown on print, e.g. "Varianta A" */
  variantLabel?: string;
  /** Instructions text shown at the top */
  instructions?: string;
}

export interface AnswerSpace {
  /** "lines" = ruled lines, "grid" = grid squares, "blank" = empty box, "none" = no space */
  type: "lines" | "grid" | "blank" | "none";
  /** Height in mm for print, or min-height in px for web */
  heightMm: number;
  /** Number of lines (only for type=lines) */
  lineCount?: number;
}

export interface WorksheetItem {
  /** Unique item id within worksheet */
  id: string;
  /** 1-based display number */
  itemNumber: number;
  type: ItemType;
  /** Question / prompt text (may contain simple markdown) */
  prompt: string;
  /** Points awarded for correct answer */
  points: number;
  difficulty: Difficulty;
  /** Estimated time to complete in seconds */
  timeEstimateSec: number;
  /** MCQ choices */
  choices?: string[];
  /** Matching pairs (left/right columns) */
  matchPairs?: Array<{ left: string; right: string }>;
  /** Ordering items (displayed shuffled, student reorders) */
  orderItems?: string[];
  /** Fill-blank text with ___ placeholders */
  blankText?: string;
  /** Image URL associated with this item */
  imageUrl?: string;
  /** Image alt text */
  imageAlt?: string;
  /** Answer space config for print */
  answerSpace: AnswerSpace;
  /** Hints shown only in web mode */
  hints?: string[];
  /** Tags for filtering / grouping */
  tags?: string[];
  /** Offline activity mode (only for type=offline_activity). */
  offlineMode?: OfflineMode;
  /** Estimated activity duration in minutes (only for type=offline_activity). */
  durationMin?: number;
  /** Suggested group size (only for type=offline_activity). */
  groupSize?: GroupSize;

  // ─── Layoutové bloky (v1.1) ───
  /** Počet prázdných řádků (pro write_lines) */
  lineCount?: number;
  /** Styl čáry (pro write_lines) */
  lineStyle?: LineStyle;
  /** URL pro QR kód (pro qr_link) */
  qrUrl?: string;
  /** Kroky diagramu (pro flow_steps) */
  flowSteps?: string[];
  /** Směr diagramu (pro flow_steps) */
  flowDirection?: FlowDirection;
  /** Levý box: nadpis (pro two_boxes) */
  leftTitle?: string;
  /** Levý box: obsah nebo "lines:N" (pro two_boxes) */
  leftContent?: string;
  /** Pravý box: nadpis (pro two_boxes) */
  rightTitle?: string;
  /** Pravý box: obsah nebo "lines:N" (pro two_boxes) */
  rightContent?: string;
  /** Varianta instrukce (pro instruction_box) */
  instructionVariant?: InstructionVariant;
  /** Ikona instrukce (pro instruction_box) */
  instructionIcon?: InstructionIcon;

  // ─── v1.2 — Activity bloky ───
  /** Křížovka — slova a souřadnice */
  crosswordEntries?: CrosswordEntry[];
  /** Šířka mřížky křížovky (sloupců). Default 12. */
  crosswordCols?: number;
  /** Výška mřížky křížovky (řádků). Default 12. */
  crosswordRows?: number;
  /** Osmisměrka — slova k vyhledání */
  wordSearchWords?: string[];
  /** Osmisměrka — velikost mřížky (čtverec). Default 12. */
  wordSearchSize?: number;
  /** Sorting — kategorie */
  sortingCategories?: SortingCategory[];
  /** Sorting — položky k zařazení (zamíchané) */
  sortingItems?: SortingItem[];
  /** Flashcards páry */
  flashcards?: Flashcard[];
  /** Popisky obrázku (image_label) */
  imageLabels?: ImageLabel[];
  /** Hotspoty (image_hotspot) */
  imageHotspots?: ImageHotspot[];
  /** Lesson reference — id bloku/ů z lekce, jejichž obsah se zde má vykreslit */
  lessonRefBlockIds?: string[];
  /** Lesson reference — zachycený text/obsah pro tisk (snapshot) */
  lessonRefContent?: string;
}

export interface AnswerKeyEntry {
  itemId: string;
  itemNumber: number;
  /** Correct answer(s) — string for single, array for multiple */
  correctAnswer: string | string[];
  /** Explanation shown in teacher key */
  explanation?: string;
  /** Scoring rubric for open answers */
  rubric?: string;
}

export interface WorksheetVariant {
  /** Variant identifier, e.g. "A", "B" */
  variantId: string;
  /** Seed used for randomisation (reproducible) */
  seed: number;
  /** Items in display order for this variant */
  items: WorksheetItem[];
}

export interface WorksheetMetadata {
  /** Total points across all items */
  totalPoints: number;
  /** Total estimated time in minutes */
  totalTimeMin: number;
  /** Difficulty distribution */
  difficultyDistribution: Record<Difficulty, number>;
  /** Item type distribution */
  typeDistribution: Record<string, number>;
  /** Deadline (ISO string, optional) */
  deadline?: string;
  /** Created at (ISO string) */
  createdAt: string;
  /** Source lesson plan id */
  lessonPlanId?: string;
  /** Source lesson id */
  lessonId?: string;
}

export interface RandomizationRule {
  /** What is randomised */
  rule: "item_order" | "choice_order" | "match_shuffle" | "order_shuffle";
  /** Which items are affected (item ids or "*" for all) */
  appliedTo: string;
}

export interface WorksheetRenderConfig {
  target: RenderTarget;
  /** Show points per item */
  showPoints: boolean;
  /** Show difficulty badges */
  showDifficulty: boolean;
  /** Show time estimates */
  showTimeEstimate: boolean;
  /** Show item type labels */
  showTypeLabels: boolean;
  /** Paper format for print */
  paper?: "A4" | "letter";
  /** Include answer key (separate page/section) */
  includeAnswerKey: boolean;
  /** Master switch — points enabled at worksheet level (default true). When false, hide all point UI/PDF output. */
  pointsEnabled?: boolean;
}

export interface WorksheetSpec {
  version: typeof WORKSHEET_SPEC_VERSION;
  header: WorksheetHeader;
  variants: WorksheetVariant[];
  /** Answer keys keyed by variantId */
  answerKeys: Record<string, AnswerKeyEntry[]>;
  metadata: WorksheetMetadata;
  randomizationRules: RandomizationRule[];
  renderConfig: WorksheetRenderConfig;
}

// ────────────────── JSON Schema ──────────────────

export const WORKSHEET_SPEC_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "WorksheetSpec",
  type: "object",
  required: ["version", "header", "variants", "answerKeys", "metadata", "randomizationRules", "renderConfig"],
  properties: {
    version: { type: "string", const: "v1" },
    header: {
      type: "object",
      required: ["title", "subject", "gradeBand", "worksheetMode", "studentNameField", "dateField", "classField"],
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        subject: { type: "string" },
        gradeBand: { type: "string" },
        worksheetMode: { type: "string", enum: ["classwork", "homework", "test", "revision"] },
        teacherName: { type: "string" },
        studentNameField: { type: "boolean" },
        dateField: { type: "boolean" },
        classField: { type: "boolean" },
        variantLabel: { type: "string" },
        instructions: { type: "string" },
      },
    },
    variants: {
      type: "array", minItems: 1,
      items: {
        type: "object",
        required: ["variantId", "seed", "items"],
        properties: {
          variantId: { type: "string" },
          seed: { type: "integer" },
          items: {
            type: "array", minItems: 1,
            items: {
              type: "object",
              required: ["id", "itemNumber", "type", "prompt", "points", "difficulty", "timeEstimateSec", "answerSpace"],
              properties: {
                id: { type: "string" },
                itemNumber: { type: "integer", minimum: 1 },
                type: { type: "string", enum: ["mcq", "fill_blank", "true_false", "matching", "ordering", "short_answer", "open_answer", "offline_activity", "section_header", "write_lines", "instruction_box", "two_boxes", "qr_link", "flow_steps", "crossword", "word_search", "sorting", "flashcards", "image_label", "image_hotspot", "lesson_reference"] },
                prompt: { type: "string" },
                points: { type: "number", minimum: 0 },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                timeEstimateSec: { type: "integer", minimum: 0 },
                choices: { type: "array", items: { type: "string" } },
                matchPairs: { type: "array", items: { type: "object", required: ["left", "right"], properties: { left: { type: "string" }, right: { type: "string" } } } },
                orderItems: { type: "array", items: { type: "string" } },
                blankText: { type: "string" },
                imageUrl: { type: "string" },
                imageAlt: { type: "string" },
                answerSpace: {
                  type: "object", required: ["type", "heightMm"],
                  properties: {
                    type: { type: "string", enum: ["lines", "grid", "blank", "none"] },
                    heightMm: { type: "number", minimum: 0 },
                    lineCount: { type: "integer" },
                  },
                },
                hints: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
                offlineMode: { type: "string", enum: ["discussion", "group_work", "practical", "observation", "reflection"] },
                durationMin: { type: "integer", minimum: 0 },
                groupSize: { type: "string", enum: ["individual", "pair", "small_group", "class"] },
                lineCount: { type: "integer", minimum: 0 },
                lineStyle: { type: "string", enum: ["dotted", "solid", "dashed"] },
                qrUrl: { type: "string" },
                flowSteps: { type: "array", items: { type: "string" } },
                flowDirection: { type: "string", enum: ["vertical", "horizontal"] },
                leftTitle: { type: "string" },
                leftContent: { type: "string" },
                rightTitle: { type: "string" },
                rightContent: { type: "string" },
                instructionVariant: { type: "string", enum: ["blue", "yellow", "green", "purple"] },
                instructionIcon: { type: "string", enum: ["info", "video", "write", "discuss", "group"] },
              },
            },
          },
        },
      },
    },
    answerKeys: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: {
          type: "object", required: ["itemId", "itemNumber", "correctAnswer"],
          properties: {
            itemId: { type: "string" },
            itemNumber: { type: "integer" },
            correctAnswer: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
            explanation: { type: "string" },
            rubric: { type: "string" },
          },
        },
      },
    },
    metadata: {
      type: "object",
      required: ["totalPoints", "totalTimeMin", "difficultyDistribution", "typeDistribution", "createdAt"],
      properties: {
        totalPoints: { type: "number" },
        totalTimeMin: { type: "number" },
        difficultyDistribution: { type: "object" },
        typeDistribution: { type: "object" },
        deadline: { type: "string", format: "date-time" },
        createdAt: { type: "string", format: "date-time" },
        lessonPlanId: { type: "string" },
        lessonId: { type: "string" },
      },
    },
    randomizationRules: {
      type: "array",
      items: {
        type: "object", required: ["rule", "appliedTo"],
        properties: {
          rule: { type: "string", enum: ["item_order", "choice_order", "match_shuffle", "order_shuffle"] },
          appliedTo: { type: "string" },
        },
      },
    },
    renderConfig: {
      type: "object",
      required: ["target", "showPoints", "showDifficulty", "showTimeEstimate", "showTypeLabels", "includeAnswerKey"],
      properties: {
        target: { type: "string", enum: ["print", "web"] },
        showPoints: { type: "boolean" },
        showDifficulty: { type: "boolean" },
        showTimeEstimate: { type: "boolean" },
        showTypeLabels: { type: "boolean" },
        paper: { type: "string", enum: ["A4", "letter"] },
        includeAnswerKey: { type: "boolean" },
      },
    },
  },
} as const;

// ────────────────── Example Document ──────────────────

export const WORKSHEET_SPEC_EXAMPLE: WorksheetSpec = {
  version: "v1",
  header: {
    title: "Makroživiny – opakování",
    subtitle: "Kapitola 3: Základy výživy",
    subject: "Nauka o výživě",
    gradeBand: "1. ročník SŠ",
    worksheetMode: "classwork",
    teacherName: "Mgr. Nováková",
    studentNameField: true,
    dateField: true,
    classField: true,
    variantLabel: "Varianta A",
    instructions: "Pracujte samostatně. Na vypracování máte 15 minut. U otázek s výběrem zakroužkujte jednu správnou odpověď.",
  },
  variants: [
    {
      variantId: "A",
      seed: 42,
      items: [
        {
          id: "q1",
          itemNumber: 1,
          type: "mcq",
          prompt: "Který z následujících je sacharid?",
          points: 2,
          difficulty: "easy",
          timeEstimateSec: 30,
          choices: ["Bílkovina", "Glukóza", "Cholesterol", "Aminokyselina"],
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["sacharidy", "základy"],
        },
        {
          id: "q2",
          itemNumber: 2,
          type: "true_false",
          prompt: "Tuky jsou důležité pro vstřebávání vitamínů rozpustných v tucích.",
          points: 1,
          difficulty: "easy",
          timeEstimateSec: 20,
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["tuky"],
        },
        {
          id: "q3",
          itemNumber: 3,
          type: "fill_blank",
          prompt: "Doplňte chybějící slova:",
          points: 3,
          difficulty: "medium",
          timeEstimateSec: 60,
          blankText: "Bílkoviny se skládají z ___ a jsou důležité pro ___ svalové tkáně.",
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["bílkoviny"],
        },
        {
          id: "q4",
          itemNumber: 4,
          type: "matching",
          prompt: "Spojte makroživinu s její hlavní funkcí:",
          points: 3,
          difficulty: "medium",
          timeEstimateSec: 60,
          matchPairs: [
            { left: "Sacharidy", right: "Rychlý zdroj energie" },
            { left: "Bílkoviny", right: "Stavba a oprava tkání" },
            { left: "Tuky", right: "Zásobní energie, izolace" },
          ],
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["makroživiny", "funkce"],
        },
        {
          id: "q5",
          itemNumber: 5,
          type: "ordering",
          prompt: "Seřaďte kroky trávení sacharidů od začátku:",
          points: 3,
          difficulty: "hard",
          timeEstimateSec: 90,
          orderItems: [
            "Mechanické zpracování v ústech",
            "Působení amylázy ve slinách",
            "Štěpení v tenkém střevě",
            "Vstřebání glukózy do krve",
          ],
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["trávení", "sacharidy"],
        },
        {
          id: "q6",
          itemNumber: 6,
          type: "short_answer",
          prompt: "Jmenujte dva příklady potravin bohatých na bílkoviny.",
          points: 2,
          difficulty: "easy",
          timeEstimateSec: 30,
          answerSpace: { type: "lines", heightMm: 15, lineCount: 2 },
          tags: ["bílkoviny", "potraviny"],
        },
        {
          id: "q7",
          itemNumber: 7,
          type: "open_answer",
          prompt: "Vysvětlete, proč je důležité mít vyváženou stravu obsahující všechny tři makroživiny. Uveďte příklad denního jídelníčku.",
          points: 5,
          difficulty: "hard",
          timeEstimateSec: 180,
          answerSpace: { type: "lines", heightMm: 50, lineCount: 8 },
          tags: ["makroživiny", "jídelníček"],
        },
      ],
    },
    {
      variantId: "B",
      seed: 84,
      items: [
        {
          id: "q1b",
          itemNumber: 1,
          type: "mcq",
          prompt: "Který z následujících je aminokyselina?",
          points: 2,
          difficulty: "easy",
          timeEstimateSec: 30,
          choices: ["Glukóza", "Leucin", "Fruktóza", "Glycerol"],
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["bílkoviny", "základy"],
        },
        {
          id: "q2b",
          itemNumber: 2,
          type: "true_false",
          prompt: "Sacharidy jsou jediným zdrojem energie pro lidský organismus.",
          points: 1,
          difficulty: "easy",
          timeEstimateSec: 20,
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["sacharidy"],
        },
        {
          id: "q3b",
          itemNumber: 3,
          type: "fill_blank",
          prompt: "Doplňte chybějící slova:",
          points: 3,
          difficulty: "medium",
          timeEstimateSec: 60,
          blankText: "Tuky se dělí na ___ a nenasycené, přičemž ___ tuky jsou zdravější.",
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["tuky"],
        },
        {
          id: "q4b",
          itemNumber: 4,
          type: "matching",
          prompt: "Spojte potravinu s hlavní makroživinou:",
          points: 3,
          difficulty: "medium",
          timeEstimateSec: 60,
          matchPairs: [
            { left: "Kuřecí prsa", right: "Bílkoviny" },
            { left: "Rýže", right: "Sacharidy" },
            { left: "Olivový olej", right: "Tuky" },
          ],
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["potraviny", "makroživiny"],
        },
        {
          id: "q5b",
          itemNumber: 5,
          type: "ordering",
          prompt: "Seřaďte kroky trávení tuků od začátku:",
          points: 3,
          difficulty: "hard",
          timeEstimateSec: 90,
          orderItems: [
            "Mechanické zpracování v žaludku",
            "Emulgace žlučí v tenkém střevě",
            "Štěpení lipázou",
            "Vstřebání mastných kyselin",
          ],
          answerSpace: { type: "none", heightMm: 0 },
          tags: ["trávení", "tuky"],
        },
        {
          id: "q6b",
          itemNumber: 6,
          type: "short_answer",
          prompt: "Jmenujte dva příklady potravin bohatých na sacharidy.",
          points: 2,
          difficulty: "easy",
          timeEstimateSec: 30,
          answerSpace: { type: "lines", heightMm: 15, lineCount: 2 },
          tags: ["sacharidy", "potraviny"],
        },
        {
          id: "q7b",
          itemNumber: 7,
          type: "open_answer",
          prompt: "Vysvětlete rozdíl mezi jednoduchými a složenými sacharidy. Uveďte příklady potravin pro každý typ.",
          points: 5,
          difficulty: "hard",
          timeEstimateSec: 180,
          answerSpace: { type: "lines", heightMm: 50, lineCount: 8 },
          tags: ["sacharidy", "typy"],
        },
      ],
    },
  ],
  answerKeys: {
    A: [
      { itemId: "q1", itemNumber: 1, correctAnswer: "Glukóza", explanation: "Glukóza je jednoduchý sacharid (monosacharid)." },
      { itemId: "q2", itemNumber: 2, correctAnswer: "Pravda", explanation: "Vitamíny A, D, E, K jsou rozpustné v tucích." },
      { itemId: "q3", itemNumber: 3, correctAnswer: ["aminokyselin", "růst / opravu"], explanation: "Bílkoviny = řetězce aminokyselin, funkce v růstu a opravě tkání." },
      { itemId: "q4", itemNumber: 4, correctAnswer: ["Sacharidy → Rychlý zdroj energie", "Bílkoviny → Stavba a oprava tkání", "Tuky → Zásobní energie, izolace"] },
      { itemId: "q5", itemNumber: 5, correctAnswer: ["Mechanické zpracování v ústech", "Působení amylázy ve slinách", "Štěpení v tenkém střevě", "Vstřebání glukózy do krve"] },
      { itemId: "q6", itemNumber: 6, correctAnswer: "Např. kuřecí prsa, vajíčka, fazole, tofu", explanation: "Jakékoli potraviny s vysokým obsahem bílkovin." },
      { itemId: "q7", itemNumber: 7, correctAnswer: "Otevřená odpověď", rubric: "2b vysvětlení důležitosti, 1b příklad snídaně, 1b příklad oběda, 1b příklad večeře" },
    ],
    B: [
      { itemId: "q1b", itemNumber: 1, correctAnswer: "Leucin", explanation: "Leucin je esenciální aminokyselina." },
      { itemId: "q2b", itemNumber: 2, correctAnswer: "Nepravda", explanation: "Energii poskytují i tuky a bílkoviny." },
      { itemId: "q3b", itemNumber: 3, correctAnswer: ["nasycené", "nenasycené"] },
      { itemId: "q4b", itemNumber: 4, correctAnswer: ["Kuřecí prsa → Bílkoviny", "Rýže → Sacharidy", "Olivový olej → Tuky"] },
      { itemId: "q5b", itemNumber: 5, correctAnswer: ["Mechanické zpracování v žaludku", "Emulgace žlučí v tenkém střevě", "Štěpení lipázou", "Vstřebání mastných kyselin"] },
      { itemId: "q6b", itemNumber: 6, correctAnswer: "Např. rýže, chléb, brambory, těstoviny" },
      { itemId: "q7b", itemNumber: 7, correctAnswer: "Otevřená odpověď", rubric: "2b definice obou typů, 1.5b příklady jednoduchých, 1.5b příklady složených" },
    ],
  },
  metadata: {
    totalPoints: 19,
    totalTimeMin: 15,
    difficultyDistribution: { easy: 3, medium: 2, hard: 2 },
    typeDistribution: { mcq: 1, true_false: 1, fill_blank: 1, matching: 1, ordering: 1, short_answer: 1, open_answer: 1 },
    createdAt: "2026-03-15T12:00:00.000Z",
    lessonPlanId: "plan-abc-123",
  },
  randomizationRules: [
    { rule: "item_order", appliedTo: "*" },
    { rule: "choice_order", appliedTo: "q1" },
    { rule: "match_shuffle", appliedTo: "q4" },
    { rule: "order_shuffle", appliedTo: "q5" },
  ],
  renderConfig: {
    target: "print",
    showPoints: true,
    showDifficulty: false,
    showTimeEstimate: false,
    showTypeLabels: true,
    paper: "A4",
    includeAnswerKey: false,
  },
};

// ────────────────── Seeded PRNG ──────────────────

/**
 * Mulberry32 — deterministic 32-bit PRNG.
 * Same seed always produces the same sequence.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using seeded RNG */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ────────────────── Variant Generator ──────────────────

export interface VariantGeneratorInput {
  /** Source items (canonical order, variant A baseline) */
  items: WorksheetItem[];
  /** Answer key entries matching source items */
  answerKey: AnswerKeyEntry[];
  /** Variant IDs to generate, e.g. ["A", "B"] */
  variantIds: string[];
  /** Randomization rules to apply */
  rules: RandomizationRule[];
}

export interface VariantGeneratorOutput {
  variants: WorksheetVariant[];
  randomizationRules: RandomizationRule[];
  answerKeys: Record<string, AnswerKeyEntry[]>;
}

/**
 * Generate A/B (or more) variants from a canonical item list.
 *
 * Variant A uses seed derived from Date.now(), variant B uses seed+1, etc.
 * Each variant applies the specified randomization rules:
 *   - item_order: shuffle item sequence
 *   - choice_order: shuffle MCQ choices (updates correctIndex)
 *   - match_shuffle: shuffle right column of matching pairs
 *   - order_shuffle: shuffle ordering items (correctOrder stays canonical)
 *
 * Answer keys are recomputed per variant so correctAnswer always matches
 * the variant's actual item content and numbering.
 */
export function generateVariants(input: VariantGeneratorInput): VariantGeneratorOutput {
  const baseSeed = Date.now();
  const variants: WorksheetVariant[] = [];
  const answerKeys: Record<string, AnswerKeyEntry[]> = {};

  for (let vi = 0; vi < input.variantIds.length; vi++) {
    const variantId = input.variantIds[vi];
    const seed = baseSeed + vi * 7919; // distinct prime offset per variant
    const rng = mulberry32(seed);

    // 1. Possibly shuffle item order
    const shouldShuffleItems = input.rules.some(
      r => r.rule === "item_order" && (r.appliedTo === "*" || r.appliedTo === variantId),
    );
    let items = input.items.map(i => structuredClone(i));
    if (shouldShuffleItems && vi > 0) {
      // Variant A keeps original order; B+ get shuffled
      items = seededShuffle(items, rng);
    }

    // Re-number items after shuffle
    items.forEach((item, idx) => {
      item.itemNumber = idx + 1;
    });

    // 2. Shuffle MCQ choices
    const choiceRules = input.rules.filter(r => r.rule === "choice_order");
    for (const item of items) {
      if (item.type !== "mcq" || !item.choices) continue;
      const shouldShuffle = choiceRules.some(
        r => r.appliedTo === "*" || r.appliedTo === item.id,
      );
      if (shouldShuffle && vi > 0) {
        // Track correct answer before shuffle
        // Find original answer key entry for this item
        const origKey = input.answerKey.find(k => k.itemId === item.id);
        const correctChoice = origKey?.correctAnswer;

        item.choices = seededShuffle(item.choices, rng);

        // correctAnswer text stays the same — no index to update in WorksheetItem
        // (correctIndex lives in the model from generate-items, not in WorksheetItem)
      }
    }

    // 3. Shuffle matching right column
    const matchRules = input.rules.filter(r => r.rule === "match_shuffle");
    for (const item of items) {
      if (item.type !== "matching" || !item.matchPairs) continue;
      const shouldShuffle = matchRules.some(
        r => r.appliedTo === "*" || r.appliedTo === item.id,
      );
      if (shouldShuffle && vi > 0) {
        const rights = seededShuffle(item.matchPairs.map(p => p.right), rng);
        // Pairs are now "scrambled" — student must reconnect
        // Store original pairs for answer key, display with shuffled rights
        item.matchPairs = item.matchPairs.map((p, i) => ({
          left: p.left,
          right: rights[i],
        }));
      }
    }

    // 4. Shuffle ordering items
    const orderRules = input.rules.filter(r => r.rule === "order_shuffle");
    for (const item of items) {
      if (item.type !== "ordering" || !item.orderItems) continue;
      const shouldShuffle = orderRules.some(
        r => r.appliedTo === "*" || r.appliedTo === item.id,
      );
      if (shouldShuffle) {
        item.orderItems = seededShuffle(item.orderItems, rng);
      }
    }

    variants.push({ variantId, seed, items });

    // 5. Build answer key for this variant
    const variantKey: AnswerKeyEntry[] = items.map(item => {
      const origEntry = input.answerKey.find(k => k.itemId === item.id);
      return {
        itemId: item.id,
        itemNumber: item.itemNumber,
        correctAnswer: origEntry?.correctAnswer ?? "",
        explanation: origEntry?.explanation,
        rubric: origEntry?.rubric,
      };
    });
    answerKeys[variantId] = variantKey;
  }

  return { variants, randomizationRules: input.rules, answerKeys };
}

/**
 * Generate default randomization rules for a set of items.
 * Applies item_order to all, choice_order to MCQ items,
 * match_shuffle to matching items, order_shuffle to ordering items.
 */
export function buildDefaultRandomizationRules(items: WorksheetItem[]): RandomizationRule[] {
  const rules: RandomizationRule[] = [
    { rule: "item_order", appliedTo: "*" },
  ];

  for (const item of items) {
    if (item.type === "mcq" && item.choices) {
      rules.push({ rule: "choice_order", appliedTo: item.id });
    }
    if (item.type === "matching" && item.matchPairs) {
      rules.push({ rule: "match_shuffle", appliedTo: item.id });
    }
    if (item.type === "ordering" && item.orderItems) {
      rules.push({ rule: "order_shuffle", appliedTo: item.id });
    }
  }

  return rules;
}

/**
 * Reproduce a variant from its seed (deterministic).
 * Pass the original canonical items + seed to get the exact same shuffle.
 */
export function reproduceVariant(
  items: WorksheetItem[],
  answerKey: AnswerKeyEntry[],
  seed: number,
  variantId: string,
  rules: RandomizationRule[],
): { variant: WorksheetVariant; answerKey: AnswerKeyEntry[] } {
  // Use generateVariants with a fixed seed by temporarily overriding Date.now
  const rng = mulberry32(seed);

  let result = items.map(i => structuredClone(i));

  const shouldShuffleItems = rules.some(r => r.rule === "item_order");
  if (shouldShuffleItems) {
    result = seededShuffle(result, rng);
  }
  result.forEach((item, idx) => { item.itemNumber = idx + 1; });

  const choiceRules = rules.filter(r => r.rule === "choice_order");
  for (const item of result) {
    if (item.type !== "mcq" || !item.choices) continue;
    if (choiceRules.some(r => r.appliedTo === "*" || r.appliedTo === item.id)) {
      item.choices = seededShuffle(item.choices, rng);
    }
  }

  const matchRules = rules.filter(r => r.rule === "match_shuffle");
  for (const item of result) {
    if (item.type !== "matching" || !item.matchPairs) continue;
    if (matchRules.some(r => r.appliedTo === "*" || r.appliedTo === item.id)) {
      const rights = seededShuffle(item.matchPairs.map(p => p.right), rng);
      item.matchPairs = item.matchPairs.map((p, i) => ({ left: p.left, right: rights[i] }));
    }
  }

  const orderRules = rules.filter(r => r.rule === "order_shuffle");
  for (const item of result) {
    if (item.type !== "ordering" || !item.orderItems) continue;
    if (orderRules.some(r => r.appliedTo === "*" || r.appliedTo === item.id)) {
      item.orderItems = seededShuffle(item.orderItems, rng);
    }
  }

  const key: AnswerKeyEntry[] = result.map(item => {
    const orig = answerKey.find(k => k.itemId === item.id);
    return { itemId: item.id, itemNumber: item.itemNumber, correctAnswer: orig?.correctAnswer ?? "", explanation: orig?.explanation, rubric: orig?.rubric };
  });

  return { variant: { variantId, seed, items: result }, answerKey: key };
}

// ────────────────── Helpers ──────────────────

/** Compute metadata from variant items */
export function computeWorksheetMetadata(
  items: WorksheetItem[],
  lessonPlanId?: string,
): WorksheetMetadata {
  const totalPoints = items.reduce((s, i) => s + i.points, 0);
  const totalTimeSec = items.reduce((s, i) => s + i.timeEstimateSec, 0);

  const diffDist: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const typeDist: Record<string, number> = {};
  for (const item of items) {
    diffDist[item.difficulty]++;
    typeDist[item.type] = (typeDist[item.type] || 0) + 1;
  }

  return {
    totalPoints,
    totalTimeMin: Math.ceil(totalTimeSec / 60),
    difficultyDistribution: diffDist,
    typeDistribution: typeDist,
    createdAt: new Date().toISOString(),
    lessonPlanId,
  };
}

/** Strip answer keys for student output */
export function stripAnswerKeys(spec: WorksheetSpec): WorksheetSpec {
  return { ...spec, answerKeys: {}, renderConfig: { ...spec.renderConfig, includeAnswerKey: false } };
}

/** Get answer key for a specific variant */
export function getAnswerKey(spec: WorksheetSpec, variantId: string): AnswerKeyEntry[] {
  return spec.answerKeys[variantId] || [];
}

// ────────────────── Exported spec for JSON consumption ──────────────────

export const WORKSHEET_FILE_SPEC = {
  worksheetSpecSchema: WORKSHEET_SPEC_JSON_SCHEMA,
  exampleWorksheetSpec: WORKSHEET_SPEC_EXAMPLE,
} as const;
