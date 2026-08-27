import { describe, it, expect, vi, beforeAll } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import {
  applyFrameDrag,
  clampBlockFrame,
  getBlockFrame,
  DEFAULT_BLOCK_FRAME,
} from "@/lib/block-frame";
import { normalizeBlocks, type Block } from "@/lib/textbook-config";

const mkBlock = (extra: Partial<Block> = {}): Block =>
  ({
    id: extra.id || "b1",
    type: "paragraph",
    visible: true,
    props: { text: "Ahoj svět" },
    ...extra,
  }) as Block;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
});

describe("block-frame helpers", () => {
  it("ignoruje neplatné rámce", () => {
    expect(getBlockFrame(mkBlock())).toBeNull();
    expect(getBlockFrame(mkBlock({ frame: undefined }))).toBeNull();
    expect(getBlockFrame({ frame: { x: 1, y: 1, w: 0, h: 5 } })).toBeNull();
  });

  it("vrací a zaokrouhluje platný rámec", () => {
    expect(getBlockFrame(mkBlock({ frame: { x: 20.04, y: 20, w: 60, h: 15 } }))).toEqual({
      x: 20,
      y: 20,
      w: 60,
      h: 15,
    });
  });

  it("dovolí přesah za hranu slidu (full-bleed), ale drží rozumné meze", () => {
    expect(clampBlockFrame({ x: 95, y: -10, w: 30, h: 200 })).toEqual({
      x: 95,
      y: -10,
      w: 30,
      h: 200,
    });
    expect(clampBlockFrame({ x: -500, y: 500, w: 1000, h: 1 })).toEqual({
      x: -100,
      y: 195,
      w: 300,
      h: 5,
    });
  });

  it("posun a resize aktualizují správné hrany", () => {
    const start = { x: 20, y: 20, w: 60, h: 15 };
    expect(applyFrameDrag(start, "move", 5, -5)).toEqual({ x: 25, y: 15, w: 60, h: 15 });
    expect(applyFrameDrag(start, "se", 10, 10)).toEqual({ x: 20, y: 20, w: 70, h: 25 });
    expect(applyFrameDrag(start, "nw", 10, 5)).toEqual({ x: 30, y: 25, w: 50, h: 10 });
  });

  it("normalizeBlocks zachová frame", () => {
    const out = normalizeBlocks([mkBlock({ frame: DEFAULT_BLOCK_FRAME })]);
    expect(out[0].frame).toEqual(DEFAULT_BLOCK_FRAME);
  });
});

describe("SlideBody – volné umístění", () => {
  it("blok bez frame zůstává v lineárním flow", () => {
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "Test" }, blocks: [mkBlock()] }} />,
    );
    expect(container.querySelector('[data-free-frame="true"]')).toBeNull();
    expect(container.textContent).toContain("Ahoj svět");
  });

  it("blok s frame se renderuje absolutně na zadané pozici", () => {
    const { container } = render(
      <SlideBody
        slide={{
          projector: { headline: "Test" },
          blocks: [mkBlock({ frame: { x: 20, y: 20, w: 60, h: 15 } })],
        }}
      />,
    );
    const el = container.querySelector('[data-free-frame="true"]') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.left).toBe("20%");
    expect(el.style.top).toBe("20%");
    expect(el.style.width).toBe("60%");
    expect(el.style.height).toBe("15%");
    expect(el.textContent).toContain("Ahoj svět");
  });

  it("mix bloků: jeden ve flow, jeden volně", () => {
    const { container } = render(
      <SlideBody
        slide={{
          projector: { headline: "Test" },
          blocks: [
            mkBlock({ id: "flow", props: { text: "Ve flow" } }),
            mkBlock({ id: "free", props: { text: "Volně" }, frame: DEFAULT_BLOCK_FRAME }),
          ],
        }}
      />,
    );
    const framed = container.querySelectorAll('[data-free-frame="true"]');
    expect(framed.length).toBe(1);
    expect(framed[0].textContent).toContain("Volně");
    expect(container.textContent).toContain("Ve flow");
  });

  it("pointercancel ukončí tažení a další pohyb už blok nezmění", () => {
    const onChangeBlock = vi.fn();
    const { container } = render(
      <SlideBody
        slide={{
          projector: { headline: "Test" },
          blocks: [mkBlock({ frame: { x: 20, y: 20, w: 60, h: 15 } })],
        }}
        editable
        onChangeBlock={onChangeBlock}
      />,
    );
    const el = container.querySelector('[data-free-frame="true"]') as HTMLElement;

    fireEvent.pointerDown(el, { pointerId: 7, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(el, { pointerId: 7, clientX: 220, clientY: 200 });
    expect(onChangeBlock).toHaveBeenCalledTimes(1);

    fireEvent.pointerCancel(el, { pointerId: 7 });
    fireEvent.pointerMove(el, { pointerId: 7, clientX: 260, clientY: 200 });
    expect(onChangeBlock).toHaveBeenCalledTimes(1);
  });
});
