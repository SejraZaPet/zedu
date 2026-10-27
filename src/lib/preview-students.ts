import { supabase } from "@/integrations/supabase/client";

/**
 * Testovací žák (preview_students) se nesmí objevit v učitelských seznamech,
 * losování ani týmech. DB ho skryje všem kromě vlastníka; tady ho skryjeme i jemu.
 */
export function excludePreviewStudents<T>(rows: T[], getId: (r: T) => string | null | undefined, previewIds: Iterable<string>): T[] {
  const set = new Set(previewIds);
  if (set.size === 0) return rows;
  return rows.filter((r) => {
    const id = getId(r);
    return !id || !set.has(id);
  });
}

/** ID testovacích žáků, které volající smí znát (jen vlastní). Při chybě prázdné. */
export async function fetchMyPreviewStudentIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc("my_preview_student_ids" as any);
  if (error || !Array.isArray(data)) return [];
  return (data as unknown[]).map((v) => (typeof v === "string" ? v : (v as any)?.my_preview_student_ids)).filter(Boolean);
}
