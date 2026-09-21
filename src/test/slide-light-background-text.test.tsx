import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import SlideCanvas from "@/components/admin/SlideCanvas";

/** Snímek se světlým pozadím z lekce nesmí mít bílý text (tmavý motiv Bezli). */
describe("text na světlém pozadí snímku", () => {
  const slide = {
    slideId: "slide-1",
    type: "explain",
    themeId: "zedu-classic",
    layout: "full",
    backgroundOverride: { color: "hsl(34, 100%, 95%)" },
    projector: { headline: "Význam masa", body: "Maso je zdrojem bílkovin." },
    blocks: [{ id: "b1", type: "paragraph", props: { text: "Maso je zdrojem bílkovin." } }],
  };

  it("světlé pozadí → tmavý text", () => {
    const { container } = render(<SlideCanvas slide={slide as any} fit={false} />);
    expect(container.querySelector(".text-white")).toBeNull();
  });

  it("tmavý motiv bez vlastního pozadí → světlý text", () => {
    const dark = { ...slide, backgroundOverride: undefined };
    const { container } = render(<SlideCanvas slide={dark as any} fit={false} />);
    expect(container.querySelector(".text-white")).not.toBeNull();
  });
});
