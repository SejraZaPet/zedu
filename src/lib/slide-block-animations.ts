export const BLOCK_ANIMATION_PRESETS = [
  { value: "none", label: "Žádná", group: "Obecné" },
  { value: "appear", label: "Objevení", group: "Obecné" },
  { value: "fade", label: "Prolnutí", group: "Obecné" },
  { value: "rise", label: "Nahoru", group: "Obecné" },
  { value: "shift", label: "Posun", group: "Obecné" },
  { value: "pop", label: "Bum", group: "Obecné" },
  { value: "scale", label: "Rozprostření", group: "Obecné" },
  { value: "blur", label: "Rozostření", group: "Obecné" },
  { value: "drift", label: "Drift", group: "Obecné" },
  { value: "typewriter", label: "Psací stroj", group: "Navržené", textOnly: true },
] as const;

export type BlockAnimationPreset = typeof BLOCK_ANIMATION_PRESETS[number]["value"];
export type BlockAnimationDirection = "left" | "right" | "up" | "down";
export type BlockAnimationTrigger = "auto" | "click";

export interface SlideBlockAnimation {
  preset: BlockAnimationPreset;
  speed: number;
  delay: number;
  trigger: BlockAnimationTrigger;
  order: number;
  direction?: BlockAnimationDirection;
}

const PRESETS = new Set<string>(BLOCK_ANIMATION_PRESETS.map((item) => item.value));
const DIRECTIONS = new Set(["left", "right", "up", "down"]);
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

/** Líný převod starých čtyř animací; samotné načtení prezentaci nepřepisuje. */
export function normalizeBlockAnimation(input: unknown, fallbackOrder = 0): SlideBlockAnimation {
  if (typeof input === "string" || input == null) {
    if (input === "scale") return { preset: "scale", speed: 0.45, delay: 0, trigger: "auto", order: fallbackOrder };
    if (input === "from-bottom") return { preset: "rise", speed: 0.45, delay: 0, trigger: "auto", order: fallbackOrder, direction: "up" };
    if (input === "from-top") return { preset: "rise", speed: 0.45, delay: 0, trigger: "auto", order: fallbackOrder, direction: "down" };
    return { preset: "none", speed: 0.6, delay: 0, trigger: "auto", order: fallbackOrder };
  }
  const raw = (typeof input === "object" ? input : {}) as Record<string, unknown>;
  const preset = typeof raw.preset === "string" && PRESETS.has(raw.preset) ? raw.preset as BlockAnimationPreset : "none";
  const direction = typeof raw.direction === "string" && DIRECTIONS.has(raw.direction) ? raw.direction as BlockAnimationDirection : undefined;
  return {
    preset,
    speed: raw.speed !== undefined ? clamp(raw.speed, 0.2, 2, 0.6) : clamp(Number(raw.durationMs ?? 600) / 1000, 0.2, 2, 0.6),
    delay: raw.delay !== undefined ? clamp(raw.delay, 0, 10, 0) : clamp(Number(raw.delayMs ?? 0) / 1000, 0, 10, 0),
    trigger: raw.trigger === "click" || raw.trigger === "on-click" ? "click" : "auto",
    order: Math.round(clamp(raw.order, 0, 10000, fallbackOrder)),
    ...(direction ? { direction } : {}),
  };
}

export function blockAnimation(block: any, index = 0): SlideBlockAnimation {
  return normalizeBlockAnimation(block?.props?.animation, index);
}

export interface ClickAnimationItem {
  id: string;
  order: number;
  index: number;
  animation: SlideBlockAnimation;
  isActivity: boolean;
}

export function slideClickAnimations(slideOrBlocks: any): ClickAnimationItem[] {
  const blocks = Array.isArray(slideOrBlocks) ? slideOrBlocks : (slideOrBlocks?.blocks || []);
  return blocks.map((block: any, index: number) => ({ block, index, animation: blockAnimation(block, index) }))
    .filter((item: any) => item.block?.id && item.animation.preset !== "none" && item.animation.trigger === "click")
    .sort((a: any, b: any) => a.animation.order - b.animation.order || a.index - b.index)
    .map((item: any) => ({
      id: item.block.id,
      order: item.animation.order,
      index: item.index,
      animation: item.animation,
      isActivity: item.block.type === "activity" || !!item.block?.props?.activitySpec,
    }));
}

/** Prohození pořadí dvěma sousedům; obsah a rozložení bloků se nemění. */
export function moveBlockAnimationOrder(blocks: any[], blockId: string, delta: -1 | 1): any[] {
  const items = slideClickAnimations(blocks);
  const at = items.findIndex((item) => item.id === blockId);
  const other = items[at + delta];
  if (at < 0 || !other) return blocks;
  const current = items[at];
  return blocks.map((block) => {
    if (block.id === current.id) return { ...block, props: { ...block.props, animation: { ...current.animation, order: other.order } } };
    if (block.id === other.id) return { ...block, props: { ...block.props, animation: { ...other.animation, order: current.order } } };
    return block;
  });
}

export function animationOrders(blocks: any[]): Map<string, number> {
  return new Map(slideClickAnimations(blocks).map((item, index) => [item.id, index + 1]));
}

export function nextAnimationRevealCount(slide: any, current: unknown): number {
  const total = slideClickAnimations(slide).length;
  const value = typeof current === "number" && Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  return Math.min(total, value + 1);
}

export function pendingClickActivity(slide: any, revealedCount: unknown): boolean {
  const count = typeof revealedCount === "number" ? revealedCount : 0;
  return slideClickAnimations(slide).some((item, index) => index >= count && item.isActivity);
}
