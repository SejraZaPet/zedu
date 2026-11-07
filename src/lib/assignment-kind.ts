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

/** E-mail žákům při zveřejnění: chybí-li volba, úkol a oznámení ano, materiál ne. */
export function notifyEmailEnabled(settings: unknown): boolean {
  const v = obj(settings).notifyEmail;
  return typeof v === "boolean" ? v : assignmentKind(settings) !== "material";
}
/** Automatické upozornění „neodevzdáno“: jen úkol, výchozí zapnuto. */
export function notifyOverdueEnabled(settings: unknown): boolean {
  if (assignmentKind(settings) !== "task") return false;
  return obj(settings).notifyOverdue !== false;
}

/** Sloučí volby formuláře do stávajícího settings (zachová např. `plan`). */
export function mergeKindSettings(current: Settings, patch: {
  kind: AssignmentKind; lateUntil?: string | null; pinned?: boolean; visibleUntil?: string | null;
  notifyEmail?: boolean | null; notifyOverdue?: boolean | null; commentsEnabled?: boolean | null;
}): Record<string, unknown> {
  const next: Record<string, unknown> = { ...obj(current) };
  delete next.kind; delete next.lateUntil; delete next.pinned; delete next.visibleUntil;
  if (typeof patch.notifyEmail === "boolean") next.notifyEmail = patch.notifyEmail;
  if (typeof patch.commentsEnabled === "boolean") next.commentsEnabled = patch.commentsEnabled;
  if (patch.kind === "task" && typeof patch.notifyOverdue === "boolean") next.notifyOverdue = patch.notifyOverdue;
  else if (patch.kind !== "task") delete next.notifyOverdue;
  if (patch.kind !== "task") next.kind = patch.kind;
  if (patch.kind === "task" && patch.lateUntil) next.lateUntil = patch.lateUntil;
  if (patch.kind === "announcement") {
    if (patch.pinned) next.pinned = true;
    if (patch.visibleUntil) next.visibleUntil = patch.visibleUntil;
  }
  return next;
}

/** Počty položek podle druhu (úkol / materiál / oznámení). */
export function countByKind(items: { settings?: unknown }[]): Record<AssignmentKind, number> {
  const out: Record<AssignmentKind, number> = { task: 0, material: 0, announcement: 0 };
  for (const i of items) out[assignmentKind(i.settings)]++;
  return out;
}

/** Druh z URL `?kind=` (neznámá hodnota = null, formulář pak zůstane u úkolu). */
export function kindFromParam(v: string | null | undefined): AssignmentKind | null {
  return v === "task" || v === "material" || v === "announcement" ? v : null;
}

/** Pod-záložky v záložce Práce (`?sekce=`). */
export type KindSection = "ukoly" | "materialy" | "oznameni";
export const SECTION_KIND: Record<KindSection, AssignmentKind> = { ukoly: "task", materialy: "material", oznameni: "announcement" };
export const KIND_SECTION: Record<AssignmentKind, KindSection> = { task: "ukoly", material: "materialy", announcement: "oznameni" };
/** Neplatná/chybějící hodnota = null (volající pak použije uloženou nebo Úkoly). */
export function sectionFromParam(v: string | null | undefined): KindSection | null {
  return v === "ukoly" || v === "materialy" || v === "oznameni" ? v : null;
}
/** Položky jednoho druhu; oznámení: jen viditelná (učitel vidí i prošlá), připnutá první. */
export function filterByKind<T extends { settings?: unknown }>(items: T[], kind: AssignmentKind, opts: { teacher?: boolean; now?: Date } = {}): T[] {
  const list = items.filter((i) => assignmentKind(i.settings) === kind);
  if (kind === "task") return list;
  // Materiály a oznámení: od nejnovějších (bez created_at pořadí beze změny).
  const t = (i: T) => { const v = (i as { created_at?: string }).created_at; const n = v ? new Date(v).getTime() : NaN; return Number.isFinite(n) ? n : -Infinity; };
  list.sort((a, b) => t(b) - t(a));
  if (kind !== "announcement") return list;
  const vis = opts.teacher ? list : list.filter((i) => announcementVisible(i.settings, opts.now));
  return [...vis.filter((i) => isPinned(i.settings)), ...vis.filter((i) => !isPinned(i.settings))];
}
