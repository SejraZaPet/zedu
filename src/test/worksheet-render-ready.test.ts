import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForWorksheetRender } from "@/lib/worksheet-render-ready";
afterEach(() => vi.useRealTimers());

describe("worksheet page render readiness", () => {
  it("waits beyond 400 ms until pagination actually completes", async () => {
    vi.useFakeTimers();
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = '<div class="ws-page"></div>';
    doc.body.dataset.wsRenderState = "loading";
    let done = false;
    const result = waitForWorksheetRender(doc).then((pages) => { done = true; return pages; });
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(false);
    doc.body.dataset.wsRenderState = "ready";
    await vi.advanceTimersByTimeAsync(25);
    expect(await result).toHaveLength(1);
  });
  it("rejects a failed pagination instead of rasterizing incomplete pages", async () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.dataset.wsRenderState = "error";
    await expect(waitForWorksheetRender(doc)).rejects.toThrow();
  });
  it("rejects failed images even after pagination finishes", async () => {
    const doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = '<div class="ws-page"><img src="/missing.jpg"></div>';
    Object.defineProperty(doc.images[0], "complete", { value: true });
    doc.body.dataset.wsRenderState = "ready";
    await expect(waitForWorksheetRender(doc)).rejects.toThrow("Obrázek");
  });
});