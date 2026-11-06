/**
 * Materiály hodiny (`lesson_topics.materials`): kromě odkazů a souborů i položky
 * z učitelovy knihovny (`kind: "content"`). Úkoly tento druh nepoužívají –
 * `parseMaterials` v assignment-materials.ts ho přeskočí.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseMaterials, type AssignmentMaterial } from "@/lib/assignment-materials";
import { resolveLinkedLesson, type LessonSource } from "@/lib/linked-lesson";

/** Aktivity (šablony her) se záměrně nenabízejí – bývají součástí učebnice. */
export type LessonContentType = "worksheet" | "presentation" | "lesson";
export const LESSON_CONTENT_TYPES: LessonContentType[] = ["worksheet", "presentation", "lesson"];

export interface LessonContentMaterial {
  id: string;
  kind: "content";
  contentType: LessonContentType;
  refId: string;
  title: string;
  /** U lekce zdroj (globální / učitelská učebnice). */
  lessonSource?: LessonSource;
}

export type LessonMaterial = AssignmentMaterial | LessonContentMaterial;

export const CONTENT_TYPE_LABEL: Record<LessonContentType, string> = {
  worksheet: "Pracovní list",
  presentation: "Prezentace",
  lesson: "Lekce učebnice",
};

export function isContentMaterial(m: unknown): m is LessonContentMaterial {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return (
    x.kind === "content" &&
    typeof x.refId === "string" && !!x.refId &&
    typeof x.contentType === "string" &&
    (LESSON_CONTENT_TYPES as string[]).includes(x.contentType)
  );
}

/** Bezpečně přečte materiály hodiny: odkazy, soubory a položky knihovny; neznámé druhy přeskočí. */
export function parseLessonMaterials(value: unknown): LessonMaterial[] {
  if (!Array.isArray(value)) return [];
  const out: LessonMaterial[] = [];
  for (const m of value) {
    if (isContentMaterial(m)) out.push({ ...m, title: m.title || CONTENT_TYPE_LABEL[m.contentType] });
    else out.push(...parseMaterials([m]));
  }
  return out;
}

export function splitLessonMaterials(list: LessonMaterial[]): { basic: AssignmentMaterial[]; content: LessonContentMaterial[] } {
  const content = list.filter(isContentMaterial);
  const basic = list.filter((m): m is AssignmentMaterial => !isContentMaterial(m));
  return { basic, content };
}

/** Přidá položku knihovny; stejný obsah se nepřidá dvakrát. */
export function addContentMaterial(list: LessonContentMaterial[], item: Omit<LessonContentMaterial, "id" | "kind">, id: string = crypto.randomUUID()): LessonContentMaterial[] {
  if (list.some((m) => m.contentType === item.contentType && m.refId === item.refId)) return list;
  return [...list, { id, kind: "content", ...item }];
}

export interface ResolvedContent { href: string | null }

/**
 * Ověří dostupnost položek pod oprávněním aktuálního uživatele (jen čtení).
 * `href: null` = materiál už není dostupný (smazaný nebo nepřístupný).
 * Žák nemá prohlížeč prezentací – prezentace mu vrátí null.
 */
export async function resolveContentMaterials(
  items: LessonContentMaterial[],
  role: "teacher" | "student",
): Promise<Record<string, ResolvedContent>> {
  const out: Record<string, ResolvedContent> = {};
  const ws = items.filter((m) => m.contentType === "worksheet").map((m) => m.refId);
  const pr = items.filter((m) => m.contentType === "presentation").map((m) => m.refId);
  const [wsRes, prRes] = await Promise.all([
    ws.length ? supabase.from("worksheets").select("id").in("id", ws) : Promise.resolve({ data: [] as any[] }),
    pr.length && role === "teacher" ? supabase.from("teacher_presentations").select("id").in("id", pr) : Promise.resolve({ data: [] as any[] }),
  ]);
  const wsOk = new Set(((wsRes as any).data ?? []).map((r: any) => r.id));
  const prOk = new Set(((prRes as any).data ?? []).map((r: any) => r.id));
  for (const m of items) {
    if (m.contentType === "worksheet") {
      out[m.id] = { href: wsOk.has(m.refId) ? (role === "teacher" ? `/ucitel/pracovni-listy/${m.refId}` : `/student/pracovni-list/${m.refId}`) : null };
    } else if (m.contentType === "presentation") {
      out[m.id] = { href: prOk.has(m.refId) ? `/ucitel/prezentace?open=${m.refId}` : null };
    }
  }
  await Promise.all(
    items.filter((m) => m.contentType === "lesson").map(async (m) => {
      try {
        const info = await resolveLinkedLesson(m.refId, m.lessonSource ?? "teacher_textbook_lessons");
        let href = info?.url ?? null;
        if (href && role === "teacher" && m.lessonSource !== "textbook_lessons") {
          const tb = href.match(/\/student\/ucebnice\/([^?]+)/)?.[1];
          href = tb ? `/ucitel/ucebnice/${tb}?lesson=${m.refId}` : "/ucitel/ucebnice";
        }
        out[m.id] = { href };
      } catch {
        out[m.id] = { href: null };
      }
    }),
  );
  return out;
}
