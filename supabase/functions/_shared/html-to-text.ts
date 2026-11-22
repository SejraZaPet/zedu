// Čistý text z HTML popisu (notifikace, push, e-mail). Bez DOM – funguje v Deno i v node testech.
const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
export function htmlToPlainText(input: string | null | undefined, max = 0): string {
  if (!input) return "";
  let s = String(input)
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (ENTITIES[k] !== undefined) return ENTITIES[k];
      if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10));
      return m;
    })
    .replace(/[ \t\u00a0]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join(" ")
    .trim();
  if (max > 0 && s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}
