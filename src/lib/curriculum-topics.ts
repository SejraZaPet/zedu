import { supabase } from "@/integrations/supabase/client";
import type { Block } from "@/lib/textbook-config";

/** Téma ŠVP včetně informace, ze kterého ŠVP pochází. */
export interface SubjectTopic {
  id: string;
  title: string;
  planId: string;
  planTitle: string;
}

export interface SubjectTopicsResult {
  topics: SubjectTopic[];
  /** Počet ŠVP učitele k danému předmětu (kvůli zobrazení názvu ŠVP u témat). */
  planCount: number;
}

/**
 * Načte témata ze VŠECH ŠVP učitele k danému předmětu (porovnání názvu
 * předmětu bez ohledu na velikost písmen).
 */
export async function loadTopicsForSubject(
  teacherId: string,
  subject: string,
): Promise<SubjectTopicsResult> {
  const subj = subject.trim();
  if (!subj) return { topics: [], planCount: 0 };

  const { data: plans, error } = await supabase
    .from("teacher_curriculum_plans")
    .select("id, title, subject")
    .eq("teacher_id", teacherId)
    .ilike("subject", subj);
  if (error) throw error;

  const planRows = ((plans as { id: string; title: string | null; subject: string }[] | null) ?? [])
    .slice()
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "cs"));
  if (planRows.length === 0) return { topics: [], planCount: 0 };

  const planIds = planRows.map((p) => p.id);
  const titleByPlan = new Map(planRows.map((p) => [p.id, (p.title || "").trim() || p.subject]));

  const { data: t, error: tErr } = await supabase
    .from("curriculum_topics")
    .select("id, title, sort_order, curriculum_plan_id, created_at")
    .in("curriculum_plan_id", planIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (tErr) throw tErr;

  const rows = (t as { id: string; title: string; curriculum_plan_id: string }[] | null) ?? [];
  const order = new Map(planIds.map((id, i) => [id, i]));
  const topics: SubjectTopic[] = rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      planId: r.curriculum_plan_id,
      planTitle: titleByPlan.get(r.curriculum_plan_id) ?? "",
    }))
    .sort((a, b) => (order.get(a.planId) ?? 0) - (order.get(b.planId) ?? 0));

  return { topics, planCount: planRows.length };
}

const stripHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/** Nadpisy sekcí šablony ŠVP, které samy o sobě nejsou tématem učiva. */
const GENERIC_HEADINGS = [
  "pojetí a cíl",
  "charakteristika",
  "výsledky vzdělávání",
  "učivo",
  "časové rozvržení",
  "hodnocení",
  "mezipředmětové vztahy",
  "klíčové kompetence",
  "průřezová témata",
  "rozpis učiva",
  "obsah",
];

function isGenericHeading(text: string): boolean {
  const t = text.toLowerCase();
  return GENERIC_HEADINGS.some((g) => t.startsWith(g)) || /^\d+\.\s*ročník/.test(t);
}

/**
 * Vytáhne témata přímo ze struktury bloků ŠVP (bez AI):
 * - nadpisy 3. a nižší úrovně (a nadpisy 2. úrovně mimo obecné sekce šablony),
 * - řádky tabulek – sloupec „Učivo“ (nebo první sloupec, pokud „Učivo“ chybí),
 * - položky odrážkových seznamů pod sekcí učiva.
 */
export function extractTopicsFromBlocks(blocks: Block[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = stripHtml(raw).replace(/\s+/g, " ").trim();
    if (t.length < 2 || t.length > 160) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  let inLearningSection = false;
  for (const b of blocks) {
    if (b.visible === false) continue;
    const p = (b.props ?? {}) as Record<string, unknown>;
    switch (b.type) {
      case "heading": {
        const text = stripHtml(p.text);
        const level = Number(p.level) || 2;
        inLearningSection = /učivo|rozpis učiva|tematick/i.test(text);
        if (!text || isGenericHeading(text)) break;
        if (level >= 3 || !/^\d+\.\s*ročník/i.test(text)) push(text);
        break;
      }
      case "table": {
        const headers: string[] = Array.isArray(p.headers) ? (p.headers as string[]).map((h) => stripHtml(h)) : [];
        const rows: string[][] = Array.isArray(p.rows) ? (p.rows as string[][]) : [];
        let col = headers.findIndex((h) => /učivo/i.test(h));
        if (col < 0) col = 0;
        for (const row of rows) {
          const cell = stripHtml(row?.[col]);
          if (!cell) continue;
          // buňka může obsahovat víc témat na řádcích / za pomlčkou
          for (const line of cell.split(/\n|;/)) push(line.replace(/^[-•*\d.)\s]+/, ""));
        }
        break;
      }
      case "bullet_list": {
        if (!inLearningSection) break;
        const items: string[] = Array.isArray(p.items) ? (p.items as string[]) : [];
        for (const it of items) push(it);
        break;
      }
      default:
        break;
    }
  }
  return out;
}
