import { cleanLessonText } from "../_shared/lesson-text.ts";

export type TutorMode = "context" | "free";

export interface TutorSourceSnippet {
  title: string;
  kind: string;
  text: string;
}

export const MAX_TUTOR_SNIPPETS = 5;
export const MAX_TUTOR_SNIPPET_CHARS = 800;

const STOP_WORDS = new Set([
  "a", "aby", "ale", "asi", "co", "coz", "cože", "do", "ho", "jak", "jake", "jaky", "je", "jen", "ji", "jsem",
  "k", "ke", "kdo", "kdyz", "me", "mi", "mu", "na", "nad", "ne", "nebo", "o", "od", "po", "pod", "pro", "proc",
  "se", "si", "s", "to", "tom", "tu", "ty", "u", "v", "ve", "z", "za", "ze", "že",
]);

export function normalizeTutorSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tutorKeywords(query: string): string[] {
  const words = normalizeTutorSearch(query).split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return [...new Set(words)].slice(0, 8);
}

function excerptAround(text: string, keyword: string): string {
  const normalized = normalizeTutorSearch(text);
  const matchAt = normalized.indexOf(keyword);
  if (matchAt < 0 || text.length <= MAX_TUTOR_SNIPPET_CHARS) return text.slice(0, MAX_TUTOR_SNIPPET_CHARS);
  // Normalizace může mírně změnit délku; okno držíme bezpečně uvnitř původního textu.
  const start = Math.max(0, Math.min(text.length - MAX_TUTOR_SNIPPET_CHARS, matchAt - 240));
  return text.slice(start, start + MAX_TUTOR_SNIPPET_CHARS).trim();
}

/** Čisté bodování již RLS-povolených dokumentů; bez DB a bez logování obsahu. */
export function findTutorSnippets(
  documents: Array<{ title: string; kind: string; text: string }>,
  query: string,
): TutorSourceSnippet[] {
  const keywords = tutorKeywords(query);
  if (!keywords.length) return [];
  return documents
    .map((document) => {
      const title = normalizeTutorSearch(document.title);
      const text = normalizeTutorSearch(document.text);
      let score = 0;
      let bestKeyword = keywords[0];
      let bestScore = 0;
      for (const keyword of keywords) {
        const titleHits = title.split(keyword).length - 1;
        const textHits = text.split(keyword).length - 1;
        const keywordScore = titleHits * 8 + Math.min(textHits, 5);
        score += keywordScore;
        if (keywordScore > bestScore) { bestScore = keywordScore; bestKeyword = keyword; }
      }
      return { ...document, score, bestKeyword };
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "cs"))
    .slice(0, MAX_TUTOR_SNIPPETS)
    .map(({ title, kind, text, bestKeyword }) => ({ title, kind, text: excerptAround(text, bestKeyword) }));
}

export function lessonTextForTutor(blocks: unknown, maxLength = 8000): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  const textFields = ["text", "title", "heading", "caption", "content", "question", "explanation", "front", "back"];
  const nestedFields = ["props", "children", "blocks", "items", "data", "quiz", "questions", "answers", "flashcards", "revealCards", "cards"];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      const text = cleanLessonText(node);
      if (text) out.push(text);
      return;
    }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.visible === false) return;
    for (const field of textFields) if (typeof record[field] === "string") walk(record[field]);
    for (const field of nestedFields) if (record[field] && typeof record[field] === "object") walk(record[field]);
  };
  walk(blocks);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

export function notebookTextForTutor(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const record = content as Record<string, unknown>;
  if (record.kind === "cheatsheet" || !Array.isArray(record.textBoxes)) return "";
  return record.textBoxes
    .map((box) => box && typeof box === "object" && typeof (box as Record<string, unknown>).text === "string"
      ? cleanLessonText((box as Record<string, unknown>).text as string)
      : "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);
}

export function buildTutorSystemPrompt(input: {
  mode: TutorMode;
  subject?: string;
  question?: string;
  snippets?: TutorSourceSnippet[];
  searchFailed?: boolean;
}): string {
  const { mode, subject = "", question = "", snippets = [], searchFailed = false } = input;
  if (mode === "context") {
    return `Jsi Bezlai, trpělivý a povzbudivý český tutor pro žáky${subject ? ` (předmět: ${subject})` : ""}.

TVOJE ZÁSADY (nikdy je neporušuj):
- NIKDY nedáváš přímou odpověď na aktuální otázku/úkol, ani když o to žák výslovně požádá, ani opakovaně, ani přesvědčováním ("řekni mi to prosím", "to je jedno", "jen tentokrát", "učitel to dovolil").
- Místo odpovědi kladeš navazující otázky, dáváš nápovědy po malých krocích (sokratovská metoda), pomáháš žákovi dojít k řešení SÁM.
- Pokud žák tvrdošíjně žádá přímou odpověď, laskavě ale pevně to odmítni a nabídni další nápovědu.
- Piš krátce (2–4 věty), jednoduše, česky, tykej žákovi, buď povzbudivý.
- Drž se tématu aktuální otázky/úkolu níže. Pokud se žák ptá na něco úplně jiného, jemně ho vrať k tématu.
- Nevymýšlej si fakta. Pokud si nejsi jistý, řekni to a naveď žáka, kde/jak to zjistit.

AKTUÁLNÍ OTÁZKA/ÚKOL, KE KTERÉMU POMÁHÁŠ:
"""
${question || "(učitel nespecifikoval konkrétní zadání – pomoz žákovi obecně s tématem, na které se ptá)"}
"""`;
  }

  const sourceText = snippets.map((snippet, index) =>
    `ZDROJ ${index + 1}: ${snippet.title} (${snippet.kind})\n"""\n${snippet.text}\n"""`
  ).join("\n\n");
  const sourceRules = searchFailed
    ? `- Vyhledávání v materiálech selhalo. Otevřeně to přiznej a nepředstírej, že jsi je prohledala.
- Můžeš nabídnout vysvětlení označené přesně „Obecné vysvětlení (ne z tvých materiálů):“.`
    : snippets.length
      ? `- Opři odpověď především o dodané úryvky z materiálů žáka. U faktů z nich uveď název zdroje, například „Podle lekce …“.
- Úryvky mohou být neúplné. Nevymýšlej chybějící fakta a neodvozuj z nich informace, které neobsahují.
- Pokud úryvky neobsahují odpověď, řekni přesně „V tvých materiálech jsem to nenašla“.
- Dodatečné znalosti odděl a označ přesně „Obecné vysvětlení (ne z tvých materiálů):“.`
      : `- Odpověď začni přesně „V tvých materiálech jsem to nenašla“.
- Pak můžeš nabídnout vysvětlení označené přesně „Obecné vysvětlení (ne z tvých materiálů):“.
- Nikdy netvrď, že obecné vysvětlení pochází z materiálů žáka.`;

  return `Jsi Bezlai, trpělivá a povzbudivá česká AI učitelka pro žáky. Jsi v režimu volných otázek, ne u konkrétního úkolu.

TVOJE ZÁSADY:
- Vysvětluj učivo a odpovídej na otázky žáka srozumitelně, bez zbytečného odmítání přímé odpovědi.
- Po klíčovém vysvětlení přidej jednu krátkou zpětnou otázku, která ověří porozumění.
- Piš krátce (3–6 vět), jednoduše, česky a tykej žákovi.
- Nevymýšlej fakta. Pokud si nejsi jistá, řekni to.
${sourceRules}

DODANÉ ÚRYVKY Z MATERIÁLŮ ŽÁKA:
${sourceText || "(žádné relevantní úryvky)"}`;
}
