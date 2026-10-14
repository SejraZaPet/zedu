// Čisté pomocné funkce pro sestavení pracovního listu po sekcích (bez Deno API → testovatelné).

export const SECTION_TYPES = [
  "mcq", "true_false", "fill_blank", "matching", "ordering", "short_answer", "open_answer",
] as const;

export interface SectionRequest {
  type: string;
  count: number;
  pointsPerItem: number | null;
  title: string;
}

export function parseSections(raw: unknown): SectionRequest[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: SectionRequest[] = [];
  for (const s of raw.slice(0, 20)) {
    if (!s || typeof s !== "object") continue;
    const type = String((s as any).type ?? "");
    if (!(SECTION_TYPES as readonly string[]).includes(type)) continue;
    const c = Math.round(Number((s as any).count));
    const count = Number.isFinite(c) ? Math.max(1, Math.min(20, c)) : 1;
    const p = (s as any).pointsPerItem;
    const pointsPerItem = p === null || p === undefined || p === "" || !Number.isFinite(Number(p))
      ? null : Math.max(0, Number(p));
    const title = typeof (s as any).title === "string" ? (s as any).title.trim().slice(0, 200) : "";
    out.push({ type, count, pointsPerItem, title });
  }
  return out.length ? out : null;
}

/** Kolik položek každého typu sekce celkem vyžadují. */
export function requiredByType(sections: SectionRequest[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const s of sections) r[s.type] = (r[s.type] ?? 0) + s.count;
  return r;
}

/** Kolik položek kterého typu chybí v poolu. */
export function missingByType(sections: SectionRequest[], pool: any[]): Record<string, number> {
  const need = requiredByType(sections);
  const have: Record<string, number> = {};
  for (const it of pool) if (it && typeof it.type === "string") have[it.type] = (have[it.type] ?? 0) + 1;
  const out: Record<string, number> = {};
  for (const [t, n] of Object.entries(need)) {
    const m = n - (have[t] ?? 0);
    if (m > 0) out[t] = m;
  }
  return out;
}

function placeholder(type: string): any {
  const base = { type, prompt: "Doplňte zadání otázky", difficulty: "medium", timeEstimateSec: 60 };
  switch (type) {
    case "mcq": return { ...base, choices: ["Možnost A", "Možnost B", "Možnost C", "Možnost D"], correctAnswer: "Možnost A" };
    case "true_false": return { ...base, correctAnswer: "true" };
    case "fill_blank": return { ...base, blankText: "Doplňte ___." };
    case "matching": return { ...base, matchPairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }, { left: "C", right: "3" }] };
    case "ordering": return { ...base, orderItems: ["Krok 1", "Krok 2", "Krok 3"] };
    default: return { ...base, correctAnswer: "" };
  }
}

/**
 * Sestaví přesně podle sekcí: každá sekce = volitelný section_header + přesně `count`
 * položek daného typu (přebytek se ořízne, chybějící se doplní zástupnou úlohou).
 * Body za otázku se přenesou do položek.
 */
export function assembleSections(sections: SectionRequest[], pool: any[]): any[] {
  const queues: Record<string, any[]> = {};
  for (const it of pool) {
    if (!it || typeof it.type !== "string") continue;
    (queues[it.type] ??= []).push(it);
  }
  const out: any[] = [];
  for (const s of sections) {
    if (s.title) {
      out.push({ type: "section_header", prompt: s.title, points: 0, difficulty: "easy", timeEstimateSec: 0 });
    }
    for (let i = 0; i < s.count; i++) {
      const it = queues[s.type]?.shift() ?? placeholder(s.type);
      const points = s.pointsPerItem ?? (typeof it.points === "number" && it.points > 0 ? it.points : 1);
      out.push({ ...it, type: s.type, points });
    }
  }
  return out;
}

export interface ProjectBrief {
  goal: string;
  steps: string[];
  output: string;
  criteria: Array<{ criterion: string; points: number }>;
}

/** Zadání projektu → bloky listu (cíl, kroky, výstup, kritéria, prázdné místo na poznámky). */
export function projectBriefToItems(brief: ProjectBrief): any[] {
  const h = (prompt: string) => ({ type: "section_header", prompt, points: 0, difficulty: "easy", timeEstimateSec: 0 });
  const steps = (brief.steps ?? []).map((s) => String(s)).filter(Boolean).slice(0, 10);
  const criteria = (brief.criteria ?? [])
    .filter((c) => c && c.criterion)
    .slice(0, 10)
    .map((c) => ({ criterion: String(c.criterion), points: Math.max(0, Math.round(Number(c.points) || 0)) }));
  const total = criteria.reduce((a, c) => a + c.points, 0);
  return [
    h("Cíl projektu"),
    { type: "instruction_box", prompt: String(brief.goal ?? ""), points: 0, difficulty: "easy", timeEstimateSec: 0, instructionVariant: "blue", instructionIcon: "info" },
    h("Postup"),
    { type: "flow_steps", prompt: "Kroky projektu", points: 0, difficulty: "easy", timeEstimateSec: 0, flowSteps: steps.length ? steps : ["Příprava", "Realizace", "Prezentace"] },
    h("Výstup"),
    { type: "instruction_box", prompt: String(brief.output ?? ""), points: 0, difficulty: "easy", timeEstimateSec: 0, instructionVariant: "green", instructionIcon: "write" },
    h("Kritéria hodnocení"),
    {
      type: "table", prompt: "", points: 0, difficulty: "easy", timeEstimateSec: 0,
      tableCaption: "Kritéria hodnocení",
      tableRows: [["Kritérium", "Max. bodů", "Získáno"], ...criteria.map((c) => [c.criterion, String(c.points), ""]), ["Celkem", String(total), ""]],
    },
    { type: "blank_box", prompt: "Poznámky", points: 0, difficulty: "easy", timeEstimateSec: 0, heightMm: 60, blankStyle: "lines" },
  ];
}
