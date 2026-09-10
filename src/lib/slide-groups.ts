import type { Block } from "@/lib/textbook-config";
import { clampBlockFrame, getBlockFrame, type BlockFrame } from "@/lib/block-frame";

/** Počet sloupců, do kterých se dá spojený snímek rozložit. */
export type SlideGroupLayout = 1 | 2 | 3;

export const SLIDE_GROUP_TYPE = "slide_group" as const;

export const isSlideGroup = (block: Block | null | undefined): boolean =>
  !!block && block.type === SLIDE_GROUP_TYPE;

/** Bezpečné čtení dětí skupiny (vždy pole). */
export const getGroupChildren = (block: Block | null | undefined): Block[] => {
  const children = (block?.props as any)?.children;
  return Array.isArray(children) ? (children as Block[]) : [];
};

/** Bezpečné čtení počtu sloupců (1–3, default 2). */
export const getGroupLayout = (block: Block | null | undefined): SlideGroupLayout => {
  const raw = Number((block?.props as any)?.layout);
  return raw === 1 || raw === 3 ? (raw as SlideGroupLayout) : 2;
};

/**
 * Spojí vybrané bloky do jedné skupiny „Snímek“.
 * Skupina se vloží na pozici prvního vybraného bloku, ostatní se odeberou.
 * Vnořené skupiny se rozbalí, aby nevznikala skupina ve skupině.
 */
export const groupBlocksIntoSlide = (
  blocks: Block[],
  selectedIds: string[],
  layout: SlideGroupLayout = 2,
): Block[] => {
  const idSet = new Set(selectedIds);
  const picked = blocks.filter((b) => idSet.has(b.id));
  if (picked.length < 2) return blocks;

  const children: Block[] = picked.flatMap((b) => (isSlideGroup(b) ? getGroupChildren(b) : [b]));

  const group: Block = {
    id: crypto.randomUUID(),
    type: SLIDE_GROUP_TYPE,
    visible: true,
    props: { layout, children },
  };

  const firstIndex = blocks.findIndex((b) => idSet.has(b.id));
  const next = blocks.filter((b) => !idSet.has(b.id));
  next.splice(firstIndex, 0, group);
  return next;
};

/** Rozdělí skupinu zpět na samostatné bloky na jejím místě. */
export const ungroupSlideGroup = (blocks: Block[], groupId: string): Block[] => {
  const idx = blocks.findIndex((b) => b.id === groupId);
  if (idx < 0) return blocks;
  const group = blocks[idx];
  if (!isSlideGroup(group)) return blocks;
  const children = getGroupChildren(group);
  const next = [...blocks];
  next.splice(idx, 1, ...(children.length ? children : []));
  return next;
};

/** Nastaví počet sloupců skupiny. */
export const setGroupLayout = (
  blocks: Block[],
  groupId: string,
  layout: SlideGroupLayout,
): Block[] =>
  blocks.map((b) =>
    b.id === groupId && isSlideGroup(b) ? { ...b, props: { ...b.props, layout } } : b,
  );

/** Nahradí props jednoho dítěte skupiny. */
export const updateGroupChild = (
  blocks: Block[],
  groupId: string,
  childId: string,
  props: Record<string, any>,
): Block[] =>
  blocks.map((b) => {
    if (b.id !== groupId || !isSlideGroup(b)) return b;
    const children = getGroupChildren(b).map((c) => (c.id === childId ? { ...c, props } : c));
    return { ...b, props: { ...b.props, children } };
  });

/** Vyjme jedno dítě ze skupiny a vloží ho hned za skupinu. */
export const removeChildFromGroup = (
  blocks: Block[],
  groupId: string,
  childId: string,
): Block[] => {
  const idx = blocks.findIndex((b) => b.id === groupId);
  if (idx < 0) return blocks;
  const group = blocks[idx];
  if (!isSlideGroup(group)) return blocks;
  const children = getGroupChildren(group);
  const child = children.find((c) => c.id === childId);
  if (!child) return blocks;
  const rest = children.filter((c) => c.id !== childId);
  const next = [...blocks];
  if (rest.length <= 1) {
    // Skupina s jedním prvkem nemá smysl – rozpustíme ji.
    next.splice(idx, 1, ...children);
  } else {
    next[idx] = { ...group, props: { ...group.props, children: rest } };
    next.splice(idx + 1, 0, child);
  }
  return next;
};

/** Zploští skupiny na jednotlivé bloky – pro místa, která skupiny neznají. */
export const flattenSlideGroups = (blocks: Block[] | null | undefined): Block[] =>
  (Array.isArray(blocks) ? blocks : []).flatMap((b) =>
    isSlideGroup(b) ? getGroupChildren(b) : [b],
  );

