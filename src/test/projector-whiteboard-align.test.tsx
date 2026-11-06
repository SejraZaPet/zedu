import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("@/components/admin/SlideCanvas", () => ({ default: () => <div data-testid="canvas" /> }));
import ProjectorSlideView from "@/components/live/ProjectorSlideView";

class RO { observe() {} disconnect() {} unobserve() {} }
(globalThis as any).ResizeObserver = RO;

describe("ProjectorSlideView – tabule sedí na snímek", () => {
  it("tabule i snímek jsou ve stejné škálované scéně, ovládání mimo ni", () => {
    const slide = { type: "explain", blocks: [{ id: "b", type: "text", content: "x" }] };
    render(
      <ProjectorSlideView sessionId="s" session={{ title: "[TEST]", settings: {} }} currentSlide={slide} currentIndex={0}
        slides={[slide]} players={[]} gameCode="ABC" userZoom={130}
        overlayContent={<div data-testid="wb" />} />,
    );
    const stageOf = (el: HTMLElement) => {
      let n: HTMLElement | null = el;
      while (n && !(n.style.transform || "").includes("scale(") ) n = n.parentElement;
      // najdi nejvzdálenější scénu (vnější)
      let outer = n;
      while (n) { if ((n.style.transform || "").includes("scale(")) outer = n; n = n.parentElement; }
      return outer;
    };
    const wbStage = stageOf(screen.getByTestId("wb"));
    expect(wbStage).not.toBeNull();
    expect(wbStage).toBe(stageOf(screen.getByTestId("canvas")));
    expect(wbStage!.contains(screen.getByTestId("projector-code"))).toBe(false);
  });
});
