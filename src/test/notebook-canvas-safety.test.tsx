import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotebookCanvas from "@/components/notebook/NotebookCanvas";
import NotebookPageThumb from "@/components/notebook/NotebookPageThumb";
import { backgroundCss } from "@/lib/notebook";
import {
  NOTEBOOK_CANVAS_MAX_EDGE,
  NOTEBOOK_CANVAS_MAX_PIXELS,
  notebookCanvasSurface,
} from "@/lib/notebook-canvas";

const emptyContent = { strokes: [], textBoxes: [], images: [] };
const renderCanvas = () => render(
  <NotebookCanvas ownerId="student" content={emptyContent} backgroundStyle="blank" onChange={() => {}} />,
);

function mock2dContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  localStorage.clear();
  (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(1131);
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("bezpečné plátno sešitu", () => {
  it("neposílá desynchronized a ponechává bílý papír pod průhlednými canvasy", () => {
    const context = mock2dContext();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    renderCanvas();

    const stage = screen.getByTestId("nb-stage");
    const canvases = [screen.getByTestId("nb-strokes-canvas"), screen.getByTestId("nb-live-canvas")];
    expect(stage.style.backgroundColor).toBe("rgb(255, 255, 255)");
    for (const canvas of canvases) expect(canvas.style.backgroundColor).toBe("transparent");
    expect(getContext.mock.calls.length).toBeGreaterThan(0);
    for (const call of getContext.mock.calls) {
      expect(call[0]).toBe("2d");
      expect(call[1]).toBeUndefined();
    }
  });

  it("zůstane bílý a vykreslený i tehdy, když prohlížeč nepřidělí 2D kontext", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    expect(renderCanvas).not.toThrow();
    expect(screen.getByTestId("nb-stage").style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(screen.getByTestId("nb-strokes-canvas").style.visibility).toBe("hidden");
    expect(screen.getByTestId("nb-live-canvas").style.visibility).toBe("hidden");
    expect(screen.getByRole("button", { name: "Pero" })).toBeEnabled();
  });

  it("po obnově ztraceného kontextu znovu vykreslí uložené tahy", async () => {
    const context = mock2dContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    renderCanvas();
    const canvas = screen.getByTestId("nb-strokes-canvas");
    const clearCount = vi.mocked(context.clearRect).mock.calls.length;

    const lost = new Event("contextlost", { cancelable: true });
    fireEvent(canvas, lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(canvas.style.visibility).toBe("hidden");
    fireEvent(canvas, new Event("contextrestored"));

    await waitFor(() => expect(vi.mocked(context.clearRect).mock.calls.length).toBeGreaterThan(clearCount));
    expect(canvas.style.visibility).toBe("visible");
  });

  it("miniatura má rovněž průhledný canvas a po obnově kontextu se překreslí", async () => {
    const context = mock2dContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const { container } = render(<NotebookPageThumb content={emptyContent} backgroundStyle="blank" />);
    const canvas = container.querySelector("canvas")!;
    const clearCount = vi.mocked(context.clearRect).mock.calls.length;

    expect(canvas.style.backgroundColor).toBe("transparent");
    fireEvent(canvas, new Event("contextrestored"));
    await waitFor(() => expect(vi.mocked(context.clearRect).mock.calls.length).toBeGreaterThan(clearCount));
  });

  it("omezuje bitmapu při vysokém DPR a velkém přiblížení bez změny souřadnic", () => {
    const surface = notebookCanvasSurface(2050, 2899, 3);

    expect(surface.width).toBeLessThanOrEqual(NOTEBOOK_CANVAS_MAX_EDGE);
    expect(surface.height).toBeLessThanOrEqual(NOTEBOOK_CANVAS_MAX_EDGE);
    expect(surface.width * surface.height).toBeLessThanOrEqual(NOTEBOOK_CANVAS_MAX_PIXELS);
    expect(surface.scaleX).toBe(surface.width / 2050);
    expect(surface.scaleY).toBe(surface.height / 2899);
  });

  it("neznámý nebo chybějící styl pozadí vždy doplní bílým papírem", () => {
    for (const style of [undefined, null, "unknown"]) {
      const css = backgroundCss(style as "blank", 0.8);
      expect(css.backgroundColor).toBe("#ffffff");
      expect(css.backgroundImage).toBeUndefined();
    }
    expect(backgroundCss("lined", 0.8).backgroundImage).toContain("repeating-linear-gradient");
  });
});
