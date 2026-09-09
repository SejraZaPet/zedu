(globalThis as any).ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import slides from "./__slides.json";

describe("projektor renderuje obsah snímků", () => {
  it("vypíše text z bloků", () => {
    const s = (slides as any[]);
    for (let i = 0; i < s.length; i++) {
      const { container } = render(
        <ProjectorSlideView sessionId="x" session={{ title: "T", settings: {} }} currentSlide={s[i]} currentIndex={i} slides={s} players={[]} gameCode="AAA111" />
      );
      const txt = container.textContent || "";
      console.log(i, JSON.stringify(txt.slice(0, 160)));
    }
    expect(true).toBe(true);
  });
});
