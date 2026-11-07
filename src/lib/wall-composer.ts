import { ANNOUNCEMENT_MAX, assignmentKind } from "./assignment-kind";
import { assignmentDescriptionToText, sanitizeAssignmentDescription } from "./assignment-description";
import type { AssignmentMaterial } from "./assignment-materials";

export interface WallContext { classId: string | null; groupId: string | null; subjectId: string | null; subject: string; targetName: string }
export interface WallDraft { description: string; materials: AssignmentMaterial[]; pinned: boolean; commentsEnabled: boolean; notifyEmail: boolean }
export const isWallPost = (settings: unknown): boolean => assignmentKind(settings) === "announcement" && !!settings && typeof settings === "object" && "wallPost" in settings && settings.wallPost === true;
export function wallDraftRow(context: WallContext, draft: WallDraft, teacherId: string) {
  if (!context.classId && !context.groupId) throw new Error("Vyberte třídu nebo skupinu.");
  const text = assignmentDescriptionToText(draft.description);
  if (!text) throw new Error("Napište text příspěvku.");
  if (text.length > ANNOUNCEMENT_MAX) throw new Error(`Příspěvek může mít nejvýše ${ANNOUNCEMENT_MAX} znaků.`);
  return {
    teacher_id: teacherId, class_id: context.groupId ? null : context.classId, group_id: context.groupId,
    subject_id: context.subjectId, subject: context.subject, title: text.split("\n")[0].slice(0, 100),
    description: sanitizeAssignmentDescription(draft.description), materials: draft.materials,
    settings: { kind: "announcement", wallPost: true, pinned: draft.pinned, commentsEnabled: draft.commentsEnabled, notifyEmail: draft.notifyEmail },
    status: "draft", activity_data: [], deadline: null, max_attempts: 1,
  };
}
export function wallCreateUrl(context: WallContext, kind: "task" | "material" | "announcement", returnTo: string) {
  const params = new URLSearchParams({ kind, subject: context.subject, return_to: returnTo, fromWall: "1" });
  if (context.groupId) params.set("groupId", context.groupId); else if (context.classId) params.set("classId", context.classId);
  if (context.subjectId) params.set("subjectId", context.subjectId);
  return `/ucitel/ulohy?${params}`;
}
export const safeWallReturn = (path: string | null): string | null => path?.startsWith("/ucitel/") && !path.includes("\\") && !path.includes("//") ? path : null;