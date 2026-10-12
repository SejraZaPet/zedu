/** Odkazy „K této hodině“ (učitel). Jen čtení, žádná data se nemění. */
import { supabase } from "@/integrations/supabase/client";
import { parseMaterials, type AssignmentMaterial } from "@/lib/assignment-materials";
import { worksheetState, type WorksheetState } from "@/lib/plan-worksheets";

export interface PlanLinkWorksheet { id: string; title: string; state: WorksheetState; subject_id: string | null; href: string }
export interface PlanLinkAssignment { id: string; title: string; deadline: string | null; status: string; href: string }
export interface PlanLinkPresentation { id: string; title: string; href: string }
export interface PlanLinks {
  lesson: { id: string; title: string; textbook: string | null; href: string } | null;
  worksheets: PlanLinkWorksheet[];
  materials: AssignmentMaterial[];
  assignments: PlanLinkAssignment[];
  presentations: PlanLinkPresentation[];
}

export const teacherWorksheetHref = (id: string) => `/ucitel/pracovni-listy/${id}`;
export const teacherAssignmentHref = (id: string) => `/ucitel/ulohy?detail=${id}`;
export const teacherPresentationHref = (id: string) => `/ucitel/prezentace?open=${id}`;
export function teacherLessonHref(id: string, source: string | null, textbookId?: string | null) {
  if (source === "textbook_lessons") return `/ucebnice/obsah/0/lekce/${id}`;
  return textbookId ? `/ucitel/ucebnice/${textbookId}?lesson=${id}` : `/ucitel/ucebnice`;
}

export function hasPlanLinks(l: PlanLinks | null | undefined): boolean {
  return !!l && (!!l.lesson || l.worksheets.length + l.materials.length + l.assignments.length + l.presentations.length > 0);
}

export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Koncept", scheduled: "Naplánovaný", published: "Publikovaný", closed: "Uzavřený",
};

export function emptyLinks(): PlanLinks {
  return { lesson: null, worksheets: [], materials: [], assignments: [], presentations: [] };
}

/** Dávkové načtení pro více plánů: jeden dotaz na každou tabulku. */
export async function loadPlanLinks(planIds: string[]): Promise<Record<string, PlanLinks>> {
  const out: Record<string, PlanLinks> = {};
  if (!planIds.length) return out;
  const { data: plans } = await supabase
    .from("lesson_plans")
    .select("id, worksheet_ids, materials, lesson_ref_id, lesson_source")
    .in("id", planIds);
  const rows = (plans as any[]) ?? [];
  const lessonIds = [...new Set(rows.map((r) => r.lesson_ref_id).filter(Boolean))] as string[];
  const wsIds = [...new Set(rows.flatMap((r) => (Array.isArray(r.worksheet_ids) ? r.worksheet_ids : [])))] as string[];

  const sel = "id, title, status, scheduled_publish_at, subject_id, source_lesson_id, created_at";
  const [wsById, wsByLesson, asg, pres, gl, tl] = await Promise.all([
    wsIds.length ? supabase.from("worksheets").select(sel).in("id", wsIds) : Promise.resolve({ data: [] }),
    lessonIds.length ? supabase.from("worksheets").select(sel).in("source_lesson_id", lessonIds) : Promise.resolve({ data: [] }),
    supabase.from("assignments").select("id, title, deadline, status, lesson_plan_id").in("lesson_plan_id", planIds),
    lessonIds.length
      ? supabase.from("teacher_presentations").select("id, title, source_lesson_id, lesson_id").in("source_lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length ? supabase.from("textbook_lessons").select("id, title").in("id", lessonIds) : Promise.resolve({ data: [] }),
    lessonIds.length
      ? supabase.from("teacher_textbook_lessons" as any).select("id, title, textbook_id").in("id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);
  const wsMap = new Map<string, any>();
  for (const w of [...((wsById as any).data ?? []), ...((wsByLesson as any).data ?? [])]) wsMap.set(w.id, w);
  const lessonMap = new Map<string, any>();
  for (const l of (gl as any).data ?? []) lessonMap.set(l.id, { ...l, source: "textbook_lessons" });
  const tbIds = [...new Set((((tl as any).data ?? []) as any[]).map((l) => l.textbook_id).filter(Boolean))];
  const tbTitles = new Map<string, string>();
  if (tbIds.length) {
    const { data: tbs } = await supabase.from("teacher_textbooks").select("id, title").in("id", tbIds);
    for (const t of (tbs as any[]) ?? []) tbTitles.set(t.id, t.title);
  }
  for (const l of (tl as any).data ?? []) lessonMap.set(l.id, { ...l, textbook: tbTitles.get(l.textbook_id) ?? null, source: "teacher_textbook_lessons" });

  for (const r of rows) {
    const links = emptyLinks();
    const l = r.lesson_ref_id ? lessonMap.get(r.lesson_ref_id) : null;
    if (l) {
      const source = r.lesson_source || l.source;
      links.lesson = {
        id: l.id, title: l.title || "Lekce", textbook: l.textbook ?? null,
        href: teacherLessonHref(l.id, source, l.textbook_id),
      };
    }
    const ids: string[] = Array.isArray(r.worksheet_ids) ? [...r.worksheet_ids] : [];
    for (const w of wsMap.values()) if (r.lesson_ref_id && w.source_lesson_id === r.lesson_ref_id && !ids.includes(w.id)) ids.push(w.id);
    links.worksheets = ids.map((id) => wsMap.get(id)).filter(Boolean).map((w) => ({
      id: w.id, title: w.title || "Pracovní list", state: worksheetState(w), subject_id: w.subject_id ?? null,
      href: teacherWorksheetHref(w.id),
    }));
    links.materials = parseMaterials(r.materials);
    links.assignments = (((asg as any).data ?? []) as any[]).filter((a) => a.lesson_plan_id === r.id).map((a) => ({
      id: a.id, title: a.title || "Úkol", deadline: a.deadline, status: a.status, href: teacherAssignmentHref(a.id),
    }));
    links.presentations = (((pres as any).data ?? []) as any[])
      .filter((p) => r.lesson_ref_id && p.source_lesson_id === r.lesson_ref_id)
      .map((p) => ({ id: p.id, title: p.title || "Prezentace", href: teacherPresentationHref(p.id) }));
    out[r.id] = links;
  }
  return out;
}
