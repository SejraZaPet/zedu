import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import FreeFrameCanvas from "@/components/blocks/FreeFrameCanvas";

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
  it("obsah přesahující plochu zmenší bez navýšení výšky kontejneru", () => {
    const { container } = render(
      <FreeFrameCanvas
        items={[
          { id: "a", frame: { x: 4, y: 4, w: 91, h: 20 }, node: <div>A</div> },
          { id: "b", frame: { x: 4, y: 145, w: 91, h: 31 }, node: <div>B</div> },
        ]}
      />,
    );
    const layer = container.querySelector("[data-free-fit-scale]") as HTMLElement;
    expect(Number(layer.dataset.freeFitScale)).toBeCloseTo(100 / 176, 3);
    expect(container.querySelector("[data-free-frame-canvas]")?.className).toContain("aspect-video");
  });
});
