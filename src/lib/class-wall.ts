/**
 * Zeď třídy: čisté skládání feedu z `assignments` a pravidla komentářů
 * (`assignment_comments`). Server pravidla vynucuje sám (RLS + triggery);
 * tyto funkce jen řídí, co UI nabídne.
 */
import { announcementVisible, assignmentKind, isPinned } from "@/lib/assignment-kind";

export const WALL_PAGE = 10;
export const COMMENTS_PREVIEW = 3;
export const COMMENT_MAX = 1000;

export interface WallItem {
  id: string;
  status?: string | null;
  created_at?: string | null;
  settings?: unknown;
}
export interface WallComment {
  id: string;
  assignment_id: string;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at?: string | null;
}

const ts = (v?: string | null) => { const n = v ? new Date(v).getTime() : NaN; return Number.isFinite(n) ? n : -Infinity; };
const obj = (s: unknown): Record<string, unknown> => (s && typeof s === "object" && !Array.isArray(s) ? s as Record<string, unknown> : {});

/** Komentáře povolené? Chybí-li volba: úkol vypnuto, materiál a oznámení zapnuto (stejně jako DB). */
export function commentsEnabled(settings: unknown): boolean {
  const v = obj(settings).commentsEnabled;
  return typeof v === "boolean" ? v : assignmentKind(settings) !== "task";
}

/** Feed: jen zveřejněné, oznámení jen dokud jsou viditelná, od nejnovějších. */
export function buildWallFeed<T extends WallItem>(items: T[], now: Date = new Date()): T[] {
  return items
    .filter((i) => (i.status ?? "published") === "published")
    .filter((i) => assignmentKind(i.settings) !== "announcement" || announcementVisible(i.settings, now))
    .sort((a, b) => ts(b.created_at) - ts(a.created_at));
}

export const WALL_PREVIEW = 5;

/** Hlavní seznam Zdi: připnuté první, jinak od nejnovějších (stabilně). */
export function wallOrdered<T extends WallItem>(feed: T[]): T[] {
  return [...feed.filter((i) => isPinned(i.settings)), ...feed.filter((i) => !isPinned(i.settings))];
}

/** Viditelná část: sbaleno = max `WALL_PREVIEW`, rozbaleno = `limit`. */
export function wallVisible<T extends WallItem>(feed: T[], expanded: boolean, limit: number): { shown: T[]; canExpand: boolean; hasMore: boolean } {
  const ordered = wallOrdered(feed);
  const max = expanded ? limit : WALL_PREVIEW;
  return { shown: ordered.slice(0, max), canExpand: !expanded && ordered.length > WALL_PREVIEW, hasMore: expanded && ordered.length > limit };
}

/** Blok „Oznámení“: max `limit` viditelných, připnutá první, jinak od nejnovějších. */
export function wallAnnouncements<T extends WallItem>(items: T[], limit = 3, now: Date = new Date()): T[] {
  const list = buildWallFeed(items, now).filter((i) => assignmentKind(i.settings) === "announcement");
  return [...list.filter((i) => isPinned(i.settings)), ...list.filter((i) => !isPinned(i.settings))].slice(0, limit);
}

/** Autor smí upravit jen nesmazaný vlastní komentář, pod kterým ještě nepřibyl novější od jiného autora. */
export function canEditComment(c: WallComment, all: WallComment[], uid: string | null | undefined): boolean {
  if (!uid || c.author_id !== uid || c.deleted_at) return false;
  const t = ts(c.created_at);
  return !all.some((o) => o.assignment_id === c.assignment_id && o.author_id !== c.author_id && ts(o.created_at) > t);
}
export function canDeleteComment(c: WallComment, uid: string | null | undefined, moderator: boolean): boolean {
  if (!uid) return false;
  if (moderator) return !c.deleted_at;
  return c.author_id === uid && !c.deleted_at;
}

/** Komentáře k příspěvku od nejstarších; náhled = posledních `COMMENTS_PREVIEW`. */
export function threadFor(all: WallComment[], assignmentId: string, expanded: boolean): { shown: WallComment[]; hidden: number } {
  const list = all.filter((c) => c.assignment_id === assignmentId).sort((a, b) => ts(a.created_at) - ts(b.created_at));
  if (expanded || list.length <= COMMENTS_PREVIEW) return { shown: list, hidden: 0 };
  return { shown: list.slice(-COMMENTS_PREVIEW), hidden: list.length - COMMENTS_PREVIEW };
}

/** Srozumitelné chyby z triggerů/RLS. */
export function commentErrorMessage(msg: string | undefined | null): string {
  const m = msg ?? "";
  if (m.includes("comment_rate_limit")) return "Za hodinu můžete napsat nejvýše 30 komentářů.";
  if (m.includes("comment_edit_locked")) return "Komentář už nejde upravit – pod ním je novější odpověď.";
  if (m.includes("comment_moderator_cannot_edit")) return "Cizí komentář nelze upravit, jen skrýt.";
  if (m.includes("row-level security")) return "Sem teď komentovat nelze (komentáře jsou vypnuté nebo k příspěvku nemáte přístup).";
  return "Komentář se nepodařilo uložit.";
}
