import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SlideTransitionScene from "@/components/live/SlideTransitionScene";
import type { SlideTransitionConfig } from "@/lib/slide-transitions";

const config: SlideTransitionConfig = { style: "match-move", direction: "left", duration: 0.8 };
let reducedMotion = false;
let rectSpy: ReturnType<typeof vi.spyOn>;
let animateSpy: ReturnType<typeof vi.fn>;
let mediaSpy: ReturnType<typeof vi.spyOn>;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

beforeEach(() => {
  reducedMotion = false;
  rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rect(0, 0, 100, 50));
  animateSpy = vi.fn(() => ({ cancel: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, writable: true, value: animateSpy });
  mediaSpy = vi.spyOn(window, "matchMedia").mockImplementation(() => ({ matches: reducedMotion }) as MediaQueryList);
});

afterEach(() => {
  cleanup();
  rectSpy.mockRestore();
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  mediaSpy.mockRestore();
});

function Example({ index }: { index: number }) {
  return (
    <SlideTransitionScene config={config} transitionKey={index}>
      <div
        data-testid="matched"
        data-slide-transition-match="text:nadpis"
        ref={(node) => {
          if (node) node.getBoundingClientRect = () => index === 0 ? rect(10, 20, 100, 50) : rect(210, 120, 200, 100);
        }}
      >Nadpis {index}</div>
    </SlideTransitionScene>
  );
}

describe("Match & move ve sdílené scéně", () => {
  it("přesune a změní velikost shodně pojmenovaného prvku", () => {
    const view = render(<Example index={0} />);
    view.rerender(<Example index={1} />);
    expect(animateSpy).toHaveBeenCalledTimes(1);
    const frames = animateSpy.mock.calls[0][0] as Keyframe[];
    expect(frames[0]).toMatchObject({ translate: "-250px -125px", scale: "0.5 0.5" });
    expect(frames[1]).toMatchObject({ translate: "0px 0px", scale: "1 1" });
    expect(animateSpy.mock.calls[0][1]).toMatchObject({ duration: 800 });
  });

  it("bez shody použije prolnutí a neanimuje samostatné prvky", () => {
    const view = render(
      <SlideTransitionScene config={config} transitionKey={0}><div data-slide-transition-match="text:a">A</div></SlideTransitionScene>,
    );
    view.rerender(
      <SlideTransitionScene config={config} transitionKey={1}><div data-slide-transition-match="text:b">B</div></SlideTransitionScene>,
    );
    expect(animateSpy).not.toHaveBeenCalled();
    expect(view.container.querySelector("[data-slide-transition='match-move']")?.className).toContain("slide-trans-match-move");
  });

  it("prefers-reduced-motion vypne FLIP animaci", () => {
    reducedMotion = true;
    const view = render(<Example index={0} />);
    view.rerender(<Example index={1} />);
    expect(animateSpy).not.toHaveBeenCalled();
  });
});
