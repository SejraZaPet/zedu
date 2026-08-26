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
});

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
    fireEvent.pointerDown(wrapper, { button: 0, clientX: 200, clientY: 200 });
    fireEvent(window, new MouseEvent("pointermove", { clientX: 203, clientY: 202 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));
    expect(onChangeBlock).not.toHaveBeenCalled();
  });

  it("tažení nad prahem povýší blok do frame a dál ho posouvá", () => {
    const { onChangeBlock, wrapper } = setup();
    fireEvent.pointerDown(wrapper, { button: 0, clientX: 200, clientY: 200 });
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
});
