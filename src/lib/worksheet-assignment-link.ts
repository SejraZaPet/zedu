import { assignmentKind } from "./assignment-kind";
import { addWorksheet, assignmentWorksheets, type MaterialWorksheet } from "./assignment-content";

export interface LinkAssignment {
  id: string; title: string; teacher_id: string; subject_id: string | null;
  class_id: string | null; group_id: string | null; worksheet_id: string | null; settings: unknown;
}
export const unpublishedWorksheet = (status: string) => status === "draft" || status === "scheduled";
export function sameWorksheetTarget(a: LinkAssignment, owner: string, target: string, subject: string | null) {
  const [kind, id] = target.split(":");
  return !!id && a.teacher_id === owner && assignmentKind(a.settings) !== "announcement"
    && a.subject_id === subject && (kind === "class" ? a.class_id === id && !a.group_id : kind === "group" && a.group_id === id && !a.class_id);
}
export function worksheetLinkPatch(a: LinkAssignment, worksheet: MaterialWorksheet) {
  if (assignmentKind(a.settings) === "announcement") throw new Error("K oznámení nelze přidat pracovní list.");
  if (assignmentKind(a.settings) !== "material") return { worksheet_id: worksheet.id };
  const list = addWorksheet(assignmentWorksheets(a), worksheet);
  return { worksheet_id: list[0]?.id ?? null, settings: { ...(a.settings as Record<string, unknown> ?? {}), worksheets: list } };
}
export const hasWorksheet = (a: LinkAssignment, id: string) => assignmentWorksheets(a).some(w => w.id === id);