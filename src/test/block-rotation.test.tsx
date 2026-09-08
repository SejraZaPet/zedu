import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import { normalizeRotation, getBlockRotation } from "@/lib/block-frame";
import type { Block } from "@/lib/textbook-config";

const framed = (rotation?: number): Block =>
  ({ id: "b1", type: "paragraph", visible: true, props: { text: "Ahoj", rotation }, frame: { x: 10, y: 10, w: 40, h: 20 } }) as any;

describe("rotace volně umístěných bloků", () => {
  it("normalizuje úhel", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(370.04)).toBe(10);
    expect(normalizeRotation("x")).toBe(0);
    expect(getBlockRotation(framed(45))).toBe(45);
  });

  it("aplikuje rotaci i mimo editor (projektor/žák)", () => {
    const { container } = render(<SlideBody slide={{ projector: { headline: "H" }, blocks: [framed(30)] }} />);
    const el = container.querySelector('[data-free-frame="true"]') as HTMLElement;
    expect(el.style.transform).toBe("rotate(30deg)");
  });

  it("úchyt rotace uloží úhel do props.rotation", () => {
    const onChangeBlock = vi.fn();
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [framed()] }} editable selectedBlockId="b1" onChangeBlock={onChangeBlock} />,
    );
    const handle = container.querySelector('[data-rotate-handle="true"]') as HTMLElement;
    expect(handle).toBeTruthy();
    const ev = (type: string, x: number, y: number) => {
      const e = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
      Object.defineProperty(e, "pointerId", { value: 3 });
      return e;
    };
    fireEvent(handle, ev("pointerdown", 800, 400));
    fireEvent(handle, ev("pointermove", 400, 800));
    expect(onChangeBlock).toHaveBeenCalled();
    const [id, updater] = onChangeBlock.mock.calls.at(-1)!;
    expect(id).toBe("b1");
    const next = updater(framed());
    expect(typeof next.props.rotation).toBe("number");
    expect(next.props.rotation).toBeGreaterThan(0);
  });
});
