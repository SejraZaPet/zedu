import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import type { Block } from "@/lib/textbook-config";

const framed = (id: string, x: number): Block =>
  ({ id, type: "paragraph", visible: true, props: { text: "x" }, frame: { x, y: 10, w: 20, h: 20 } }) as any;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    if (el.getAttribute("data-free-frame") === "true") {
      return { left: 160 + 0, top: 90, width: 320, height: 180, right: 480, bottom: 270, x: 160, y: 90, toJSON: () => ({}) } as DOMRect;
    }
    return { left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

describe("repro group drag", () => {
  it("dragging block A should not move block B", () => {
    const onChangeBlock = vi.fn();
    const { container } = render(
      <SlideBody
        slide={{ projector: { headline: "H" }, blocks: [framed("a", 10), framed("b", 50)] }}
        editable
        onChangeBlock={onChangeBlock}
        selectedBlockId="a"
      />,
    );
    const aEl = container.querySelector("[data-slide-block-id='a']") as HTMLElement;
    fireEvent(aEl, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
    fireEvent(window, new MouseEvent("pointermove", { clientX: 250, clientY: 200 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));
    console.log(onChangeBlock.mock.calls.map(c => c[0]));
    for (const call of onChangeBlock.mock.calls) {
      expect(call[0]).toBe("a");
    }
  });
});
