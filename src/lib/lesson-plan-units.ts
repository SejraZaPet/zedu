import { flattenLessonBlocks } from "@/lib/lesson-content-splitter";

/** Celek lekce pro výběr v plánu hodiny. */
export interface LessonUnit {
  id: string;
  title: string;
  blockIds: string[];
  blocks: any[];
}

export const LESSON_MINUTES_PRESETS = [30, 45, 60, 90] as const;
export const DEFAULT_LESSON_MINUTES = 45;

export function clampLessonMinutes(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_LESSON_MINUTES;
  return Math.min(180, Math.max(10, v));
}

const strip = (s: unknown) =>
  typeof s === "string" ? s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

function blockText(b: any): string {
  const p = b?.props ?? {};
  const cands = [p.text, p.title, b?.title, b?.text, p.caption, p.content];
  for (const c of cands) {
    const t = strip(c);
    if (t) return t;
  }
  if (Array.isArray(p.items)) {
    const first = p.items.map((i: any) => strip(typeof i === "string" ? i : i?.text)).find(Boolean);
    if (first) return first;
  }
  return "";
}

/** Stabilní klíč bloku: id, jinak pozice v rozbaleném seznamu. */
export function lessonBlockKey(b: any, flatIndex: number): string {
  return typeof b?.id === "string" && b.id ? b.id : `idx-${flatIndex}`;
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Rozdělí lekci na celky: podle nadpisů (≥ 3), jinak podle karet (slide_group),
 * jinak po souvislých skupinách ~5 bloků.
 */
export function buildLessonUnits(blocks: unknown): LessonUnit[] {
  const flat = flattenLessonBlocks(blocks).map((f, i) => ({ ...f, key: lessonBlockKey(f.block, i) }));
  if (!flat.length) return [];

  const headings = flat.filter((f) => f.block?.type === "heading");
  const units: LessonUnit[] = [];
  const push = (title: string, items: typeof flat) => {
    if (!items.length) return;
    units.push({
      id: `u${units.length}-${items[0].key}`,
      title: short(title || "Bez názvu"),
      blockIds: items.map((i) => i.key),
      blocks: items.map((i) => i.block),
    });
  };

  if (headings.length >= 3) {
    // Úroveň nadpisu: celek končí nadpisem stejné nebo vyšší úrovně (menší číslo).
    let cur: typeof flat = [];
    let curTitle = "Úvod";
    let curLevel = 0; // 0 = úvod, ukončí ho jakýkoli nadpis
    for (const f of flat) {
      if (f.block?.type === "heading") {
        const level = Number(f.block.props?.level) || 2;
        if (curLevel === 0 || level <= curLevel) {
          push(curTitle, cur);
          cur = [];
          curTitle = blockText(f.block) || "Bez názvu";
          curLevel = level;
        }
      }
      cur.push(f);
    }
    push(curTitle, cur);
    return units;
  }

  const hasGroups =
    Array.isArray(blocks) && (blocks as any[]).some((b) => b?.type === "slide_group" && b.visible !== false);
  if (hasGroups) {
    const byTop = new Map<number, typeof flat>();
    for (const f of flat) {
      const arr = byTop.get(f.topIndex) ?? [];
      arr.push(f);
      byTop.set(f.topIndex, arr);
    }
    // Sousední samostatné bloky mimo karty slouč dohromady.
    let loose: typeof flat = [];
    for (const [, items] of byTop) {
      if (items[0].nested) {
        if (loose.length) { push(blockText(loose.find((x) => blockText(x.block))?.block), loose); loose = []; }
        push(blockText(items.find((x) => blockText(x.block))?.block), items);
      } else {
        loose.push(...items);
      }
    }
    if (loose.length) push(blockText(loose.find((x) => blockText(x.block))?.block), loose);
    return units;
  }

  for (let i = 0; i < flat.length; i += 5) {
    const items = flat.slice(i, i + 5);
    push(blockText(items.find((x) => blockText(x.block))?.block), items);
  }
  return units;
}
