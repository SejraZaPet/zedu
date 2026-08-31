import type { Block } from "@/lib/textbook-config";

/** Strukturovaná šablona předmětového ŠVP (Markdown) – ponechána pro starší záznamy. */
const yearTable = (year: number) => `### ${year}. ročník

| Výsledky vzdělávání | Učivo | Časové rozvržení |
|---|---|---|
|  |  |  |
`;

export const CURRICULUM_PLAN_TEMPLATE = `## Pojetí a cíl předmětu



## Charakteristika učiva

(včetně mezipředmětových vztahů)


## Strategie výuky

### Metody výuky


### Metody ověřování


## Hodnocení výsledků žáků



## Přínos ke klíčovým kompetencím a průřezovým tématům



## Rozpis učiva a výsledků vzdělávání

${[1, 2, 3].map(yearTable).join("\n")}`;

// ───────────────────────── Blokové sekce ŠVP ─────────────────────────

/** Sekce šablony předmětového ŠVP (heading + paragraph pár). */
export const CURRICULUM_SECTIONS: { heading: string; placeholder: string }[] = [
  { heading: "Pojetí a cíl předmětu", placeholder: "Popište pojetí a hlavní cíle předmětu…" },
  {
    heading: "Charakteristika učiva",
    placeholder: "Charakteristika učiva včetně mezipředmětových vztahů…",
  },
  { heading: "Strategie výuky – Metody výuky", placeholder: "Jaké metody výuky používáte…" },
  {
    heading: "Strategie výuky – Metody ověřování",
    placeholder: "Jak ověřujete dosažení výsledků vzdělávání…",
  },
  { heading: "Hodnocení výsledků žáků", placeholder: "Pravidla a kritéria hodnocení…" },
  {
    heading: "Přínos ke klíčovým kompetencím a průřezovým tématům",
    placeholder: "Které klíčové kompetence a průřezová témata předmět rozvíjí…",
  },
];

export const CURRICULUM_TABLE_HEADERS = ["Výsledky vzdělávání", "Učivo", "Časové rozvržení"];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `blk-${Math.random().toString(36).slice(2)}`;

const emptyRows = (count = 3) =>
  Array.from({ length: count }, () => CURRICULUM_TABLE_HEADERS.map(() => ""));

/**
 * Vygeneruje strukturované bloky předmětového ŠVP:
 * heading+paragraph pár pro každou sekci + jednu tabulku rozpisu učiva na ročník.
 */
export function buildCurriculumBlocks(years = 3): Block[] {
  const blocks: Block[] = [];

  for (const section of CURRICULUM_SECTIONS) {
    blocks.push({
      id: uid(),
      type: "heading",
      visible: true,
      props: { level: 2, text: section.heading },
    });
    blocks.push({
      id: uid(),
      type: "paragraph",
      visible: true,
      props: { text: "", placeholder: section.placeholder },
    });
  }

  blocks.push({
    id: uid(),
    type: "heading",
    visible: true,
    props: { level: 2, text: "Rozpis učiva a výsledků vzdělávání" },
  });

  for (let year = 1; year <= years; year++) {
    blocks.push({
      id: uid(),
      type: "heading",
      visible: true,
      props: { level: 3, text: `${year}. ročník` },
    });
    blocks.push({
      id: uid(),
      type: "table",
      visible: true,
      props: { headers: [...CURRICULUM_TABLE_HEADERS], rows: emptyRows() },
    });
  }

  return blocks;
}

/** Starý textový ŠVP → jeden textový blok (fallback při prvním otevření v novém editoru). */
export function legacyContentToBlocks(content: string | null): Block[] {
  const text = (content ?? "").trim();
  if (!text) return [];
  return [{ id: uid(), type: "paragraph", visible: true, props: { text } }];
}

const stripHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/**
 * Prostý textový souhrn bloků – ukládá se do starého sloupce `content`
 * kvůli zpětné kompatibilitě (náhled na kartě, AI extrakce témat).
 */
export function curriculumBlocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.visible === false) continue;
    const p = b.props ?? {};
    switch (b.type) {
      case "heading": {
        const level = Number(p.level) || 2;
        const text = stripHtml(p.text);
        if (text) parts.push(`${"#".repeat(level)} ${text}`);
        break;
      }
      case "table": {
        const headers: string[] = Array.isArray(p.headers) ? p.headers : [];
        const rows: string[][] = Array.isArray(p.rows) ? p.rows : [];
        if (headers.length) parts.push(headers.map((h) => stripHtml(h)).join(" | "));
        for (const row of rows) {
          const cells = (row ?? []).map((c) => stripHtml(c));
          if (cells.some((c) => c)) parts.push(cells.join(" | "));
        }
        break;
      }
      case "bullet_list": {
        const items: string[] = Array.isArray(p.items) ? p.items : [];
        for (const it of items) {
          const t = stripHtml(it);
          if (t) parts.push(`- ${t}`);
        }
        if (!items.length && p.html) {
          const t = stripHtml(p.html);
          if (t) parts.push(t);
        }
        break;
      }
      default: {
        const text = stripHtml(p.text ?? p.html ?? p.content);
        if (text) parts.push(text);
      }
    }
  }
  return parts.join("\n\n").trim();
}
