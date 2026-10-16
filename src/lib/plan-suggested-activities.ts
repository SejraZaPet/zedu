/**
 * „Vytvořit z návrhu“ u navržených Bezli aktivit v plánu hodiny.
 *
 * Nic se nevytváří automaticky – vždy až po kliknutí učitele. Obsah se
 * předgeneruje AI, uloží jako koncept učiteli a propojí s krokem plánu
 * přes `created` referenci na aktivitě (ukládá se v input_data.phases).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  emptyWorksheetSpec,
  createDefaultItem,
  createDefaultAnswerKey,
  recomputeMetadata,
} from "@/lib/worksheet-defaults";
import type { WorksheetSpec, WorksheetItem, ItemType } from "@/lib/worksheet-spec";
import { buildMcq, type McqItem } from "@/lib/quick-game";

export type SuggestedKind =
  | "quiz"
  | "worksheet"
  | "live_game"
  | "lesson_block"
  | "offline_activity"
  | "discussion";

/** Druhy návrhů, ze kterých jde vytvořit skutečný obsah. */
export const CREATABLE_KINDS: readonly SuggestedKind[] = ["quiz", "worksheet", "live_game"];

export interface CreatedRef {
  type: "worksheet" | "game_template";
  id: string;
}

/** Existující cesty (ověřené v App.tsx) – žádný odkaz nesmí vést na 404. */
export const ACTIVITIES_HREF = "/aktivity";
export const GAMES_HREF = "/ucitel/hry";
export const teacherWorksheetEditorHref = (id: string) => `/ucitel/pracovni-listy/${id}`;

export function createdHref(ref: CreatedRef): string {
  return ref.type === "worksheet" ? teacherWorksheetEditorHref(ref.id) : GAMES_HREF;
}

/** Převede bloky z generate-full-worksheet na WorksheetSpec (koncept, varianta A). */
export function buildWorksheetSpecFromAi(
  title: string,
  aiItems: any[],
  opts?: { subject?: string; worksheetMode?: string },
): WorksheetSpec {
  const spec = emptyWorksheetSpec({
    title,
    subject: opts?.subject,
    worksheetMode: opts?.worksheetMode ?? "classwork",
  });
  const items: WorksheetItem[] = (aiItems ?? []).map((aiItem: any, i: number) => {
    const type = (aiItem?.type ?? "short_answer") as ItemType;
    const defaults = createDefaultItem(type, i + 1);
    const { id: _ignoreId, ...rest } = aiItem ?? {};
    return {
      ...defaults,
      ...rest,
      id: defaults.id,
      type,
      itemNumber: i + 1,
    } as WorksheetItem;
  });
  const variantId = spec.variants[0].variantId;
  spec.variants = [{ ...spec.variants[0], items }];
  spec.answerKeys = {
    [variantId]: items.map((it, i) => {
      const base = createDefaultAnswerKey(it);
      const ai = aiItems?.[i];
      return ai?.correctAnswer !== undefined && ai?.correctAnswer !== ""
        ? { ...base, correctAnswer: ai.correctAnswer }
        : base;
    }),
  };
  return recomputeMetadata(spec);
}

/** Převede otázky z generate-lesson-quiz na slidy živé hry (stejně jako QuickGameDialog). */
export function buildGameSlidesFromQuiz(questions: McqItem[]): any[] {
  return (questions ?? [])
    .filter((q) => q && typeof q.question === "string" && q.question.trim() && Array.isArray(q.answers))
    .map((q) => buildMcq(q, true));
}

export interface SuggestionContext {
  suggestionTitle: string;
  lessonTitle?: string;
  lessonContent?: string;
  phaseDescription?: string;
  subject?: string;
  lessonId?: string;
  lessonSource?: string;
}

function composeContext(ctx: SuggestionContext): string {
  return [
    ctx.lessonTitle ? `Lekce: ${ctx.lessonTitle}` : "",
    ctx.phaseDescription ? `Krok hodiny: ${ctx.phaseDescription}` : "",
    ctx.lessonContent ? `Obsah lekce:\n${ctx.lessonContent.slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Vytvoří pracovní list z návrhu: AI předgeneruje bloky, uloží se jako
 * koncept (draft) učiteli. Vrací id nového listu.
 */
export async function createWorksheetFromSuggestion(ctx: SuggestionContext): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Nejste přihlášeni.");

  const { data, error } = await supabase.functions.invoke("generate-full-worksheet", {
    body: {
      lessonContent: composeContext(ctx) || ctx.suggestionTitle,
      lessonTitle: ctx.suggestionTitle,
      worksheetMode: "classwork",
      focus: "worksheet",
      availableTypes: [
        "mcq", "true_false", "fill_blank", "matching", "ordering",
        "short_answer", "open_answer", "section_header", "write_lines",
        "instruction_box",
      ],
    },
  });
  if (error) throw new Error(extractFnError(error));
  if (data?.error) throw new Error(data.error);
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    throw new Error("AI nevygenerovala žádné bloky, zkuste to prosím znovu.");
  }

  const spec = buildWorksheetSpecFromAi(ctx.suggestionTitle, data.items, {
    subject: ctx.subject,
    worksheetMode: "classwork",
  });
  const { data: created, error: insErr } = await supabase
    .from("worksheets" as any)
    .insert({
      teacher_id: session.user.id,
      title: ctx.suggestionTitle.slice(0, 200),
      spec: spec as any,
      status: "draft",
      ...(ctx.lessonId
        ? {
            source_lesson_id: ctx.lessonId,
            source_lesson_type: ctx.lessonSource === "lessons" ? "global" : "teacher",
          }
        : {}),
    } as any)
    .select("id")
    .single();
  if (insErr || !created) throw new Error(insErr?.message || "Nepodařilo se uložit pracovní list.");
  return (created as any).id as string;
}

/**
 * Vytvoří kvíz / živou hru z návrhu: AI předgeneruje otázky, uloží se jako
 * šablona do knihovny her učitele. Vrací id nové šablony.
 */
export async function createGameFromSuggestion(ctx: SuggestionContext): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Nejste přihlášeni.");

  const topic = [
    ctx.suggestionTitle,
    ctx.lessonTitle ? `Lekce: ${ctx.lessonTitle}` : "",
    ctx.phaseDescription ? `Krok hodiny: ${ctx.phaseDescription}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1900);

  const { data, error } = await supabase.functions.invoke("generate-lesson-quiz", {
    body: { topic, format: "mcq", count: 8 },
  });
  if (error) throw new Error(extractFnError(error));
  if (data?.error) throw new Error(data.error);

  const slides = buildGameSlidesFromQuiz(data?.questions ?? []);
  if (!slides.length) throw new Error("AI nevygenerovala žádné otázky, zkuste to prosím znovu.");

  const { data: created, error: insErr } = await supabase
    .from("teacher_game_templates" as any)
    .insert({
      teacher_id: session.user.id,
      title: ctx.suggestionTitle.slice(0, 120),
      activity_data: slides,
      default_game_mode: "standard",
      default_team_mode: "none",
      subject: ctx.subject || null,
    } as any)
    .select("id")
    .single();
  if (insErr || !created) throw new Error(insErr?.message || "Nepodařilo se uložit hru.");
  return (created as any).id as string;
}

/** Vytáhne srozumitelnou hlášku z chyby edge funkce (vč. demo limitu AI). */
async function extractFnError(error: any): Promise<string> {
  const ctx = error?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* ignore */
    }
  }
  return error?.message || "Nepodařilo se vygenerovat obsah.";
}
