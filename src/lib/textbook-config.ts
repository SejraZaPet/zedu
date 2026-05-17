export const SUBJECTS = [
  { id: "technologie", label: "Technologie", grades: [1, 2, 3] },
  { id: "potraviny", label: "Potraviny", grades: [1, 2, 3] },
  { id: "svetova_gastronomie", label: "Světová gastronomie", grades: [1] },
  { id: "nauka_o_vyzive", label: "Nauka o výživě", grades: [1] },
] as const;

export type SubjectId = typeof SUBJECTS[number]["id"];

export const getSubject = (id: string) => SUBJECTS.find((s) => s.id === id);
export const getGradesForSubject = (id: string): number[] => [...(getSubject(id)?.grades ?? [])];

export type BlockType =
  | "heading"
  | "paragraph"
  | "bullet_list"
  | "image"
  | "image_text"
  | "card_grid"
  | "table"
  | "accordion"
  | "quote"
  | "lesson_link"
  | "youtube"
  | "callout"
  | "divider"
  | "two_column"
  | "gallery"
  | "summary"
  | "activity";

export interface Block {
  id: string;
  type: BlockType;
  visible: boolean;
  props: Record<string, any>;
}

export const normalizeBlocks = (blocks: Block[] | null | undefined): Block[] => {
  if (!Array.isArray(blocks)) return [];

  const seen = new Set<string>();
  let changed = false;

  const normalized = blocks.map((block) => {
    const nextId = typeof block?.id === "string" && block.id.trim() ? block.id : crypto.randomUUID();
    const hasDuplicate = seen.has(nextId);
    const finalId = hasDuplicate ? crypto.randomUUID() : nextId;

    seen.add(finalId);

    const nextBlock: Block = {
      id: finalId,
      type: block?.type,
      visible: typeof block?.visible === "boolean" ? block.visible : true,
      props: block?.props && typeof block.props === "object" ? block.props : {},
    } as Block;

    if (
      finalId !== block?.id ||
      nextBlock.visible !== block?.visible ||
      nextBlock.props !== block?.props
    ) {
      changed = true;
    }

    return nextBlock;
  });

  return changed ? normalized : blocks;
};

export const BLOCK_TYPES: { type: BlockType; label: string; icon: string }[] = [
  { type: "heading", label: "Nadpis", icon: "H" },
  { type: "paragraph", label: "Text", icon: "¶" },
  { type: "bullet_list", label: "Odrážky", icon: "•" },
  { type: "image", label: "Obrázek", icon: "🖼" },
  { type: "image_text", label: "Obrázek + text", icon: "⬒" },
  { type: "card_grid", label: "Karty/Grid", icon: "▦" },
  { type: "table", label: "Tabulka", icon: "▤" },
  { type: "accordion", label: "Akordeon", icon: "▼" },
  { type: "quote", label: "Citace", icon: "❝" },
  { type: "lesson_link", label: "Odkaz na lekci", icon: "🔗" },
  { type: "youtube", label: "YouTube video", icon: "▶" },
  { type: "callout", label: "Callout box", icon: "📌" },
  { type: "divider", label: "Oddělovač", icon: "―" },
  { type: "two_column", label: "Dva sloupce", icon: "▥" },
  { type: "gallery", label: "Galerie", icon: "🖼️" },
  { type: "summary", label: "Shrnutí lekce", icon: "📋" },
  { type: "activity", label: "Aktivita", icon: "🎯" },
];

export const createDefaultBlock = (type: BlockType): Block => {
  const id = crypto.randomUUID();
  const base = { id, type, visible: true };

  switch (type) {
    case "heading":
      return { ...base, props: { level: 2, text: "" } };
    case "paragraph":
      return { ...base, props: { text: "" } };
    case "bullet_list":
      return { ...base, props: { items: [""] } };
    case "image":
      return { ...base, props: { url: "", caption: "", width: "full", alignment: "center" } };
    case "image_text":
      return { ...base, props: { imageUrl: "", text: "", imagePosition: "left" } };
    case "card_grid":
      return { ...base, props: { columns: 2, cards: [{ title: "", text: "" }, { title: "", text: "" }] } };
    case "table":
      return { ...base, props: { headers: ["Sloupec 1", "Sloupec 2"], rows: [["", ""]] } };
    case "accordion":
      return { ...base, props: { items: [{ title: "", content: "" }] } };
    case "quote":
      return { ...base, props: { text: "", author: "" } };
    case "lesson_link":
      return { ...base, props: { lessonId: "", buttonText: "" } };
    case "youtube":
      return { ...base, props: { url: "", caption: "", width: "full" } };
    case "callout":
      return { ...base, props: { calloutType: "note", text: "" } };
    case "divider":
      return { ...base, props: { style: "line" } };
    case "two_column":
      return { ...base, props: { left: "", right: "" } };
    case "gallery":
      return { ...base, props: { columns: 3, images: [{ url: "", caption: "" }] } };
    case "summary":
      return { ...base, props: { title: "Shrnutí lekce", text: "" } };
    case "activity":
      return { ...base, props: { activityType: "flashcards", title: "Aktivita", flashcards: [{ front: "", back: "" }], quiz: { question: "", answers: [{ text: "", correct: false }], explanation: "" }, matching: { left: [""], right: [""] }, sorting: { groups: ["Skupina 1", "Skupina 2"], items: [{ text: "", group: 0 }] }, ordering: { items: [""] }, imageLabel: { imageUrl: "", markers: [], tolerance: 5, shuffleWords: true }, imageHotspot: { imageUrl: "", hotspots: [] }, fillBlanks: { text: "", caseSensitive: false, diacriticSensitive: true }, fillChoice: { tokens: [], options: [] }, trueFalse: { statements: [{ text: "", isTrue: true }] }, revealCards: { cards: [{ title: "", content: "" }] }, memoryGame: { pairs: [{ left: "", right: "" }] }, crossword: { entries: [{ answer: "", clue: "" }] } } };
    default:
      return { ...base, props: {} };
  }
};
