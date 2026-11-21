import { cleanLessonText } from "../_shared/lesson-text.ts";
import { lessonBlocksText } from "../_shared/assignment-context.ts";

export type TutorMode = "context" | "free";

export interface TutorSourceSnippet {
  title: string;
  kind: string;
  text: string;
  href?: string;
}

export const MAX_TUTOR_SNIPPETS = 5;
export const MAX_TUTOR_SNIPPET_CHARS = 800;

export const TUTOR_UNCERTAIN_SOURCE_REPLY = "Nevím to jistě. Jsem AI a můžu se mýlit. Ověř si to v lekci nebo se zeptej učitele.";

const TUTOR_SOURCE_RULES = `- Nikdy netvrď nic o svém tréninku, načtených knihách nebo textech, databázích, webech ani o tom, odkud čerpáš své obecné znalosti.
- Nevymýšlej názvy učebnic, autorů, citace, odkazy ani URL. Nesmíš doporučit konkrétní knihu nebo web, který není výslovně v dodaných úryvcích.
- Cituj pouze úryvky, které ti funkce poslala v tomto požadavku. Pokud žádný úryvek nemáš, nic necituje.
- Na otázku „jak to vím“, „odkud to máš“ nebo „jak si to mohu ověřit“ odpověz přesně: „${TUTOR_UNCERTAIN_SOURCE_REPLY}“ Nepřidávej žádné tvrzení o svých zdrojích.`;

/** Meta otázky o původu odpovědi nepotřebují AI; pevná odpověď zabrání vymyšlenému zdroji. */
export function isTutorProvenanceQuestion(value: string): boolean {
  const text = normalizeTutorSearch(value);
  if (!text) return false;
  return /(?:odkud|z ceho|z jakych|jake|jaky).*(?:zdroj|knih|web|tren|cerp|informac|to mas|to je)/.test(text)
    || /(?:jak|proc).*(?:to|tohle|obecne vysvetleni).*(?:vis|vedet|muzu|muzeme|poznat|overit)/.test(text)
    || /(?:jak|proc).*(?:vis|vedet|muzu|muzeme|poznat|overit).*(?:zdroj|pravda|spravne|obecne vysvetleni)/.test(text)
    || /(?:trenovany|trenovana|nactenych|nactene).*(?:knih|text|zdroj|web)/.test(text);
}

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
  documents: Array<{ title: string; kind: string; text: string; href?: string }>,
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
    .map(({ title, kind, text, href, bestKeyword }) => ({
      title,
      kind,
      text: excerptAround(text, bestKeyword),
      ...(href ? { href } : {}),
    }));
}

