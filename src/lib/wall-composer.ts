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
    subject_id: context.subjectId, title: text.split("\n")[0].slice(0, 100),
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
/** Srozumitelný důvod chyby zápisu; nikdy nevrací obsah příspěvku. */
export function wallErrorReason(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? ""; const msg = (error?.message ?? "").toLowerCase();
  if (code === "PGRST204") return "Chyba aplikace (chybí pole v databázi), napište správci (kód PGRST204).";
  if (code === "42501" || msg.includes("row-level security")) return "Nemáte oprávnění psát do této třídy nebo skupiny.";
  if (code === "PGRST301" || code === "PGRST303" || error?.status === 401 || msg.includes("jwt")) return "Přihlášení vypršelo. Obnovte stránku – rozepsaný příspěvek zůstane uložený.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Nejste připojeni k internetu. Zkuste to znovu.";
  return code ? `Zkuste to znovu (kód ${code}).` : "Zkuste to znovu.";
}
export const isWallAuthError = (error: { code?: string; message?: string; status?: number } | null | undefined) =>
  !!error && (error.code === "PGRST301" || error.code === "PGRST303" || error.status === 401 || (error.message ?? "").toLowerCase().includes("jwt"));

const hasDraftText = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
export const wallDraftKey = (teacherId: string, context: Pick<WallContext, "classId" | "groupId">) =>
  `bezli:wall-draft:${teacherId}:${context.groupId ? `g:${context.groupId}` : `c:${context.classId}`}`;
export function loadWallDraft(storage: Pick<Storage, "getItem">, key: string): WallDraft | null {
  try {
    const d = JSON.parse(storage.getItem(key) ?? "null");
    if (!d || typeof d.description !== "string" || !Array.isArray(d.materials)) return null;
    if (!hasDraftText(d.description) && !d.materials.length) return null;
    return { description: d.description, materials: d.materials, pinned: !!d.pinned, commentsEnabled: d.commentsEnabled !== false, notifyEmail: !!d.notifyEmail };
  } catch { return null; }
}
export function saveWallDraft(storage: Pick<Storage, "setItem" | "removeItem">, key: string, draft: WallDraft) {
  try {
    if (!hasDraftText(draft.description) && !draft.materials.length) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(draft));
  } catch { /* plné úložiště – koncept jen v paměti */ }
}
/** Hodnota z <input type="datetime-local"> (čas zařízení, u nás Praha) → ISO; jen budoucí čas. */
export function wallScheduleIso(local: string, now = new Date()): string {
  const d = new Date(local);
  if (!local || isNaN(d.getTime())) throw new Error("Zadejte datum a čas zveřejnění.");
  if (d.getTime() <= now.getTime() + 60_000) throw new Error("Čas zveřejnění musí být v budoucnosti.");
  return d.toISOString();
}
