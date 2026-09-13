/**
 * Převod aktivity z lekce na položky pracovního listu.
 *
 * Aktivity v lekci ukládají data ve svém vlastním tvaru
 * (`props.matching = { left, right, pairs }`, `props.quiz = { questions: [...] }`,
 * `props.sorting = { groups, items }`, tokenizované doplňovačky…).
 * Tento modul je namapuje na `WorksheetItem`, aby se obsah do pracovního listu
 * skutečně propsal a učitel ho nemusel zadávat znovu.
 */

import type { ItemType, WorksheetItem } from "@/lib/worksheet-spec";
import { getQuizQuestions } from "@/lib/quiz-questions";
import type { LessonActivity } from "@/lib/lesson-content-splitter";

export interface MappedWorksheetItem {
  type: ItemType;
  patch: Partial<WorksheetItem>;
  /** Správná odpověď pro answer key (pokud ji jde odvodit). */
  correct?: string | string[];
}

/** Mapování typu aktivity z lekce na typ položky pracovního listu. */
export function mapLessonActivityToItemType(at: string): ItemType {
  switch (at) {
    case "flashcards": return "flashcards";
    case "matching": return "matching";
    case "sorting": return "sorting";
    case "ordering": return "ordering";
    case "image_label": return "image_label";
    case "image_hotspot": return "image_hotspot";
    case "crossword": return "crossword";
    case "fill_blanks":
    case "fill_choice": return "fill_blank";
    case "true_false": return "true_false";
    case "quiz":
    case "poll": return "mcq";
    case "memory_game":
    case "reveal_cards": return "flashcards";
    case "wall": return "open_answer";
    default: return "open_answer";
  }
}

const str = (v: unknown) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

type Token = { type?: string; value?: unknown; answer?: unknown; alternatives?: unknown };

/** Z tokenů doplňovačky udělá text s ___ a seznam správných odpovědí. */
function tokensToBlank(tokens: unknown, fallbackText?: unknown) {
  const list = Array.isArray(tokens) ? (tokens as Token[]) : [];
  if (list.length === 0) {
    const text = String(fallbackText ?? "");
    if (!text) return null;
    // legacy {{odpoved}} formát
    const answers: string[] = [];
    const blankText = text.replace(/\{\{([^}]+)\}\}/g, (_m, inner) => {
      answers.push(String(inner).split("|")[0].trim());
      return "___";
    });
    return { blankText, answers };
  }
  const answers: string[] = [];
  const blankText = list
    .map((t) => {
      if (t?.type === "blank") {
        answers.push(str(t.answer));
        return "___";
      }
      return String(t?.value ?? "");
    })
    .join("");
  return { blankText: blankText.trim(), answers };
}

/**
 * Vytvoří jednu nebo více položek pracovního listu z aktivity lekce.
 * Kvíz s více otázkami i Pravda/Nepravda s více tvrzeními vytvoří položku
 * pro každou otázku / tvrzení.
 */
