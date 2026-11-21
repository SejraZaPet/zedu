/**
 * Aktivita ve slidu prezentace – jeden zdroj pravdy.
 *
 * Slide s aktivitou (`type: "activity"`) nese data v `activitySpec` (čte je živá hra,
 * projektor i telefon). Pokud má slide i blok `activity` (plátno editoru), jeho `props`
 * jsou vždy zrcadlem `activitySpec`. Úprava v kterémkoli místě se propíše do druhého.
 * Normalizace je čistá funkce: nic neukládá, stará pole ponechává.
 */

const clone = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const activityBlockIndex = (blocks: any[] | undefined): number =>
  Array.isArray(blocks) ? blocks.findIndex((b) => b?.type === "activity") : -1;

const isActivitySlide = (s: any) => s?.type === "activity";

/** Klíče s vlastním obsahem jednotlivých typů (kvízová data jim nestačí). */
const PAYLOAD_KEY: Record<string, string> = {
  true_false: "trueFalse",
  matching: "matching",
  quiz: "quiz",
  ordering: "ordering",
  sorting: "sorting",
};

/**
 * Staré slidy z „AI aktivity“: kvízová data (options + correctIndex) uložená pod jiným typem
 * (pravda/nepravda, dvojice, zeď, anketa, otevřená, quiz bez otázek). Vrátí opravený spec typu `mcq`.
 */
export function fixMistypedActivitySpec(spec: any): any {
  if (!spec || typeof spec !== "object") return spec;
  const at = String(spec.activityType ?? "");
  const looksMcq = Array.isArray(spec.options) && spec.options.length >= 2 && typeof spec.correctIndex === "number";
  if (!looksMcq || at === "mcq") return spec;
  const MISTYPED = ["true_false", "matching", "wall", "poll", "open", "quiz"];
  if (!MISTYPED.includes(at)) return spec;
  const key = PAYLOAD_KEY[at];
  if (key && spec[key]) return spec; // typ má vlastní data – nic neměníme
  if (at === "poll" && spec.options.every((o: any) => !o?.correct && !o?.isCorrect)) return spec;
  return { ...spec, activityType: "mcq", repairedFromType: at };
}

/** Líná normalizace při otevření: sjednotí blok a activitySpec bez ztráty (spec má přednost při konfliktu). */
export function normalizePresentationSlide(slide: any): any {
  if (!slide || typeof slide !== "object") return slide;
  let out = slide;
  const fixed = fixMistypedActivitySpec(slide.activitySpec);
  if (fixed !== slide.activitySpec) out = { ...out, activitySpec: fixed };
  if (!isActivitySlide(out)) return out;
  const blocks: any[] = Array.isArray(out.blocks) ? out.blocks : [];
  const idx = activityBlockIndex(blocks);
  if (idx < 0) {
    return out;
  }
  const block = blocks[idx];
  const spec = out.activitySpec;
  if (!spec) return { ...out, activitySpec: clone(block.props ?? {}) };
  const merged = { ...(block.props ?? {}), ...spec };
  if (same(merged, spec) && same(merged, block.props)) return out;
  const nextBlocks = blocks.slice();
  nextBlocks[idx] = { ...block, props: clone(merged) };
  return { ...out, activitySpec: merged, blocks: nextBlocks };
}

export function normalizePresentationSlides(slides: any[]): any[] {
  let changed = false;
  const next = (slides ?? []).map((s) => {
    const n = normalizePresentationSlide(s);
    if (n !== s) changed = true;
    return n;
  });
  return changed ? next : slides;
}

/** Po úpravě formuláře (activitySpec) přepíše props bloku aktivity. */
export function syncBlockFromSpec(slide: any): any {
  if (!isActivitySlide(slide) || !slide.activitySpec) return slide;
  const blocks: any[] = Array.isArray(slide.blocks) ? slide.blocks : [];
  const idx = activityBlockIndex(blocks);
  if (idx < 0 || same(blocks[idx].props, slide.activitySpec)) return slide;
  const nextBlocks = blocks.slice();
  nextBlocks[idx] = { ...blocks[idx], props: clone(slide.activitySpec) };
  return { ...slide, blocks: nextBlocks };
}

