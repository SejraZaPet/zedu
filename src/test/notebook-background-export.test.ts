import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ createSignedUrls: storage }) } } }));
import { loadNotebookImage, renderPageToCanvas, signNotebookImages } from "@/lib/notebook";

beforeEach(() => { storage.mockReset(); });
afterEach(() => vi.restoreAllMocks());

describe("strict notebook background export", () => {
  it("handles signing service errors while preserving legacy best-effort callers", async () => {
    storage.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(signNotebookImages(["p"], { strict: true })).rejects.toThrow();
    await expect(signNotebookImages(["p"])).resolves.toEqual({});
  });
  it("rejects individual signing failures and missing signed paths", async () => {
    storage.mockResolvedValue({ data: [{ path: "p", signedUrl: "/p", error: "missing" }], error: null });
    await expect(signNotebookImages(["p"], { strict: true })).rejects.toThrow();
    storage.mockResolvedValue({ data: [], error: null });
    await expect(signNotebookImages(["p"], { strict: true })).rejects.toThrow();
  });
  it("stops export after two unsuccessful signing attempts", async () => {
    storage.mockResolvedValue({ data: [], error: null });
    await expect(loadNotebookImage("p")).rejects.toThrow("Export ani odevzdání nejsou dokončené");
    expect(storage).toHaveBeenCalledTimes(2);
  });
  it("rejects a pen page that has lost its locked background", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect() {}, save() {}, restore() {},
    } as unknown as CanvasRenderingContext2D);
    await expect(renderPageToCanvas({ background_style: "blank", content: {
      strokes: [], textBoxes: [], images: [], worksheet: { worksheetId: "ws", mode: "pen", title: "List" },
    } }, 1, { requireImages: true })).rejects.toThrow("Chybí podklad");
  });
});