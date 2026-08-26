import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { slideBackgroundOverrideStyle } from "@/lib/slide-typography";

describe("slideBackgroundOverrideStyle", () => {
  it("vrací explicitní barvu bez shorthandu", () => {
    const style = slideBackgroundOverrideStyle({ backgroundOverride: { color: "#FEF3C7" } });
    expect(style).toEqual({ backgroundColor: "#FEF3C7", backgroundImage: "none" });
    expect(style && "background" in style).toBe(false);
  });

  it("vrací explicitní obrázek s cover/center", () => {
    const style = slideBackgroundOverrideStyle({
      backgroundOverride: { image: "https://cdn.test/bg.jpg" },
    })!;
    expect(style.backgroundImage).toBe('url("https://cdn.test/bg.jpg")');
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundPosition).toBe("center");
    expect(style.backgroundColor).toBe("transparent");
    expect("background" in style).toBe(false);
  });

  it("vrací null bez přepisu", () => {
    expect(slideBackgroundOverrideStyle({})).toBeNull();
  });
});

describe("SlideCanvas pozadí slidu", () => {
  const stageOf = (container: HTMLElement) => container.firstElementChild as HTMLElement;

  it("vykreslí obrázek na pozadí (a ne černou plochu)", () => {
    const { container } = render(
      <SlideCanvas
        slide={{
          projector: { headline: "Test" },
          blocks: [],
          backgroundOverride: { image: "https://cdn.test/bg.jpg" },
        }}
      />,
    );
    const el = stageOf(container);
    expect(el.style.backgroundImage).toContain("https://cdn.test/bg.jpg");
    expect(el.style.backgroundSize).toBe("cover");
    expect(el.style.background).toBe("");
  });

  it("vykreslí vlastní barvu pozadí", () => {
    const { container } = render(
      <SlideCanvas
        slide={{
          projector: { headline: "Test" },
          blocks: [],
          backgroundOverride: { color: "#E0F2FE" },
        }}
      />,
    );
    const el = stageOf(container);
    expect(el.style.backgroundColor).toBe("rgb(224, 242, 254)");
    expect(el.style.backgroundImage).toBe("none");
  });
});
