/**
 * Offline export lekce do samostatného HTML souboru (inline CSS, bez závislosti
 * na aplikaci). Interaktivní aktivity se vynechávají – místo nich je poznámka.
 */

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Povolené inline tagy z uloženého HTML; zbytek se odstraní. */
const sanitizeInlineHtml = (html: string): string => {
  const allowed = /^(b|strong|i|em|u|s|sup|sub|br|p|ul|ol|li|mark|span|h1|h2|h3|h4|a)$/i;
  return String(html ?? "").replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag: string, attrs: string) => {
    if (!allowed.test(tag)) return "";
    if (tag.toLowerCase() === "a") {
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
      return full.startsWith("</") ? "</a>" : `<a href="${esc(href)}">`;
    }
    return full.startsWith("</") ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`;
  });
};

const toDataUri = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return url;
    const blob = await res.blob();
    if (blob.size > 3_000_000) return url;
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};

const ACTIVITY_NOTE =
  '<div class="note">Tuhle aktivitu udělej po připojení k internetu.</div>';

const renderBlock = async (block: any): Promise<string> => {
  const p = block?.props || {};
  switch (block?.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(p.level) || 2, 1), 4);
      return `<h${level}>${sanitizeInlineHtml(p.text || "")}</h${level}>`;
    }
    case "paragraph":
      return `<div class="text">${sanitizeInlineHtml(p.text || "")}</div>`;
    case "bullet_list": {
      if (p.html) return `<div class="text">${sanitizeInlineHtml(p.html)}</div>`;
      const items = Array.isArray(p.items) ? p.items : [];
      if (items.length === 0) return "";
      return `<ul>${items.map((i: any) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    }
    case "callout":
      return `<div class="callout">${sanitizeInlineHtml(p.text || "")}</div>`;
    case "summary":
      return `<div class="summary"><strong>${esc(p.title || "Shrnutí lekce")}</strong>${sanitizeInlineHtml(p.text || "")}</div>`;
    case "quote":
      return `<blockquote>${esc(p.text || "")}${p.author ? `<cite>— ${esc(p.author)}</cite>` : ""}</blockquote>`;
    case "two_column":
      return `<div class="cols"><div class="text">${sanitizeInlineHtml(p.left || "")}</div><div class="text">${sanitizeInlineHtml(p.right || "")}</div></div>`;
    case "image": {
      if (!p.url) return "";
      const src = await toDataUri(p.url);
      return `<figure><img src="${esc(src)}" alt="${esc(p.caption || "")}" />${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`;
    }
    case "image_text": {
      const src = p.imageUrl ? await toDataUri(p.imageUrl) : "";
      return `<div class="cols">${src ? `<figure><img src="${esc(src)}" alt="" /></figure>` : ""}<div class="text">${sanitizeInlineHtml(p.text || "")}</div></div>`;
    }
    case "gallery": {
      const images = Array.isArray(p.images) ? p.images : [];
      const parts: string[] = [];
      for (const img of images) {
        if (!img?.url) continue;
        const src = await toDataUri(img.url);
        parts.push(`<figure><img src="${esc(src)}" alt="${esc(img.caption || "")}" />${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ""}</figure>`);
      }
      return parts.length ? `<div class="gallery">${parts.join("")}</div>` : "";
    }
    case "card_grid": {
      const cards = Array.isArray(p.cards) ? p.cards : [];
      if (cards.length === 0) return "";
      return `<div class="cards">${cards
        .map((c: any) => `<div class="card"><strong>${esc(c?.title || "")}</strong><div>${sanitizeInlineHtml(c?.text || "")}</div></div>`)
        .join("")}</div>`;
    }
    case "table": {
      const headers = Array.isArray(p.headers) ? p.headers : [];
      const rows = Array.isArray(p.rows) ? p.rows : [];
      if (headers.length === 0 && rows.length === 0) return "";
      return `<table><thead><tr>${headers.map((h: any) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r: any[]) => `<tr>${(Array.isArray(r) ? r : []).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    }
    case "accordion": {
      const items = Array.isArray(p.items) ? p.items : [];
      return items
        .map((i: any) => `<details open><summary>${esc(i?.title || "")}</summary><div class="text">${sanitizeInlineHtml(i?.content || "")}</div></details>`)
        .join("");
    }
    case "hierarchy": {
      const levels = Array.isArray(p.levels) ? p.levels : [];
      if (levels.length === 0) return "";
      return `<ol class="levels">${levels
        .map((l: any) => `<li><strong>${esc(l?.label || "")}</strong>${l?.description ? ` – ${esc(l.description)}` : ""}</li>`)
        .join("")}</ol>`;
    }
    case "formula":
      return p.latex ? `<pre class="formula">${esc(p.latex)}</pre>` : "";
    case "activity":
      return `<div class="activity"><strong>${esc(p.title || "Aktivita")}</strong>${ACTIVITY_NOTE}</div>`;
    case "youtube":
    case "video":
    case "audio":
    case "embed":
      return p.url
        ? `<div class="activity"><strong>${esc(p.title || p.caption || "Externí obsah")}</strong>${ACTIVITY_NOTE}<div class="small">${esc(p.url)}</div></div>`
        : "";
    case "divider":
      return "<hr />";
    case "slide_group": {
      const children = Array.isArray(p.children) ? p.children : [];
      const rendered: string[] = [];
      for (const c of children) {
        if (!c || c.visible === false) continue;
        rendered.push(await renderBlock(c));
      }
      return rendered.join("");
    }
    default:
      return "";
  }
};

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 16px 64px; font-family: Georgia, "Times New Roman", serif; color: #1c2430; background: #fbfbfd; line-height: 1.65; }
main { max-width: 720px; margin: 0 auto; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 8px; }
h2 { font-size: 1.45rem; margin: 32px 0 8px; }
h3 { font-size: 1.2rem; margin: 24px 0 6px; }
h4 { font-size: 1.05rem; margin: 20px 0 6px; }
.meta { color: #6b7684; font-size: .85rem; margin-bottom: 32px; }
.text, ul, ol, table, blockquote { margin: 0 0 16px; }
ul, ol { padding-left: 24px; }
img { max-width: 100%; height: auto; border-radius: 8px; }
figure { margin: 0 0 16px; }
figcaption { font-size: .85rem; color: #6b7684; text-align: center; margin-top: 6px; }
blockquote { border-left: 4px solid #6EC6D9; margin-left: 0; padding: 4px 0 4px 16px; font-style: italic; }
blockquote cite { display: block; font-style: normal; font-size: .85rem; color: #6b7684; margin-top: 6px; }
.callout { border-left: 4px solid #9B6CFF; background: #f4f0ff; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; }
.summary { border: 1px solid #cfd6de; background: #fff; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.cols { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
.cols > * { flex: 1 1 260px; }
.gallery { display: flex; flex-wrap: wrap; gap: 12px; }
.gallery figure { flex: 1 1 220px; }
.cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.card { flex: 1 1 240px; border: 1px solid #cfd6de; border-radius: 8px; padding: 12px; background: #fff; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #cfd6de; padding: 8px; text-align: left; font-size: .95rem; }
th { background: #eef3f6; }
.activity { border: 1px dashed #9B6CFF; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; background: #faf8ff; }
.note { font-size: .9rem; color: #5a4a8a; margin-top: 6px; }
.small { font-size: .78rem; color: #6b7684; word-break: break-all; margin-top: 6px; }
.formula { background: #eef3f6; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: ui-monospace, monospace; }
.levels li { margin-bottom: 6px; }
hr { border: none; border-top: 1px solid #cfd6de; margin: 24px 0; }
details { margin-bottom: 12px; }
summary { cursor: pointer; font-weight: 600; }
`;

/** Vytvoří kompletní HTML dokument lekce pro offline čtení. */
export const buildLessonOfflineHtml = async (
  title: string,
  blocks: any[] | null | undefined,
  heroImageUrl?: string | null,
): Promise<string> => {
  const list = (Array.isArray(blocks) ? blocks : []).filter((b) => b && b.visible !== false);
  const parts: string[] = [];
  if (heroImageUrl) {
    const src = await toDataUri(heroImageUrl);
    parts.push(`<figure><img src="${esc(src)}" alt="${esc(title)}" /></figure>`);
  }
  for (const block of list) {
    const html = await renderBlock(block);
    if (html) parts.push(html);
  }
  const today = new Date().toLocaleDateString("cs-CZ");
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<p class="meta">Offline kopie lekce z Bezli · stáhnuto ${esc(today)}</p>
${parts.join("\n")}
</main>
</body>
</html>`;
};

/** Stáhne offline HTML lekce jako soubor. */
export const downloadLessonOfflineHtml = async (
  title: string,
  blocks: any[] | null | undefined,
  heroImageUrl?: string | null,
) => {
  const html = await buildLessonOfflineHtml(title, blocks, heroImageUrl);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (title || "lekce").replace(/[^\p{L}\p{N}\- ]/gu, "").trim().replace(/\s+/g, "-");
  a.href = url;
  a.download = `${safeName || "lekce"}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
