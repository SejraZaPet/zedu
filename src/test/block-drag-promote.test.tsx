import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import type { Block } from "@/lib/textbook-config";

const mkBlock = (id = "b1"): Block =>
  ({ id, type: "paragraph", visible: true, props: { text: "Ahoj svět" } }) as Block;

beforeAll(() => {
  // jsdom vrací nulové rozměry – nasimulujeme stage 1600×900.
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    if (el.classList.contains("pointer-events-none")) {
      return { left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    return { left: 160, top: 90, width: 800, height: 180, right: 960, bottom: 270, x: 160, y: 90, toJSON: () => ({}) } as DOMRect;
  };
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
});

const pointerEvent = (type: string, pointerId: number, clientX: number, clientY: number) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
};

describe("drag & drop flow bloku (auto-promote do frame)", () => {
  const setup = () => {
    const onChangeBlock = vi.fn();
    const { container } = render(
      <SlideBody
        slide={{ projector: { headline: "H" }, blocks: [mkBlock()] }}
        editable
        onChangeBlock={onChangeBlock}
      />,
    );
    const wrapper = container.querySelector("[data-slide-block-id='b1']")!
      .closest("div.touch-none") as HTMLElement;
    return { onChangeBlock, wrapper };
  };

  it("klik (pod prahem 6px) blok nepovýší – text zůstane editovatelný", () => {
    const { onChangeBlock, wrapper } = setup();
    fireEvent(
      wrapper,
      new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }),
    );
    fireEvent(window, new MouseEvent("pointermove", { clientX: 203, clientY: 202 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));
    expect(onChangeBlock).not.toHaveBeenCalled();
  });

  it("tažení nad prahem povýší blok do frame a dál ho posouvá", () => {
    const { onChangeBlock, wrapper } = setup();
    fireEvent(
      wrapper,
      new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }),
    );
    fireEvent(window, new MouseEvent("pointermove", { clientX: 240, clientY: 200 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));

    expect(onChangeBlock.mock.calls.length).toBeGreaterThanOrEqual(2);
    // 1. volání = promote na aktuální pozici (160/1600 = 10 %, 90/900 = 10 %)
    const promoted = onChangeBlock.mock.calls[0][1](mkBlock());
    expect(promoted.frame).toEqual({ x: 10, y: 10, w: 50, h: 20 });
    // 2. volání = posun o 40px = 2.5 % šířky stage
    const moved = onChangeBlock.mock.calls[1][1](mkBlock());
    expect(moved.frame.x).toBeCloseTo(12.5, 1);
    expect(moved.frame.y).toBeCloseTo(10, 1);
  });

  it("pointercancel uklidí flow drag a další pohyb blok nezmění", () => {
    const { onChangeBlock, wrapper } = setup();
    const slideRoot = wrapper.closest(".relative.flex.h-full") as HTMLElement;

    fireEvent(wrapper, pointerEvent("pointerdown", 7, 200, 200));
    fireEvent(slideRoot, pointerEvent("pointermove", 7, 240, 200));
    const callsAfterMove = onChangeBlock.mock.calls.length;
    expect(callsAfterMove).toBeGreaterThanOrEqual(2);

    fireEvent(slideRoot, pointerEvent("pointercancel", 7, 240, 200));
    fireEvent(slideRoot, pointerEvent("pointermove", 7, 280, 200));
    expect(onChangeBlock).toHaveBeenCalledTimes(callsAfterMove);
  });

  it("nové gesto uklidí staré a nemůže pohnout dvěma flow bloky", () => {
    const onChangeBlock = vi.fn();
    const { container } = render(
      <SlideBody
        slide={{ projector: { headline: "H" }, blocks: [mkBlock("first"), mkBlock("second")] }}
        editable
        onChangeBlock={onChangeBlock}
      />,
    );
    const first = container.querySelector("[data-slide-block-id='first']")!.closest("div.touch-none") as HTMLElement;
    const second = container.querySelector("[data-slide-block-id='second']")!.closest("div.touch-none") as HTMLElement;
    const slideRoot = first.closest(".relative.flex.h-full") as HTMLElement;

    fireEvent(first, pointerEvent("pointerdown", 11, 200, 200));
    fireEvent(second, pointerEvent("pointerdown", 12, 300, 300));
    fireEvent(slideRoot, pointerEvent("pointermove", 12, 340, 300));

    expect(onChangeBlock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onChangeBlock.mock.calls.every(([blockId]) => blockId === "second")).toBe(true);
  });
});
