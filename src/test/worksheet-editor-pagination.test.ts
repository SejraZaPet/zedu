import { describe, expect, it } from "vitest";
import type { WorksheetItem } from "@/lib/worksheet-spec";
import { paginateWorksheetEditorItems } from "@/lib/worksheet-editor-pagination";

const item = (id: string) => ({ id } as WorksheetItem);

describe("paginateWorksheetEditorItems", () => {
  it("keeps item order and uses the smaller first page", () => {
    const items = [item("a"), item("b"), item("c")];
    const pages = paginateWorksheetEditorItems(items, { a: 300, b: 300, c: 300 }, {
      firstPageCapacity: 500,
      pageCapacity: 700,
      gap: 20,
    });
    expect(pages.map((page) => page.items.map((entry) => entry.id))).toEqual([["a"], ["b", "c"]]);
  });

  it("places an oversized item on its own page", () => {
    const pages = paginateWorksheetEditorItems([item("a"), item("b")], { a: 900, b: 100 }, {
      firstPageCapacity: 700,
      pageCapacity: 700,
      gap: 20,
    });
    expect(pages[0].items.map((entry) => entry.id)).toEqual(["a"]);
    expect(pages[0].hasOversizedItem).toBe(true);
    expect(pages[1].items.map((entry) => entry.id)).toEqual(["b"]);
  });
});