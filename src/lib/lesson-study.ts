// Pomocné funkce pro studijní lištu u lekce (Kartičky · Kvíz · Shrnutí · Zeptat se).
// Čisté funkce bez závislostí na Reactu/Supabase, aby šly testovat.

export interface StudyCard {
  front: string;
  back: string;
}

/** Maximální délka textu lekce posílaného do AI kontextu. */
export const LESSON_TEXT_MAX = 6000;

/** Maximální počet kartiček z AI. */
export const MAX_AI_CARDS = 15;

// deno-lint-ignore no-explicit-any
type AnyNode = any;

/** Vytáhne prostý text z bloků lekce (pro AI kontext a čtení nahlas). */
export function blocksToPlainText(blocks: unknown, maxLen = LESSON_TEXT_MAX): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  const walk = (node: AnyNode) => {
    if (!node) return;
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      if (typeof node.text === "string") out.push(node.text);
      if (typeof node.content === "string") out.push(node.content);
      if (typeof node.title === "string") out.push(node.title);
      if (typeof node.heading === "string") out.push(node.heading);
      if (Array.isArray(node.children)) walk(node.children);
      if (Array.isArray(node.items)) walk(node.items);
      if (node.props && typeof node.props === "object") walk(node.props);
    }
  };
  walk(blocks);
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/**
 * Najde kartičky přímo v obsahu lekce: aktivity „Otáčecí kartičky" (flashcards)
 * a „Otevři kartičku" (reveal_cards). Vrací sjednocené páry přední/zadní strana.
 */
export function extractCardsFromBlocks(blocks: unknown): StudyCard[] {
  if (!Array.isArray(blocks)) return [];
  const cards: StudyCard[] = [];
  for (const block of blocks as AnyNode[]) {
    const props = block?.props;
    if (!props || typeof props !== "object") continue;
    if (props.activityType === "flashcards" && Array.isArray(props.flashcards)) {
      for (const c of props.flashcards) {
        const front = (c?.front ?? "").toString().trim();
        const back = (c?.back ?? "").toString().trim();
        if (front && back) cards.push({ front, back });
      }
    }
    if (props.activityType === "reveal_cards" && Array.isArray(props.revealCards?.cards)) {
      for (const c of props.revealCards.cards) {
        const front = (c?.title ?? "").toString().trim();
        const back = (c?.content ?? "").toString().trim();
        if (front && back) cards.push({ front, back });
      }
    }
  }
  return cards;
}

export interface StudyMethodLite {
  id: string;
  slug: string;
}

/**
 * Vybere metodu pro procvičování: první oblíbenou, jinak první dostupnou.
 * Vrací null, když žádná metoda neexistuje.
 */
export function pickStudyMethod(
  methods: StudyMethodLite[],
  preferredIds: string[],
): StudyMethodLite | null {
  if (methods.length === 0) return null;
  const preferred = methods.find((m) => preferredIds.includes(m.id));
  return preferred ?? methods[0];
}
