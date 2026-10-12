/** Pracovní listy připnuté k plánu hodiny (`lesson_plans.worksheet_ids`). */
export interface PlanWorksheetOption {
  id: string;
  title: string;
  status: string;
  scheduled_publish_at: string | null;
  subject: string | null;
  subject_id: string | null;
  created_at: string;
}

export function parsePlanWorksheetIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

export function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function removeId(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

export function addIds(ids: string[], add: string[]): string[] {
  return [...ids, ...add.filter((x, i) => !ids.includes(x) && add.indexOf(x) === i)];
}

export type WorksheetState = "draft" | "scheduled" | "published";

export function worksheetState(w: Pick<PlanWorksheetOption, "status" | "scheduled_publish_at">): WorksheetState {
  if (w.status === "published") return "published";
  if (w.status === "scheduled" || w.scheduled_publish_at) return "scheduled";
  return "draft";
}

export const WORKSHEET_STATE_LABEL: Record<WorksheetState, string> = {
  draft: "Koncept",
  scheduled: "Naplánovaný",
  published: "Publikovaný",
};

/** Nabídka do dialogu: nejnovější první, volitelně jen předmět plánu, hledání v názvu. */
export function filterWorksheetOptions(
  list: PlanWorksheetOption[],
  opts: { query?: string; subjectId?: string | null; subject?: string | null; onlySubject?: boolean },
): PlanWorksheetOption[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const subj = (opts.subject ?? "").trim().toLowerCase();
  const hasSubject = !!opts.subjectId || !!subj;
  return [...list]
    .filter((w) => !q || (w.title || "").toLowerCase().includes(q))
    .filter((w) => {
      if (!opts.onlySubject || !hasSubject) return true;
      if (opts.subjectId && w.subject_id) return w.subject_id === opts.subjectId;
      return !!subj && (w.subject || "").trim().toLowerCase() === subj;
    })
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}