/** Po úpravě bloku na plátně přepíše activitySpec (hra čte spec). */
export function syncSpecFromBlock(slide: any): any {
  if (!isActivitySlide(slide)) return slide;
  const idx = activityBlockIndex(slide.blocks);
  if (idx < 0) return slide;
  const props = slide.blocks[idx]?.props ?? {};
  if (same(props, slide.activitySpec)) return slide;
  return { ...slide, activitySpec: clone(props) };
}

/** Aplikuje změnu slidu a udrží blok i spec ve shodě podle toho, co se měnilo. */
export function applySlidePatch(slide: any, patch: Record<string, unknown>): any {
  const next = { ...slide, ...patch };
  if ("activitySpec" in patch) return syncBlockFromSpec(next);
  if ("blocks" in patch) return syncSpecFromBlock(next);
  return next;
}

// ── AI aktivita: data podle skutečného typu ─────────────────────────────────

export interface AiMcq { question: string; options: string[]; correctIndex: number }

/** Typ z plánu hodiny → typ, který editor i hra umí. */
export function aiTargetType(planKind: string): "mcq" | "true_false" | "wall" | "poll" | "matching" {
  if (planKind === "true_false" || planKind === "wall" || planKind === "poll" || planKind === "matching") return planKind;
  if (planKind === "open") return "wall";
  return "mcq";
}

/**
 * Z odpovědi AI (otázka + možnosti) vytvoří data přesně pro cílový typ.
 * Dvojice z jedné otázky vytvořit nejde – pak vznikne kvíz a vrátí se vysvětlení.
 */
export function buildAiActivitySpec(planKind: string, ai: AiMcq, timeLimitSec?: number): { spec: any; instructions: string; note?: string } {
  const target = aiTargetType(planKind);
  const question = String(ai.question || "").trim();
  const opts = ai.options.map((o) => String(o ?? "").trim()).filter(Boolean);
  const ci = Math.min(Math.max(0, ai.correctIndex | 0), Math.max(0, opts.length - 1));
  const time = timeLimitSec !== undefined ? { timeLimitSec } : {};
  if (target === "true_false") {
    const correct = opts[ci];
    const wrong = opts.filter((_, i) => i !== ci).slice(0, 2);
    return {
      instructions: "Rozhodni u každého tvrzení.",
      spec: {
        activityType: "true_false",
        question,
        trueFalse: {
          statements: [
            { text: `${question} – ${correct}`, isTrue: true },
            ...wrong.map((w) => ({ text: `${question} – ${w}`, isTrue: false })),
          ],
        },
        ...time,
      },
    };
  }
  if (target === "wall") {
    return {
      instructions: "Napište svou odpověď.",
      spec: { activityType: "wall", question, anonymous: true, allowMultiple: false },
      ...(planKind === "open" ? { note: "Otevřená otázka se v živé hře zobrazí jako zeď odpovědí." } : {}),
    };
  }
  if (target === "poll") {
    return {
      instructions: "Vyberte jednu možnost.",
      spec: { activityType: "poll", question, options: opts.map((text) => ({ text })) },
    };
  }
  const mcq = {
    activityType: "mcq",
    question,
    options: opts.map((text, i) => ({ text, correct: i === ci, isCorrect: i === ci })),
    correctIndex: ci,
    ...time,
  };
  return {
    instructions: "Vyberte správnou odpověď.",
    spec: mcq,
    ...(target === "matching" ? { note: "Dvojice z jedné otázky AI vytvořit neumí – vznikl kvíz. Dvojice doplňte ručně v šabloně „Přiřaď dvojice“." } : {}),
  };
}

/** Lidský název typu pro štítky a hlášení. */
export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  mcq: "Kvíz", quiz: "Kvíz", true_false: "Pravda/nepravda", matching: "Dvojice", ordering: "Seřazení",
  sorting: "Třídění", fill_blanks: "Doplňování", fill_choice: "Doplň z nabídky", wordcloud: "Slovní mrak",
  wall: "Zeď odpovědí", poll: "Anketa", teams: "Týmy", escape: "Úniková hra", differentiated: "Diferencovaná aktivita",
  crossword: "Křížovka", flashcards: "Kartičky", reveal_cards: "Odkrývací kartičky", memory_game: "Pexeso",
  image_label: "Popis obrázku", image_hotspot: "Hotspot", exit_ticket: "Exit ticket", open: "Otevřená otázka",
};
export const activityTypeLabel = (t: unknown) => ACTIVITY_TYPE_LABEL[String(t ?? "")] ?? "Aktivita";
