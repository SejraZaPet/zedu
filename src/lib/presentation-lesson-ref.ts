/**
 * Odkaz vlastní (upravitelné) prezentace na lekci – bez změny databáze.
 * Uloží se jako `lessonRef` na prvním slidu; `lesson_id` zůstává prázdné, takže
 * se prezentace nepřegeneruje z učebnice a editor ji může otevřít.
 */
export interface LessonRef { id: string; title: string; source: "teacher" | "catalog" }

export function readLessonRef(slides: any[] | null | undefined): LessonRef | null {
  for (const s of slides ?? []) {
    const r = s?.lessonRef;
    if (r && typeof r.id === "string" && r.id) return { id: r.id, title: String(r.title ?? ""), source: r.source === "catalog" ? "catalog" : "teacher" };
  }
  return null;
}

/** Odkaz drží právě první slide (i po smazání či přesunu slidů). */
export function attachLessonRef(slides: any[], ref: LessonRef | null): any[] {
  const list = (slides ?? []).map((s) => {
    if (!s || !("lessonRef" in s)) return s;
    const { lessonRef: _drop, ...rest } = s;
    return rest;
  });
  if (!ref || list.length === 0) return list;
  list[0] = { ...list[0], lessonRef: ref };
  return list;
}
