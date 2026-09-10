import type { Block } from "@/lib/textbook-config";

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
