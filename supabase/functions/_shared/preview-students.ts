// Testovací žáci (preview_students) se nesmí objevit v upozorněních, e-mailech,
// exportech ani statistikách. Vlastní žákovské funkce jim zůstávají.

export const PREVIEW_EMAIL_DOMAIN = "@preview.invalid";

export function isPreviewEmail(addr: unknown): boolean {
  return String(addr ?? "").trim().toLowerCase().endsWith(PREVIEW_EMAIL_DOMAIN);
}

export type PreviewMap = Map<string, string>; // student_id -> owner_id

// deno-lint-ignore no-explicit-any
export async function loadPreviewStudents(serviceDb: any): Promise<PreviewMap> {
  const { data, error } = await serviceDb.from("preview_students").select("student_id, owner_id");
  if (error) throw new Error("preview_students: " + error.message);
  return new Map(((data ?? []) as { student_id: string; owner_id: string }[]).map((r) => [r.student_id, r.owner_id]));
}

/** Vynechá testovací žáky; `keepForOwner` je ponechá jen jejich vlastníkovi. */
export function excludePreviewIds<T>(
  rows: T[],
  getId: (r: T) => string | null | undefined,
  preview: PreviewMap,
  keepForOwner?: string | null,
): T[] {
  if (preview.size === 0) return rows;
  return rows.filter((r) => {
    const id = getId(r);
    if (!id || !preview.has(id)) return true;
    return !!keepForOwner && preview.get(id) === keepForOwner;
  });
}
