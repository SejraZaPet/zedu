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
  | "youtube";

export interface Block {
  id: string;
  type: BlockType;
  visible: boolean;
  props: Record<string, any>;
}

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
    default:
      return { ...base, props: {} };
  }
};
