/**
 * Druh položky v `assignments.settings.kind`: úkol (výchozí), materiál, oznámení.
 * Materiál a oznámení se neodevzdávají – nemají termín, pokusy ani stavy.
 * Odevzdání po termínu: `settings.lateUntil` = chybí (ne) | "unlimited" | ISO datum.
 */
export type AssignmentKind = "task" | "material" | "announcement";
export type LateMode = "no" | "until" | "unlimited";

type Settings = Record<string, unknown> | null | undefined;
const obj = (s: unknown): Record<string, unknown> => (s && typeof s === "object" && !Array.isArray(s) ? s as Record<string, unknown> : {});

export const KIND_LABELS: Record<AssignmentKind, string> = { task: "Úkol", material: "Materiál", announcement: "Oznámení" };
export const ANNOUNCEMENT_MAX = 500;

export function assignmentKind(settings: unknown): AssignmentKind {
  const k = obj(settings).kind;
  return k === "material" || k === "announcement" ? k : "task";
}
export const isSubmittable = (settings: unknown) => assignmentKind(settings) === "task";

export function lateMode(settings: unknown): LateMode {
  const v = obj(settings).lateUntil;
  if (v === "unlimited") return "unlimited";
  return typeof v === "string" && Number.isFinite(new Date(v).getTime()) ? "until" : "no";
}
/** Konec možnosti odevzdat: null = jen do termínu, Infinity = bez omezení. */
export function lateLimit(settings: unknown): Date | typeof Infinity | null {
  const mode = lateMode(settings);
  if (mode === "unlimited") return Infinity;
  if (mode === "until") return new Date(obj(settings).lateUntil as string);
  return null;
}
/** Lze ještě odevzdat? Bez termínu vždy; po termínu jen podle `lateUntil`. */
export function canSubmitNow(a: { deadline?: string | null; settings?: unknown }, now: Date = new Date()): boolean {
  if (!isSubmittable(a.settings)) return false;
  const d = a.deadline ? new Date(a.deadline).getTime() : NaN;
  if (!Number.isFinite(d) || now.getTime() <= d) return true;
  const limit = lateLimit(a.settings);
  if (limit === Infinity) return true;
  return limit instanceof Date && now.getTime() <= limit.getTime();
}
/** +N dní od termínu (nebo od teď, když termín chybí) jako ISO. */
export function lateUntilFromDays(deadline: string | null, days: number): string {
  const base = deadline && Number.isFinite(new Date(deadline).getTime()) ? new Date(deadline) : new Date();
  return new Date(base.getTime() + days * 86400000).toISOString();
}

export function isPinned(settings: unknown) { return obj(settings).pinned === true; }
export function announcementVisible(settings: unknown, now: Date = new Date()): boolean {
  const until = obj(settings).visibleUntil;
  if (typeof until !== "string") return true;
  const t = new Date(until).getTime();
  return !Number.isFinite(t) || now.getTime() <= t;
}

/** Sloučí volby formuláře do stávajícího settings (zachová např. `plan`). */
export function mergeKindSettings(current: Settings, patch: {
  kind: AssignmentKind; lateUntil?: string | null; pinned?: boolean; visibleUntil?: string | null;
}): Record<string, unknown> {
  const next: Record<string, unknown> = { ...obj(current) };
  delete next.kind; delete next.lateUntil; delete next.pinned; delete next.visibleUntil;
  if (patch.kind !== "task") next.kind = patch.kind;
  if (patch.kind === "task" && patch.lateUntil) next.lateUntil = patch.lateUntil;
  if (patch.kind === "announcement") {
    if (patch.pinned) next.pinned = true;
    if (patch.visibleUntil) next.visibleUntil = patch.visibleUntil;
  }
  return next;
}