/* ============================================================================
 * Režim skupiny: sloupce (výchozí) vs volné rozmístění
 * ==========================================================================*/

export type SlideGroupMode = "columns" | "free";

/** Režim skupiny; starší skupiny bez pole = "columns" (zpětná kompatibilita). */
export const getGroupMode = (block: Block | null | undefined): SlideGroupMode =>
  (block?.props as any)?.mode === "free" ? "free" : "columns";

/** Rovnoměrné rozpočítání rámců do mřížky (max 3 sloupce), v % plochy. */
export const autoGridFrames = (count: number): BlockFrame[] => {
  if (count <= 0) return [];
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const pad = 4;
  const gap = 3;
  const w = (100 - pad * 2 - gap * (cols - 1)) / cols;
  // Nižší výchozí výška: rámce nezaberou celou plochu, ať to nepůsobí prázdně.
  const ROW_HEIGHT = 26;
  const available = 100 - pad * 2 - gap * (rows - 1);
  const h = Math.min(ROW_HEIGHT, available / rows);
  return Array.from({ length: count }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return clampBlockFrame({ x: pad + c * (w + gap), y: pad + r * (h + gap), w, h });
  });
};

/**
 * Přepne režim skupiny. Při přechodu na "free" doplní chybějící rámce dětí
 * rovnoměrnou mřížkou, ať rozmístění nezačíná jako chaos.
 */
export const setGroupMode = (
  blocks: Block[],
  groupId: string,
  mode: SlideGroupMode,
): Block[] =>
  blocks.map((b) => {
    if (b.id !== groupId || !isSlideGroup(b)) return b;
    let children = getGroupChildren(b);
    if (mode === "free") {
      const auto = autoGridFrames(children.length);
      children = children.map((c, i) => ({
        ...c,
        frame: getBlockFrame(c) ?? auto[i],
      })) as Block[];
    }
    return { ...b, props: { ...b.props, mode, children } };
  });

/** Nastaví rámec jednoho dítěte skupiny (volné rozmístění). */
export const setGroupChildFrame = (
  blocks: Block[],
  groupId: string,
  childId: string,
  frame: BlockFrame,
): Block[] =>
  blocks.map((b) => {
    if (b.id !== groupId || !isSlideGroup(b)) return b;
    const children = getGroupChildren(b).map((c) =>
      c.id === childId ? ({ ...c, frame: clampBlockFrame(frame) } as Block) : c,
    );
    return { ...b, props: { ...b.props, children } };
  });

/* ============================================================================
 * Režim sloupců: ruční výška jednotlivé karty
 * ==========================================================================*/

/** Minimální a maximální ruční výška karty v režimu Sloupce (px). */
export const GROUP_CHILD_MIN_HEIGHT = 80;
export const GROUP_CHILD_MAX_HEIGHT = 1600;

/** Ruční výška karty ve sloupcích (px) nebo null, pokud je automatická. */
export const getGroupChildHeight = (child: Block | null | undefined): number | null => {
  const raw = Number((child?.props as any)?.groupHeight);
  return Number.isFinite(raw) && raw > 0
    ? Math.min(GROUP_CHILD_MAX_HEIGHT, Math.max(GROUP_CHILD_MIN_HEIGHT, Math.round(raw)))
    : null;
};

/** Nastaví (nebo zruší při null) ruční výšku karty ve sloupcích. */
export const setGroupChildHeight = (
  blocks: Block[],
  groupId: string,
  childId: string,
  height: number | null,
): Block[] =>
  blocks.map((b) => {
    if (b.id !== groupId || !isSlideGroup(b)) return b;
    const children = getGroupChildren(b).map((c) => {
      if (c.id !== childId) return c;
      const props = { ...c.props } as Record<string, any>;
      if (height == null) delete props.groupHeight;
      else
        props.groupHeight = Math.min(
          GROUP_CHILD_MAX_HEIGHT,
          Math.max(GROUP_CHILD_MIN_HEIGHT, Math.round(height)),
        );
      return { ...c, props };
    });
    return { ...b, props: { ...b.props, children } };
  });

/** Rámce dětí skupiny (s doplněním výchozí mřížky pro děti bez rámce). */
export const getGroupChildFrames = (block: Block | null | undefined): Record<string, BlockFrame> => {
  const children = getGroupChildren(block);
  const auto = autoGridFrames(children.length);
  const out: Record<string, BlockFrame> = {};
  children.forEach((c, i) => {
    out[c.id] = getBlockFrame(c) ?? auto[i];
  });
  return out;
};
