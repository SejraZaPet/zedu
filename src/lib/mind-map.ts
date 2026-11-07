/**
 * Myšlenková mapa – sdílený datový model (strom), limity, úpravy,
 * převod na seznam a vyhodnocení doplňovací úlohy.
 *
 * Správné odpovědi doplňovaných uzlů se NIKDY neukládají do mapy;
 * u pracovního listu žijí jen v answerKeys (pole v pořadí prázdných uzlů,
 * více přijatelných odpovědí oddělených středníkem).
 */

export const MIND_MAP_MAX_NODES = 60;
/** Hloubka větví pod středem (střed = 0). */
export const MIND_MAP_MAX_DEPTH = 4;
export const MIND_MAP_MAX_TEXT = 120;
export const MIND_MAP_ANSWER_SEPARATOR = ";";

export type MindMapColor = "primary" | "secondary" | "accent" | "muted";
export const MIND_MAP_COLORS: { value: MindMapColor; label: string }[] = [
  { value: "primary", label: "Tyrkysová" },
  { value: "secondary", label: "Fialová" },
  { value: "accent", label: "Modrá" },
  { value: "muted", label: "Šedá" },
];

export interface MindMapNode {
  id: string;
  text: string;
  color?: MindMapColor;
  /** Pracovní list: žák pojem doplňuje (text je vždy prázdný). */
  blank?: boolean;
  children: MindMapNode[];
}

export interface MindMapData {
  version: 1;
  root: MindMapNode;
}

const COLORS = new Set<MindMapColor>(["primary", "secondary", "accent", "muted"]);

