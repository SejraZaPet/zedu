/** Přiložené aktivity ke kroku (fázi) plánu hodiny. Čisté funkce – testovatelné bez UI. */
import { teacherPresentationHref, teacherWorksheetHref } from "@/lib/plan-links";

export type AttachedItemType = "worksheet" | "game_template" | "presentation" | "lesson" | "link";

export interface AttachedItem {
  type: AttachedItemType;
  /** Interní id (u linku prázdné). */
  id?: string;
  /** Externí URL (jen type "link"). */
  url?: string;
  title: string;
  /** U lekce: zdroj a učebnice pro sestavení cesty. */
  lessonSource?: string | null;
  textbookId?: string | null;
}

export const ATTACHED_TYPE_LABEL: Record<AttachedItemType, string> = {
  worksheet: "Pracovní list",
  game_template: "Hra / kvíz",
  presentation: "Prezentace",
  lesson: "Lekce z učebnice",
  link: "Externí odkaz",
};

/** Povolené jsou jen http(s) adresy. Vrátí normalizovanou URL nebo null. */
export function validateExternalUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Interní cesta k přiložené položce; u externího odkazu null (otevírá se URL). */
export function attachedHref(item: AttachedItem): string | null {
  switch (item.type) {
    case "worksheet":
      return item.id ? teacherWorksheetHref(item.id) : null;
    case "game_template":
      return "/ucitel/hry";
    case "presentation":
      return item.id ? teacherPresentationHref(item.id) : null;
    case "lesson":
      if (!item.id) return null;
      if (item.lessonSource === "textbook_lessons") return `/ucebnice/obsah/0/lekce/${item.id}`;
      return item.textbookId ? `/ucitel/ucebnice/${item.textbookId}?lesson=${item.id}` : "/ucitel/ucebnice";
    case "link":
      return null;
  }
}

/** Přidá položku k fázi; stejná položka (type+id/url) se nepřidá dvakrát. */
export function addAttached<T extends { attached?: AttachedItem[] }>(phase: T, item: AttachedItem): T {
  const list = phase.attached ?? [];
  const dup = list.some(
    (a) => a.type === item.type && (item.id ? a.id === item.id : a.url === item.url),
  );
  if (dup) return phase;
  return { ...phase, attached: [...list, item] };
}

/** Odebere jen propojení s krokem – samotná aktivita zůstává učiteli. */
export function removeAttached<T extends { attached?: AttachedItem[] }>(phase: T, index: number): T {
  const list = phase.attached ?? [];
  return { ...phase, attached: list.filter((_, i) => i !== index) };
}

/** Bezpečné čtení přiložených položek z uložených dat. */
export function parseAttached(value: unknown): AttachedItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is AttachedItem =>
      !!a && typeof a === "object" && typeof (a as any).type === "string" && typeof (a as any).title === "string",
  );
}
