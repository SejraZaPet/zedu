/** Převod bloků modulu Akademie na prostý text pro AI asistenta (čistá funkce, testovaná). */
type AnyBlock = { type?: unknown; visible?: unknown; props?: Record<string, unknown> | null };

const LABELS: Record<string, string> = { goal: "Cíl", link: "Propojení", tip: "Tip", warning: "Pozor", result: "Výsledek", where: "Kde funkci najdete" };

const strip = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function academyModuleText(blocks: unknown, fallback?: string | null, limit = 6000): string {
  const out: string[] = [];
  if (Array.isArray(blocks)) {
    for (const raw of blocks as AnyBlock[]) {
      if (!raw || typeof raw !== "object" || raw.visible === false) continue;
      const p = (raw.props ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof p[k] === "string" ? strip(p[k] as string) : "");
      if (raw.type === "callout") {
        const v = typeof p.variant === "string" ? p.variant : "";
        if (str("text")) out.push(`${LABELS[v] ?? "Poznámka"}: ${str("text")}`);
      } else if (raw.type === "image") {
        if (str("caption")) out.push(`Snímek: ${str("caption")}`);
        if (Array.isArray(p.callouts)) {
          for (const c of p.callouts as Array<Record<string, unknown>>) {
            if (c && typeof c.text === "string") out.push(`Krok ${Number(c.n) || ""}: ${strip(c.text)}`);
          }
        }
      } else {
        const t = str("text") || str("html") || str("content");
        if (t) out.push(t);
        if (Array.isArray(p.items)) for (const it of p.items) if (typeof it === "string") out.push(`- ${strip(it)}`);
      }
    }
  }
  if (out.length === 0 && fallback) out.push(strip(fallback));
  return out.join("\n").slice(0, limit);
}