export function buildItemsFromLessonActivity(activity: LessonActivity): MappedWorksheetItem[] {
  const p = (activity.props ?? {}) as any;
  const at = activity.activityType;
  const type = mapLessonActivityToItemType(at);
  const promptText = str(activity.instructions) || str(activity.title);

  const base = (patch: Partial<WorksheetItem>, correct?: string | string[]): MappedWorksheetItem => ({
    type,
    patch: { ...(promptText ? { prompt: promptText } : {}), ...patch },
    correct,
  });

  // ── Kvíz / anketa → jedna MCQ položka na otázku ──
  if (at === "quiz") {
    const questions = getQuizQuestions(p.quiz);
    const out = questions
      .map((q) => {
        const choices = q.answers.map((a) => str(a.text)).filter(Boolean);
        if (!q.question && choices.length === 0) return null;
        const correctOne = q.answers.find((a) => a.correct);
        return {
          type,
          patch: {
            prompt: str(q.question) || promptText,
            ...(choices.length ? { choices } : {}),
          } as Partial<WorksheetItem>,
          correct: correctOne ? str(correctOne.text) : undefined,
        } as MappedWorksheetItem;
      })
      .filter(Boolean) as MappedWorksheetItem[];
    if (out.length) return out;
  }

  if (at === "poll") {
    const options = (Array.isArray(p.options) ? p.options : [])
      .map((o: any) => str(typeof o === "string" ? o : o?.text))
      .filter(Boolean);
    return [base(options.length ? { choices: options } : {})];
  }

  // ── Pravda / Nepravda → položka na každé tvrzení ──
  if (at === "true_false") {
    const stmts = Array.isArray(p.trueFalse?.statements) ? p.trueFalse.statements : [];
    const out = stmts
      .map((s: any) => {
        const text = str(s?.text ?? s?.statement);
        if (!text) return null;
        const isTrue = s?.isTrue ?? s?.correct;
        return {
          type,
          patch: { prompt: text } as Partial<WorksheetItem>,
          correct: isTrue === false ? "false" : "true",
        } as MappedWorksheetItem;
      })
      .filter(Boolean) as MappedWorksheetItem[];
    if (out.length) return out;
  }

  // ── Otáčecí kartičky / pexeso / odkrývací kartičky ──
  if (type === "flashcards") {
    let cards: Array<{ front: string; back: string }> = [];
    if (Array.isArray(p.flashcards)) {
      cards = p.flashcards.map((c: any) => ({ front: str(c?.front), back: str(c?.back) }));
    } else if (Array.isArray(p.memoryGame?.pairs)) {
      cards = p.memoryGame.pairs.map((x: any) => ({
        front: str(x?.left ?? x?.a),
        back: str(x?.right ?? x?.b),
      }));
    } else if (Array.isArray(p.revealCards?.cards)) {
      cards = p.revealCards.cards.map((x: any) => ({
        front: str(x?.title ?? x?.front),
        back: str(x?.content ?? x?.back ?? x?.text),
      }));
    }
    cards = cards.filter((c) => c.front || c.back);
    return [base(cards.length ? { flashcards: cards } : {})];
  }

  // ── Přiřazování ──
  if (type === "matching") {
    const raw = p.matching ?? {};
    let pairs: Array<{ left: string; right: string }> = [];
    if (Array.isArray(raw.left)) {
      const left: string[] = raw.left.map((x: any) => str(x));
      const right: string[] = Array.isArray(raw.right) ? raw.right.map((x: any) => str(x)) : [];
      const mapping: number[][] = Array.isArray(raw.pairs) ? raw.pairs : [];
      pairs = left.map((l, i) => {
        const m = mapping.find((pr) => Array.isArray(pr) && pr[0] === i);
        const rightIdx = m && typeof m[1] === "number" ? m[1] : i;
        return { left: l, right: right[rightIdx] ?? "" };
      });
    } else if (Array.isArray(raw.pairs)) {
      pairs = raw.pairs
        .filter((x: any) => x && typeof x === "object")
        .map((x: any) => ({ left: str(x.left ?? x.a), right: str(x.right ?? x.b) }));
    }
    pairs = pairs.filter((pr) => pr.left || pr.right);
    return [
      base(
        pairs.length ? { matchPairs: pairs } : {},
        pairs.length ? pairs.map((pr) => `${pr.left}=${pr.right}`) : undefined,
      ),
    ];
  }

  // ── Seřaď pořadí ──
  if (type === "ordering") {
    const raw = p.ordering ?? {};
    const arr: string[] = (Array.isArray(raw.items) ? raw.items : Array.isArray(raw) ? raw : [])
      .map((x: any) => str(typeof x === "string" ? x : x?.text))
      .filter(Boolean);
    return [base(arr.length ? { orderItems: arr } : {}, arr.length ? arr : undefined)];
  }

  // ── Třídění do skupin ──
  if (type === "sorting") {
    const raw = p.sorting ?? {};
    const groups: string[] = Array.isArray(raw.groups) ? raw.groups.map((g: any) => str(g)) : [];
    const rawCats = Array.isArray(raw.categories) ? raw.categories : [];
    const categories = groups.length
      ? groups.map((label, i) => ({ id: `c${i}`, label: label || `Kategorie ${i + 1}` }))
      : rawCats.map((c: any, i: number) => ({
          id: str(c?.id) || `c${i}`,
          label: str(c?.label ?? c?.name) || `Kategorie ${i + 1}`,
        }));
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .map((it: any) => {
        const text = str(it?.text);
        let categoryId = "";
        if (typeof it?.group === "number") categoryId = categories[it.group]?.id ?? categories[0]?.id ?? "c0";
        else categoryId = str(it?.categoryId ?? it?.category) || categories[0]?.id || "c0";
        return { text, categoryId };
      })
      .filter((it: any) => it.text);
    const patch: Partial<WorksheetItem> = {};
    if (categories.length) patch.sortingCategories = categories;
    if (items.length) patch.sortingItems = items;
    return [base(patch)];
  }

  // ── Doplňovačky ──
  if (type === "fill_blank") {
    const source = at === "fill_choice" ? p.fillChoice ?? {} : p.fillBlanks ?? {};
    const parsed = tokensToBlank(source.tokens, source.text);
    const patch: Partial<WorksheetItem> = {};
    if (parsed?.blankText) patch.blankText = parsed.blankText;
    const options: string[] = Array.isArray(source.options)
      ? source.options.map((o: any) => str(o)).filter(Boolean)
      : [];
    if (at === "fill_choice" && options.length) {
      patch.hints = [`Nabídka: ${options.join(" · ")}`];
    }
    const answers = parsed?.answers.filter(Boolean) ?? [];
    return [base(patch, answers.length ? answers : undefined)];
  }

  // ── Křížovka ──
  if (type === "crossword") {
    const entries = Array.isArray(p.crossword?.entries) ? p.crossword.entries : [];
    const mapped = entries
      .map((e: any, i: number) => ({
        answer: str(e?.answer).toUpperCase(),
        clue: str(e?.clue),
        direction: (e?.direction === "down" ? "down" : "across") as "across" | "down",
        row: Number(e?.row ?? 0) || 0,
        col: Number(e?.col ?? 0) || 0,
        number: Number(e?.number ?? i + 1) || i + 1,
      }))
      .filter((e: any) => e.answer);
    const patch: Partial<WorksheetItem> = {};
    if (mapped.length) patch.crosswordEntries = mapped;
    if (typeof p.crossword?.cols === "number") patch.crosswordCols = p.crossword.cols;
    if (typeof p.crossword?.rows === "number") patch.crosswordRows = p.crossword.rows;
    return [base(patch)];
  }

  // ── Popis obrázku ──
  if (type === "image_label") {
    const il = p.imageLabel ?? {};
    const markers = Array.isArray(il.markers) ? il.markers : [];
    const patch: Partial<WorksheetItem> = {};
    if (markers.length) {
      patch.imageLabels = markers.map((m: any, i: number) => ({
        number: Number(m?.number ?? i + 1) || i + 1,
        xPercent: Number(m?.xPercent ?? m?.x ?? 50),
        yPercent: Number(m?.yPercent ?? m?.y ?? 50),
        answer: str(m?.answer ?? m?.label),
      }));
    }
    if (typeof il.imageUrl === "string" && il.imageUrl) patch.imageUrl = il.imageUrl;
    if (typeof il.tolerance === "number") patch.imageTolerance = il.tolerance;
    if (typeof il.shuffleWords === "boolean") patch.imageShuffleWords = il.shuffleWords;
    return [base(patch)];
  }

  // ── Klikni na část obrázku ──
  if (type === "image_hotspot") {
    const ih = p.imageHotspot ?? {};
    const hs = Array.isArray(ih.hotspots) ? ih.hotspots : [];
    const patch: Partial<WorksheetItem> = {};
    if (hs.length) {
      patch.imageHotspots = hs.map((h: any, i: number) => ({
        number: Number(h?.number ?? i + 1) || i + 1,
        xPercent: Number(h?.xPercent ?? h?.x ?? 50),
        yPercent: Number(h?.yPercent ?? h?.y ?? 50),
        question: str(h?.question ?? h?.label),
      }));
    }
    if (typeof ih.imageUrl === "string" && ih.imageUrl) patch.imageUrl = ih.imageUrl;
    return [base(patch)];
  }

  // ── Zeď a ostatní → otevřená odpověď ──
  return [base({})];
}
