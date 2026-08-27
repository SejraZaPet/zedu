import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import type { Block } from "@/lib/textbook-config";

const framed = (id: string, x: number): Block =>
  ({ id, type: "paragraph", visible: true, props: { text: "A" }, frame: { x, y: 10, w: 20, h: 20 } }) as any;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

describe("framed block", () => {
  it("tažení těla posune jen vybraný blok a jen nad 5px", () => {
    const onChangeBlock = vi.fn();
    const onSelectBlock = vi.fn();
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [framed("a", 10), framed("b", 50)] }} editable selectedBlockId="a" onChangeBlock={onChangeBlock} onSelectBlock={onSelectBlock} />,
    );
    const a = container.querySelector("[data-slide-block-id='a']") as HTMLElement;
    fireEvent(a, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    expect(onSelectBlock).toHaveBeenCalledWith("a");
    fireEvent(window, new MouseEvent("pointermove", { clientX: 102, clientY: 100 } as any));
    expect(onChangeBlock).not.toHaveBeenCalled();
    fireEvent(window, new MouseEvent("pointermove", { clientX: 200, clientY: 100 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));
    expect(onChangeBlock.mock.calls.every((c) => c[0] === "a")).toBe(true);
    const next = onChangeBlock.mock.calls.at(-1)![1](framed("a", 10));
    expect(next.frame.x).toBeGreaterThan(10);
  });

  it("nevybraný blok nemá lištu ani úchyty a ring jen na hover", () => {
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [framed("a", 10)] }} editable selectedBlockId={null} onChangeBlock={vi.fn()} onSelectBlock={vi.fn()} />,
    );
    const a = container.querySelector("[data-slide-block-id='a']") as HTMLElement;
    expect(a.className).not.toContain("ring-dashed");
    expect(a.className).toContain("hover:ring-1");
    expect(a.querySelector("[role='presentation']")).toBeNull();
  });

  it("klik na prázdné plátno ruší výběr", () => {
    const onSelectBlock = vi.fn();
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [framed("a", 10)] }} editable selectedBlockId="a" onChangeBlock={vi.fn()} onSelectBlock={onSelectBlock} />,
    );
    const root = container.firstElementChild as HTMLElement;
    fireEvent(root, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
    expect(onSelectBlock).toHaveBeenCalledWith(null);
  });
});
