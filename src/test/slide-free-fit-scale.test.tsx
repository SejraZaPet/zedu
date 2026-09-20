import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import FreeFrameCanvas, { layoutReadOnlyFrames } from "@/components/blocks/FreeFrameCanvas";

const slide = {
  slideId: "s1",
  type: "explain",
  layout: "free",
  projector: { headline: "OBLASTI HYGIENY", body: "" },
  blocks: [
    { id: "a", type: "paragraph", visible: true, props: { text: "A" }, frame: { x: 4, y: 5, w: 44, h: 40 } },
    { id: "b", type: "paragraph", visible: true, props: { text: "B" }, frame: { x: 4, y: 60, w: 44, h: 80 } },
  ],
};

describe("volné rozmístění v prezentaci", () => {
  it("obsah přesahující 16:9 se proporčně zmenší, takže se karty nepřekrývají", () => {
    const { container } = render(<SlideCanvas slide={slide as any} />);
    const layer = container.querySelector("[data-free-fit-scale]") as HTMLElement;
    expect(layer).toBeTruthy();
    // maximální spodní hrana je 140 % → měřítko 100/140
    expect(Number(layer.dataset.freeFitScale)).toBeCloseTo(100 / 140, 3);
    expect(layer.style.transform).toContain("scale(");
  });

  it("obsah, který se do 16:9 vejde, se nezmenšuje", () => {
    const fits = { ...slide, blocks: [slide.blocks[0]] };
    const { container } = render(<SlideCanvas slide={fits as any} />);
    expect(container.querySelector("[data-free-fit-scale]")).toBeNull();
  });
});

describe("volné rozmístění v náhledu lekce", () => {
  it("zvětší kartu podle obsahu a posune celou následující řadu", () => {
    const items = [
      { id: "heading-left", frame: { x: 4, y: 5, w: 44, h: 10 } },
      { id: "heading-right", frame: { x: 52, y: 5, w: 44, h: 10 } },
      { id: "text-left", frame: { x: 4, y: 20, w: 44, h: 20 } },
      { id: "text-right", frame: { x: 52, y: 20, w: 44, h: 20 } },
      { id: "next-left", frame: { x: 4, y: 45, w: 44, h: 20 } },
      { id: "next-right", frame: { x: 52, y: 45, w: 44, h: 20 } },
    ];

    const layout = layoutReadOnlyFrames(items, { "text-left": 35 });
    expect(layout.frames["text-left"].h).toBe(35);
    expect(layout.frames["text-right"].y).toBe(20);
    expect(layout.frames["next-left"].y).toBe(60);
    expect(layout.frames["next-right"].y).toBe(60);
    expect(layout.extent).toBe(100);
  });

  it("zachová uložené rozměry, když se obsah do karet vejde", () => {
    const items = [
      { id: "a", frame: { x: 4, y: 5, w: 44, h: 20 } },
      { id: "b", frame: { x: 4, y: 30, w: 44, h: 20 } },
    ];
    const layout = layoutReadOnlyFrames(items, { a: 12, b: 18 });
    expect(layout.frames.a).toEqual(items[0].frame);
    expect(layout.frames.b).toEqual(items[1].frame);
  });

  it("obsah přesahující plochu zachová plnou šířku a prodlouží výšku plátna", () => {
    const { container } = render(
      <FreeFrameCanvas
        items={[
          { id: "a", frame: { x: 4, y: 4, w: 91, h: 20 }, node: <div>A</div> },
          { id: "b", frame: { x: 4, y: 145, w: 91, h: 31 }, node: <div>B</div> },
        ]}
      />,
    );
    const canvas = container.querySelector("[data-free-frame-canvas]") as HTMLElement;
    const layer = container.querySelector("[data-free-vertical-extent]") as HTMLElement;
    const second = container.querySelector('[data-free-frame-item="b"]') as HTMLElement;
    expect(Number(layer.dataset.freeVerticalExtent)).toBe(176);
    expect(canvas.style.aspectRatio).toBe(`16 / ${9 * 1.76}`);
    expect(second.style.width).toBe("91%");
    expect(second.style.left).toBe("4%");
    expect(Number.parseFloat(second.style.top)).toBeCloseTo((145 / 176) * 100, 3);
  });
});
