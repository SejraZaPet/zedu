/**
 * Zdroje aktivit pro vložení do prezentace: vlastní lekce (i vnořené bloky)
 * a sady ze Studia. Čisté funkce – načítání dělá komponenta přes RLS učitele.
 */
export interface FoundActivityBlock { block: any; path: string }

const isBlock = (v: any) => v && typeof v === "object" && typeof v.type === "string" && v.props && typeof v.props === "object";

/** Najde bloky typu `activity` v libovolné hloubce (sloupce, skupiny/snímky, děti). */
export function collectActivityBlocks(blocks: any[] | null | undefined, path = ""): FoundActivityBlock[] {
  const out: FoundActivityBlock[] = [];
  (Array.isArray(blocks) ? blocks : []).forEach((b, i) => {
    if (!isBlock(b)) return;
    const p = path ? `${path}.${i}` : String(i);
    if (b.type === "activity") { out.push({ block: b, path: p }); return; }
    for (const [k, v] of Object.entries(b.props)) {
      if (Array.isArray(v) && v.some(isBlock)) out.push(...collectActivityBlocks(v, `${p}.${k}`));
    }
  });
  return out;
}

export interface StudioActivity { key: string; templateTitle: string; title: string; activityType: string; slide: any }

/** Hratelné kroky ze sad Studia (slidy s aktivitou). Kroky „studio_step“ se vkládají také – při spuštění se nahlásí. */
export function collectStudioActivities(templates: { id: string; title: string; activity_data: any[] }[]): StudioActivity[] {
  const out: StudioActivity[] = [];
  for (const t of templates ?? []) {
    (Array.isArray(t.activity_data) ? t.activity_data : []).forEach((s: any, i: number) => {
      if (!s || (s.type !== "activity" && s.type !== "studio_step") || !s.activitySpec) return;
      out.push({
        key: `${t.id}-${s.slideId || i}`,
        templateTitle: t.title || "Sada bez názvu",
        title: String(s.activitySpec?.question || s.projector?.headline || "Aktivita"),
        activityType: String(s.studioStepType || s.activitySpec?.activityType || ""),
        slide: s,
      });
    });
  }
  return out;
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Kopie slidu ze Studia s novým ID (originál ve Studiu zůstane beze změny). */
export function cloneStudioSlide(slide: any): any {
  const copy = JSON.parse(JSON.stringify(slide));
  copy.slideId = uid();
  if (Array.isArray(copy.blocks)) copy.blocks = copy.blocks.map((b: any) => ({ ...b, id: uid() }));
  return copy;
}