export function newNodeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `n-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function createDefaultMindMap(): MindMapData {
  return {
    version: 1,
    root: {
      id: newNodeId(),
      text: "Hlavní téma",
      children: [
        { id: newNodeId(), text: "Větev 1", color: "primary", children: [] },
        { id: newNodeId(), text: "Větev 2", color: "secondary", children: [] },
        { id: newNodeId(), text: "Větev 3", color: "accent", children: [] },
      ],
    },
  };
}

/** Bezpečně načte libovolná data; vynutí limity uzlů, hloubky a délky textu. */
export function normalizeMindMap(raw: unknown): MindMapData {
  const seen = new Set<string>();
  let count = 0;
  const walk = (n: any, depth: number): MindMapNode | null => {
    if (!n || typeof n !== "object" || count >= MIND_MAP_MAX_NODES) return null;
    count++;
    let id = typeof n.id === "string" && n.id ? n.id : newNodeId();
    if (seen.has(id)) id = newNodeId();
    seen.add(id);
    const node: MindMapNode = {
      id,
      text: String(n.text ?? "").slice(0, MIND_MAP_MAX_TEXT),
      children: [],
    };
    if (COLORS.has(n.color)) node.color = n.color;
    if (n.blank === true && depth > 0) {
      node.blank = true;
      node.text = "";
    }
    if (depth < MIND_MAP_MAX_DEPTH && Array.isArray(n.children)) {
      for (const c of n.children) {
        const child = walk(c, depth + 1);
        if (child) node.children.push(child);
      }
    }
    return node;
  };
  const root = walk((raw as any)?.root, 0) ?? { id: newNodeId(), text: "Hlavní téma", children: [] };
  return { version: 1, root };
}

export interface FlatNode {
  node: MindMapNode;
  depth: number;
  parentId: string | null;
  /** Pořadí mezi doplňovanými uzly (jen u blank). */
  blankIndex?: number;
}

/** Průchod do hloubky v pořadí zobrazení. */
export function flattenMindMap(data: MindMapData): FlatNode[] {
  const out: FlatNode[] = [];
  let b = 0;
  const walk = (n: MindMapNode, depth: number, parentId: string | null) => {
    const f: FlatNode = { node: n, depth, parentId };
    if (n.blank) f.blankIndex = b++;
    out.push(f);
    n.children.forEach((c) => walk(c, depth + 1, n.id));
  };
  walk(data.root, 0, null);
  return out;
}

export const countNodes = (data: MindMapData) => flattenMindMap(data).length;
export const blankNodeIds = (data: MindMapData) =>
  flattenMindMap(data).filter((f) => f.node.blank).map((f) => f.node.id);

function mapTree(n: MindMapNode, fn: (n: MindMapNode) => MindMapNode): MindMapNode {
  const next = fn(n);
  return { ...next, children: next.children.map((c) => mapTree(c, fn)) };
}

function depthOf(data: MindMapData, id: string): number {
  return flattenMindMap(data).find((f) => f.node.id === id)?.depth ?? -1;
}

export function canAddChild(data: MindMapData, parentId: string): boolean {
  const d = depthOf(data, parentId);
  return d >= 0 && d < MIND_MAP_MAX_DEPTH && countNodes(data) < MIND_MAP_MAX_NODES;
}

export function addChild(data: MindMapData, parentId: string, text = "Nový pojem"): MindMapData {
  if (!canAddChild(data, parentId)) return data;
  const isRoot = data.root.id === parentId;
  const palette: MindMapColor[] = ["primary", "secondary", "accent", "muted"];
  return {
    ...data,
    root: mapTree(data.root, (n) =>
      n.id === parentId
        ? {
            ...n,
            children: [
              ...n.children,
              {
                id: newNodeId(),
                text,
                children: [],
                ...(isRoot ? { color: palette[n.children.length % palette.length] } : {}),
              },
            ],
          }
        : n,
    ),
  };
}

export function updateNode(data: MindMapData, id: string, patch: Partial<Omit<MindMapNode, "id" | "children">>): MindMapData {
  return {
    ...data,
    root: mapTree(data.root, (n) => {
      if (n.id !== id) return n;
      const next = { ...n, ...patch, text: String(patch.text ?? n.text).slice(0, MIND_MAP_MAX_TEXT) };
      if (next.blank) next.text = "";
      if (!next.blank) delete next.blank;
      return next;
    }),
  };
}

export function removeNode(data: MindMapData, id: string): MindMapData {
  if (data.root.id === id) return data;
  const strip = (n: MindMapNode): MindMapNode => ({
    ...n,
    children: n.children.filter((c) => c.id !== id).map(strip),
  });
  return { ...data, root: strip(data.root) };
}

export function moveNode(data: MindMapData, id: string, dir: -1 | 1): MindMapData {
  const move = (n: MindMapNode): MindMapNode => {
    const i = n.children.findIndex((c) => c.id === id);
    if (i >= 0) {
      const j = i + dir;
      if (j < 0 || j >= n.children.length) return n;
      const kids = [...n.children];
      [kids[i], kids[j]] = [kids[j], kids[i]];
      return { ...n, children: kids };
    }
    return { ...n, children: n.children.map(move) };
  };
  return { ...data, root: move(data.root) };
}

/** Barva větve: vlastní, jinak zděděná z nejbližší větve pod středem. */
export function branchColor(data: MindMapData, id: string): MindMapColor {
  const flat = flattenMindMap(data);
  const byId = new Map(flat.map((f) => [f.node.id, f]));
  let cur = byId.get(id);
  while (cur) {
    if (cur.node.color) return cur.node.color;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return "primary";
}

// ────────── Vyhodnocení ──────────

/** Bez diakritiky, velikosti písmen a nadbytečných mezer. */
export function foldAnswer(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAccepted(s: unknown): string[] {
  return String(s ?? "")
    .split(MIND_MAP_ANSWER_SEPARATOR)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isBlankCorrect(answer: unknown, accepted: unknown): boolean {
  const a = foldAnswer(answer);
  if (!a) return false;
  return parseAccepted(accepted).some((x) => foldAnswer(x) === a);
}

export interface MindMapScore {
  correctCount: number;
  total: number;
  perBlank: boolean[];
  /** Body úměrně počtu správně doplněných uzlů, zaokrouhleno na 0,5. */
  points: number;
  allCorrect: boolean;
}

export function scoreMindMap(answer: unknown, correct: unknown, maxPoints: number): MindMapScore {
  const keys = Array.isArray(correct) ? correct : correct ? [correct] : [];
  const given = Array.isArray(answer) ? answer : [];
  const perBlank = keys.map((k, i) => isBlankCorrect(given[i], k));
  const correctCount = perBlank.filter(Boolean).length;
  const total = keys.length;
  const ratio = total > 0 ? correctCount / total : 0;
  const points = Math.round(Math.max(0, maxPoints) * ratio * 2) / 2;
  return { correctCount, total, perBlank, points, allCorrect: total > 0 && correctCount === total };
}

// ────────── Klíč odpovědí (učitel) ──────────

/** Klíč (pole v pořadí prázdných uzlů) → mapa uzel → odpovědi. */
export function keyToMap(data: MindMapData, correct: unknown): Record<string, string> {
  const arr = Array.isArray(correct) ? correct : [];
  const out: Record<string, string> = {};
  blankNodeIds(data).forEach((id, i) => {
    out[id] = String(arr[i] ?? "");
  });
  return out;
}

/** Mapa uzel → odpovědi → klíč v aktuálním pořadí prázdných uzlů. */
export function mapToKey(data: MindMapData, map: Record<string, string>): string[] {
  return blankNodeIds(data).map((id) => String(map[id] ?? ""));
}

// ────────── Textová alternativa ──────────

export function mindMapToOutline(data: MindMapData, answers?: unknown): string {
  const given = Array.isArray(answers) ? answers : [];
  return flattenMindMap(data)
    .map((f) => {
      const text = f.node.blank ? String(given[f.blankIndex ?? -1] ?? "").trim() || "………" : f.node.text;
      return f.depth === 0 ? text : `${"  ".repeat(f.depth - 1)}- ${text}`;
    })
    .join("\n");
}
