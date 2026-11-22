import { describe, expect, it } from "vitest";
import { blockAnimation, moveBlockAnimationOrder, nextAnimationRevealCount, normalizeBlockAnimation, pendingClickActivity, slideClickAnimations } from "@/lib/slide-block-animations";

const block = (id: string, animation: any, type = "paragraph") => ({ id, type, props: { animation } });

describe("slide block animations", () => {
  it("maps all four legacy values without changing their meaning", () => {
    expect(normalizeBlockAnimation("none").preset).toBe("none");
    expect(normalizeBlockAnimation("scale").preset).toBe("scale");
    expect(normalizeBlockAnimation("from-bottom")).toMatchObject({ preset: "rise", direction: "up" });
    expect(normalizeBlockAnimation("from-top")).toMatchObject({ preset: "rise", direction: "down" });
  });

  it("clamps timing and rejects unknown values", () => {
    expect(normalizeBlockAnimation({ preset: "unknown", speed: 99, delay: -4, trigger: "bad", order: 2.6 }, 8)).toEqual({ preset: "none", speed: 2, delay: 0, trigger: "auto", order: 3 });
    expect(normalizeBlockAnimation({ preset: "fade", durationMs: 1200, delayMs: 300, trigger: "on-click" })).toMatchObject({ speed: 1.2, delay: 0.3, trigger: "click" });
  });

  it("sorts click groups by explicit order and keeps flow order as tie breaker", () => {
    const blocks = [block("b", { preset: "fade", trigger: "click", order: 2 }), block("a", { preset: "rise", trigger: "click", order: 1 }), block("c", { preset: "pop", trigger: "click", order: 2 })];
    expect(slideClickAnimations(blocks).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(nextAnimationRevealCount({ blocks }, 1)).toBe(2);
    expect(nextAnimationRevealCount({ blocks }, 3)).toBe(3);
  });

  it("swaps only animation order when moving an item", () => {
    const blocks = [block("a", { preset: "fade", trigger: "click", order: 0 }), block("b", { preset: "rise", trigger: "click", order: 1 })];
    const moved = moveBlockAnimationOrder(blocks, "b", -1);
    expect(moved.map((item) => item.id)).toEqual(["a", "b"]);
    expect(blockAnimation(moved[0]).order).toBe(1);
    expect(blockAnimation(moved[1]).order).toBe(0);
    expect(moveBlockAnimationOrder(blocks, "a", -1)).toBe(blocks);
  });

  it("holds a hidden click activity until its own reveal", () => {
    const blocks = [block("text", { preset: "fade", trigger: "click", order: 0 }), block("quiz", { preset: "fade", trigger: "click", order: 1 }, "activity")];
    expect(pendingClickActivity({ blocks }, 0)).toBe(true);
    expect(pendingClickActivity({ blocks }, 1)).toBe(true);
    expect(pendingClickActivity({ blocks }, 2)).toBe(false);
  });
});
