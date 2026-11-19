/** Malý markdown parser pro právní texty: nadpisy, odstavce, seznamy, tabulky, **tučné**, [odkazy](url). */
export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\*\*/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sekce";
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: MdBlock[] = [];
  const used = new Map<string, number>();
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ type: "paragraph", text: para.join(" ") }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(4, Math.max(1, h[1].length)) as 1 | 2 | 3 | 4;
      const base = slugify(h[2]); const n = used.get(base) ?? 0; used.set(base, n + 1);
      out.push({ type: "heading", level, text: h[2].trim(), id: n ? `${base}-${n + 1}` : base });
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const header = cells(line); const rows: string[][] = []; i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      i--; out.push({ type: "table", header, rows }); continue;
    }
    const li = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]); const items = [li[2]];
      while (i + 1 < lines.length) {
        const m = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(lines[i + 1]);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        items.push(m[2]); i++;
      }
      out.push({ type: "list", ordered, items }); continue;
    }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return out;
}

export type Inline = { t: "text" | "bold"; v: string } | { t: "link"; v: string; href: string };
export function parseInline(s: string): Inline[] {
  const out: Inline[] = []; const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g; let last = 0; let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "bold", v: m[1] });
    else out.push({ t: "link", v: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}
/** Jen bezpečné odkazy (relativní, https, mailto). */
export const safeHref = (h: string) => (/^(\/|#|https:\/\/|mailto:)/.test(h) ? h : "#");
