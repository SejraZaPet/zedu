/**
 * Sjednocení sazby snímků.
 *
 * Starší snímky (např. AI plány nebo automatický úvod/shrnutí) nemají `blocks`,
 * jen `projector.headline` / `projector.body`, případně `tableData`/`cardData`.
 * Aby se vykreslovaly stejnou typografií a se stejným "scale-to-fit" chováním
 * jako blokové snímky, dopočítáme jim bloky a necháme je vykreslit `SlideCanvas`.
 */

let seq = 0;
const nextId = () => `fb-${++seq}`;

/** Rozdělí textové tělo snímku na odstavce a odrážkové seznamy. */
function bodyToBlocks(body: string): any[] {
  const lines = String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: any[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push({ id: nextId(), type: "bullet_list", props: { items: bullets } });
    bullets = [];
  };

  for (const line of lines) {
    if (line.startsWith("•") || line.startsWith("-") || line.startsWith("✓")) {
      bullets.push(line.replace(/^[•\-✓]\s*/, ""));
      continue;
    }
    flushBullets();
    blocks.push({ id: nextId(), type: "paragraph", props: { text: line } });
  }
  flushBullets();
  return blocks;
}

/**
 * Vrátí snímek vhodný pro `SlideCanvas`. Když už bloky má, vrací ho nezměněný.
 */
export function slideWithFallbackBlocks(slide: any): any {
  if (!slide) return slide;
  if (Array.isArray(slide.blocks) && slide.blocks.length > 0) return slide;

  const blocks: any[] = [];

  if (slide.tableData?.headers || slide.tableData?.rows) {
    blocks.push({
      id: nextId(),
      type: "table",
      props: {
        headers: slide.tableData.headers || [],
        rows: slide.tableData.rows || [],
      },
    });
  } else if (Array.isArray(slide.cardData) && slide.cardData.length > 0) {
    blocks.push({
      id: nextId(),
      type: "card_grid",
      props: { cards: slide.cardData, columns: slide.cardData.length >= 3 ? 3 : 2 },
    });
  } else if (slide.projector?.body) {
    blocks.push(...bodyToBlocks(slide.projector.body));
  }

  if (blocks.length === 0 && !slide.projector?.headline) return slide;

  return { ...slide, blocks };
}

/** Všechny obrázky použité na snímku (pro přednačtení dalšího snímku). */
export function slideImageUrls(slide: any): string[] {
  if (!slide) return [];
  const urls: string[] = [];
  const push = (u: any) => {
    if (typeof u === "string" && /^(https?:|\/|data:)/.test(u)) urls.push(u);
  };

  push(slide.heroImage);
  (slide.projector?.assetRefs || []).forEach(push);

  const walk = (blocks: any[]) => {
    for (const b of blocks || []) {
      const p = b?.props || {};
      push(p.url);
      push(p.src);
      push(p.imageUrl);
      (p.images || []).forEach((img: any) => push(img?.url));
      if (Array.isArray(p.children)) walk(p.children);
    }
  };
  walk(slide.blocks || []);

  return Array.from(new Set(urls));
}
