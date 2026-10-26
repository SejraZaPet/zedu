import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/notebook", async (orig) => {
  const actual = await orig<typeof import("@/lib/notebook")>();
  return { ...actual, signNotebookImages: vi.fn(async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, `https://x/${p}`]))) };
});

import NotebookPageThumb from "@/components/notebook/NotebookPageThumb";
import NotebookPageStrip from "@/components/notebook/NotebookPageStrip";

const page = (id: string, extra: any = {}) => ({
  id, notebook_id: "n", position: 0, title: null, section: null, background_style: "blank",
  content: { strokes: [], textBoxes: [], images: [], ...extra },
}) as any;

describe("sešit na tabletu", () => {
  it("miniatura vykreslí obrázek listu jako vrstvu pod tahy a nemění obsah", async () => {
    const content = { strokes: [], textBoxes: [], images: [{ id: "i1", path: "a/p1.jpg", x: 0, y: 0, w: 1, h: 1, locked: true }] };
    const snapshot = JSON.stringify(content);
    const { container } = render(<NotebookPageThumb content={content as any} backgroundStyle="blank" />);
    await waitFor(() => expect(container.querySelector("[data-thumb-image]")).not.toBeNull());
    const img = container.querySelector("[data-thumb-image]")!;
    // obrázek je před canvasem (tahy se kreslí nad ním)
    expect(img.compareDocumentPosition(container.querySelector("canvas")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(JSON.stringify(content)).toBe(snapshot);
  });

  it("pruh stránek označí aktivní stránku, výběr a přidání fungují", () => {
    const onSelect = vi.fn(); const onAdd = vi.fn();
    render(<NotebookPageStrip pages={[page("a"), page("b")]} activeIndex={1} onSelect={onSelect} onAdd={onAdd} onDuplicate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Stránka 2/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /^Stránka 1/ }).getAttribute("aria-current")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Stránka 1/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Přidat stránku" }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Možnosti stránky 2" })).toBeTruthy();
  });
});
