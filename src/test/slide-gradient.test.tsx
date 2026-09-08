import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import ShapeRenderer from "@/components/blocks/ShapeRenderer";
import { slideTextStyle, slideBackgroundOverrideStyle } from "@/lib/slide-typography";
import { BEZLI_GRADIENT, gradientCss, normalizeGradient } from "@/lib/slide-gradient";

describe("barevné přechody na slidech", () => {
  it("normalizuje a skládá CSS", () => {
    expect(normalizeGradient({ from: "#fff", to: "#000" })).toEqual({
      from: "#fff",
      to: "#000",
      direction: "135deg",
    });
    expect(normalizeGradient({ from: "modrá", to: "#000" })).toBeNull();
    expect(gradientCss(BEZLI_GRADIENT)).toBe("linear-gradient(135deg, #6EC6D9, #9B6CFF)");
  });

  it("text s přechodem používá background-clip: text", () => {
    const style = slideTextStyle({ color: "#111111", gradient: BEZLI_GRADIENT } as any);
    expect(style.backgroundImage).toContain("linear-gradient");
    expect((style as any).WebkitBackgroundClip).toBe("text");
    expect(style.color).toBe("transparent");
  });

  it("blok bez přechodu zůstává jednobarevný (zpětná kompatibilita)", () => {
    const style = slideTextStyle({ color: "#111111" } as any);
    expect(style.color).toBe("#111111");
    expect(style.backgroundImage).toBeUndefined();
  });

  it("pozadí snímku podporuje přechod", () => {
    const style = slideBackgroundOverrideStyle({ backgroundOverride: { gradient: BEZLI_GRADIENT } });
    expect(style?.backgroundImage).toContain("linear-gradient(135deg");
  });

  it("tvar vykreslí SVG přechod", () => {
    const { container } = render(<ShapeRenderer shapeKind="circle" fillGradient={BEZLI_GRADIENT} />);
    expect(container.querySelector("linearGradient")).toBeTruthy();
    expect(container.querySelector("ellipse")?.getAttribute("fill")).toContain("url(#shape-grad-");
  });

  it("přechod textu se propíše do stylu bloku i mimo editor", () => {
    // jsdom neumí serializovat `linear-gradient` do inline stylu, proto se
    // kontroluje výsledný styl bloku (v prohlížeči se vykreslí jako přechod).
    const { container } = render(
      <SlideBody
        slide={{
          projector: { headline: "H" },
          blocks: [
            { id: "g1", type: "heading", visible: true, props: { level: 2, text: "Bezli", gradient: BEZLI_GRADIENT } },
          ],
        }}
      />,
    );
    const el = [...container.querySelectorAll<HTMLElement>("div")].find((d) => d.textContent === "Bezli")!;
    expect(el.style.color).toBe("transparent");
    expect(el.style.backgroundClip).toBe("text");
  });
});
