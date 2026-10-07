/**
 * Vlastní práce žáka s pracovním listem MIMO úkol (`student_worksheet_work`).
 * Úkoly (assignment_attempts) se tudy nikdy neukládají.
 */
import { supabase } from "@/integrations/supabase/client";

export interface WorkTarget {
  worksheetId: string;
  studentId: string;
  variantId: string;
}

export interface WorkRow {
  id: string;
  answers: Record<string, any>;
  status: "draft" | "submitted";
  score: number | null;
  max_score: number | null;
  updated_at: string;
  submitted_at: string | null;
}

const TABLE = "student_worksheet_work" as any;
const COLS = "id, answers, status, score, max_score, updated_at, submitted_at";

/** Nejnovější koncept (draft) a poslední odevzdaná verze. */
export async function loadWork(t: WorkTarget): Promise<{ draft: WorkRow | null; lastSubmitted: WorkRow | null }> {
  const { data } = await supabase
    .from(TABLE)
    .select(COLS)
    .eq("worksheet_id", t.worksheetId)
    .eq("student_id", t.studentId)
    .eq("variant_id", t.variantId)
    .order("updated_at", { ascending: false })
    .limit(20);
  const rows = ((data ?? []) as unknown) as WorkRow[];
  return {
    draft: rows.find((r) => r.status === "draft") ?? null,
    lastSubmitted: rows.find((r) => r.status === "submitted") ?? null,
  };
}

/** Uloží koncept: aktualizuje existující řádek, jinak založí nový. Vrací id. */
export async function saveDraft(
  t: WorkTarget,
  answers: Record<string, any>,
  workId: string | null,
): Promise<string | null> {
  if (workId) {
    const { error } = await supabase
      .from(TABLE)
      .update({ answers } as any)
      .eq("id", workId)
      .eq("status", "draft");
    return error ? null : workId;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      worksheet_id: t.worksheetId,
      student_id: t.studentId,
      variant_id: t.variantId,
      answers,
      status: "draft",
    } as any)
    .select("id")
    .single();
  if (error) {
    // Souběh: koncept už existuje → vezmi ho a aktualizuj.
    const { draft } = await loadWork(t);
    if (!draft) return null;
    await supabase.from(TABLE).update({ answers } as any).eq("id", draft.id);
    return draft.id;
  }
  return (data as any)?.id ?? null;
}

/** Označí koncept jako odevzdaný se skóre. */
export async function submitWork(
  t: WorkTarget,
  answers: Record<string, any>,
  workId: string | null,
  score: number,
  maxScore: number,
): Promise<boolean> {
  const id = workId ?? (await saveDraft(t, answers, null));
  if (!id) return false;
  const { error } = await supabase
    .from(TABLE)
    .update({
      answers,
      status: "submitted",
      score,
      max_score: maxScore,
      submitted_at: new Date().toISOString(),
    } as any)
    .eq("id", id);
  return !error;
}
