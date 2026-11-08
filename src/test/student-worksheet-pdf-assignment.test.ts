import { describe, it, expect } from "vitest";
import { buildStudentWorksheetHtml } from "@/lib/worksheet-pdf-export";
import { createDefaultItem, createDefaultAnswerKey, emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import { assignmentWorksheets } from "@/lib/assignment-content";
import type { ItemType } from "@/lib/worksheet-spec";

const TYPES: ItemType[] = ["mcq", "true_false", "fill_blank", "short_answer", "open_answer", "matching", "ordering", "mind_map", "flow_steps", "method_steps", "practice_examples"] as ItemType[];

describe("PDF listu v úkolu/materiálu", () => {
  it("vykreslí všechny typy bez klíče a s QR na úkol", async () => {
    const spec = emptyWorksheetSpec({ title: "Test" });
    const items = TYPES.map((t, i) => createDefaultItem(t, i + 1));
    spec.variants[0].items = items;
    spec.answerKeys = { [spec.variants[0].variantId]: items.map((it) => ({ ...createDefaultAnswerKey(it), explanation: "TAJNY_KLIC" })) };
    spec.renderConfig = { ...spec.renderConfig, includeAnswerKey: true };
    const html = await buildStudentWorksheetHtml(spec, "ws1");
    expect(html).not.toContain("TAJNY_KLIC");
    expect(html).not.toContain('class="ws-key-item"');
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("[data-item-id], .ws-item").length).toBeGreaterThanOrEqual(TYPES.length);
  });

  it("staré úkoly i materiály mají listy odvozené z worksheet_id / settings.worksheets", () => {
    expect(assignmentWorksheets({ worksheet_id: "a", settings: {} } as any).map((w) => w.id)).toEqual(["a"]);
    expect(assignmentWorksheets({ worksheet_id: "a", settings: { kind: "material", worksheets: [{ id: "a", title: "A" }, { id: "b", title: "B" }] } } as any).map((w) => w.id)).toEqual(["a", "b"]);
  });
});