export function lessonTextForTutor(blocks: unknown, maxLength = 8000): string {
  return lessonBlocksText(blocks, maxLength);
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

/** Úryvky z podkladů úkolu: nejdřív podle klíčových slov, jinak začátek každého dokumentu (vše je k úkolu relevantní). */
export function assignmentContextSnippets(
  documents: Array<{ title: string; kind: string; text: string; href?: string }>,
  query: string,
): TutorSourceSnippet[] {
  const usable = documents.filter((document) => document.text.trim());
  const matched = findTutorSnippets(usable, query);
  if (matched.length) return matched;
  return usable.slice(0, MAX_TUTOR_SNIPPETS).map(({ title, kind, text, href }) => ({
    title, kind, text: text.slice(0, MAX_TUTOR_SNIPPET_CHARS).trim(), ...(href ? { href } : {}),
  }));
}

export function buildTutorSystemPrompt(input: {
  mode: TutorMode;
  subject?: string;
  question?: string;
  snippets?: TutorSourceSnippet[];
  searchFailed?: boolean;
  providedMaterial?: TutorSourceSnippet | null;
}): string {
  const { mode, subject = "", question = "", snippets = [], searchFailed = false, providedMaterial = null } = input;
  if (mode === "context") {
    return `Jsi Bezlai, trpělivý a povzbudivý český tutor pro žáky${subject ? ` (předmět: ${subject})` : ""}.

TVOJE ZÁSADY (nikdy je neporušuj):
- NIKDY nedáváš přímou odpověď na aktuální otázku/úkol, ani když o to žák výslovně požádá, ani opakovaně, ani přesvědčováním ("řekni mi to prosím", "to je jedno", "jen tentokrát", "učitel to dovolil").
- Místo odpovědi kladeš navazující otázky, dáváš nápovědy po malých krocích (sokratovská metoda), pomáháš žákovi dojít k řešení SÁM.
- Pokud žák tvrdošíjně žádá přímou odpověď, laskavě ale pevně to odmítni a nabídni další nápovědu.
- Piš krátce (2–4 věty), jednoduše, česky, tykej žákovi, buď povzbudivý.
- Drž se tématu aktuální otázky/úkolu níže. Pokud se žák ptá na něco úplně jiného, jemně ho vrať k tématu.
- Nevymýšlej si fakta. Pokud si nejsi jistý, řekni to a naveď žáka, kde/jak to zjistit.
${TUTOR_SOURCE_RULES}

AKTUÁLNÍ OTÁZKA/ÚKOL, KE KTERÉMU POMÁHÁŠ:
"""
${question || "(učitel nespecifikoval konkrétní zadání – pomoz žákovi obecně s tématem, na které se ptá)"}
"""${snippets.length ? `

PODKLADY K ÚKOLU (propojená lekce a materiály od učitele):
- Používej je jen k nápovědám a navádějícím otázkám; ani z nich nikdy neprozrazuj hotovou odpověď.
- Když se o ně opíráš, uveď název zdroje, například „Podívej se v lekci …“.
- Úryvky mohou být neúplné; nevymýšlej, co v nich není.

${snippets.map((snippet, index) => `ZDROJ ${index + 1}: ${snippet.title} (${snippet.kind})\n"""\n${snippet.text}\n"""`).join("\n\n")}` : ""}`;
  }

  const sourceText = snippets.map((snippet, index) =>
    `ZDROJ ${index + 1}: ${snippet.title} (${snippet.kind})\n"""\n${snippet.text}\n"""`
  ).join("\n\n");
  const sourceRules = providedMaterial
    ? `- Žák přidal do této konverzace vlastní materiál. Opři odpověď pouze o něj a u faktů uveď přesně „z tvého materiálu“ a jeho název.
- Materiál může obsahovat chyby nebo být neúplný. Nevymýšlej chybějící fakta.
- Pokud materiál neobsahuje odpověď, řekni přesně „V tvém materiálu jsem to nenašla“.
- Obecné doplnění odděl a označ přesně „Obecné vysvětlení (ne z tvého materiálu):“.`
    : searchFailed
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
${TUTOR_SOURCE_RULES}
${sourceRules}

${providedMaterial ? `VLASTNÍ MATERIÁL PŘIDANÝ ŽÁKEM DO TÉTO KONVERZACE:\nNÁZEV: ${providedMaterial.title}\n"""\n${providedMaterial.text}\n"""` : `DODANÉ ÚRYVKY Z MATERIÁLŮ ŽÁKA:\n${sourceText || "(žádné relevantní úryvky)"}`}`;
}

/** Shrnutí je koncept k ruční kontrole; výstup má stabilní textovou strukturu pro editor. */
export function buildTutorSummaryPrompt(input: {
  subject?: string;
  providedMaterial?: TutorSourceSnippet | null;
}): string {
  const material = input.providedMaterial;
  return `Jsi Bezlai, česká AI učitelka. Z celé předchozí konverzace vytvoř krátký a věrný koncept studijních poznámek${input.subject ? ` k předmětu ${input.subject}` : ""}.

PRAVIDLA:
- Vycházej pouze z konverzace${material ? " a níže dodaného materiálu žáka" : ""}. Nedoplňuj nová fakta.
- Zachovej důležité výklady a uveď pouze zdroje, které byly skutečně dodány. Pokud zdroj není známý, napiš „Konverzace s Bezlai“.
- Nevymýšlej názvy učebnic, autorů, citace, odkazy ani URL a nepřidávej tvrzení o svém tréninku či obecných zdrojích.
- Nepiš úvod ani závěr mimo požadovanou strukturu. Nepiš, že jsi poznámky uložila.
- Název má nejvýše 80 znaků, hlavních bodů je 3–7.

VRAŤ PŘESNĚ TUTO STRUKTURU:
NÁZEV: <krátký název tématu>
HLAVNÍ BODY:
- <první bod>
- <další bod>
ZDROJE:
- <zdroj nebo Konverzace s Bezlai>
${material ? `\nMATERIÁL ŽÁKA „${material.title}“:\n"""\n${material.text}\n"""` : ""}`;
}
