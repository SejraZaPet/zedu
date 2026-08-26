import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import { slideTextStyle } from "@/lib/slide-typography";
import type { Block } from "@/lib/textbook-config";

const textBlock = (id = "t1"): Block =>
  ({ id, type: "paragraph", visible: true, props: { text: "Ahoj svět" } }) as Block;

const framedImage = (id = "i1", objectFit?: string): Block =>
  ({
    id,
    type: "image",
    visible: true,
    props: { url: "https://example.com/a.png", alt: "Obrázek", widthPx: 900, objectFit },
    frame: { x: 10, y: 10, w: 40, h: 40 },
  }) as any;

const flowImage = (id = "i2"): Block =>
  ({ id, type: "image", visible: true, props: { url: "https://example.com/b.png", widthPx: 500 } }) as Block;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    const el = this as HTMLElement;
    if (el.classList.contains("pointer-events-none")) {
      return { left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    return { left: 160, top: 90, width: 800, height: 180, right: 960, bottom: 270, x: 160, y: 90, toJSON: () => ({}) } as DOMRect;
  };
});

describe("ČÁST 2 – tažení textového bloku přes celou plochu", () => {
  const setup = () => {
    const onChangeBlock = vi.fn();
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [textBlock()] }} editable onChangeBlock={onChangeBlock} />,
    );
    const editableEl = container.querySelector("[contenteditable]") as HTMLElement;
    const wrapper = container.querySelector("[data-slide-block-id='t1']")!.closest("div.touch-none") as HTMLElement;
    return { onChangeBlock, editableEl, wrapper };
  };

  it("tažení začínající na textu (contenteditable) blok povýší do frame", () => {
    const { onChangeBlock, editableEl, wrapper } = setup();
    expect(editableEl).toBeTruthy();
    const blurSpy = vi.spyOn(editableEl, "blur");

    fireEvent(editableEl, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
    fireEvent(window, new MouseEvent("pointermove", { clientX: 250, clientY: 200 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));

    expect(blurSpy).toHaveBeenCalled();
    const promoted = onChangeBlock.mock.calls[0][1](textBlock());
    expect(promoted.frame).toEqual({ x: 10, y: 10, w: 50, h: 20 });
    expect(wrapper).toBeTruthy();
  });

  it("krátký klik na text nic nepovýší – psaní zůstává funkční", () => {
    const { onChangeBlock, editableEl } = setup();
    fireEvent(editableEl, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
    fireEvent(window, new MouseEvent("pointermove", { clientX: 202, clientY: 201 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));
    expect(onChangeBlock).not.toHaveBeenCalled();
  });

  it("klik na tlačítko uvnitř bloku tažení nespustí", () => {
    const onChangeBlock = vi.fn();
    const bullet = { id: "b1", type: "bullet_list", visible: true, props: { items: ["a", "b"] } } as Block;
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [bullet] }} editable onChangeBlock={onChangeBlock} />,
    );
    const btn = container.querySelector("[data-slide-block-id='b1'] button") as HTMLElement;
    fireEvent(btn, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
    fireEvent(window, new MouseEvent("pointermove", { clientX: 260, clientY: 200 } as any));
    fireEvent(window, new MouseEvent("pointerup", {} as any));
    expect(onChangeBlock).not.toHaveBeenCalled();
  });
});

describe("ČÁST 3 – obrázek v rámci vyplní plochu bez oříznutí", () => {
  it("obrázek s frame nemá px úchyt a používá object-fit: contain", () => {
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [framedImage()] }} editable onChangeBlock={vi.fn()} />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.objectFit).toBe("contain");
    expect(img.className).toContain("w-full");
    // Kulatý widthPx úchyt se u framed obrázku nezobrazuje.
    expect(container.querySelector("[role='slider']")).toBeNull();
  });

  it("volba cover se propíše do object-fit", () => {
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [framedImage("i1", "cover")] }} editable onChangeBlock={vi.fn()} />,
    );
    expect((container.querySelector("img") as HTMLImageElement).style.objectFit).toBe("cover");
  });

  it("obrázek mimo frame si zachovává px úchyt", () => {
    const { container } = render(
      <SlideBody slide={{ projector: { headline: "H" }, blocks: [flowImage()] }} editable onChangeBlock={vi.fn()} />,
    );
    expect(container.querySelector("[role='slider']")).not.toBeNull();
  });
});

describe("ČÁST 1 – bold/italic jako blokové props", () => {
  it("slideTextStyle převede bold i italic na CSS", () => {
    expect(slideTextStyle({ bold: true } as any).fontWeight).toBe(700);
    expect(slideTextStyle({ italic: true } as any).fontStyle).toBe("italic");
    expect(slideTextStyle({} as any).fontWeight).toBeUndefined();
  });

  it("bold se aplikuje na vykreslený textový blok", () => {
    const b = { id: "t9", type: "paragraph", visible: true, props: { text: "Tučný", bold: true } } as Block;
    render(<SlideBody slide={{ projector: { headline: "H" }, blocks: [b] }} />);
    const el = screen.getByText("Tučný");
    expect(el.style.fontWeight).toBe("700");
  });
});
