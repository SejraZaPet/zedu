import { describe, it, expect } from "vitest";
import { worksheetItemLabel, worksheetItemLabelNumbered } from "./worksheet-item-label";

const list = [
  { id: "h1", type: "section_header", prompt: "Název pokrmu:", itemNumber: 1 },
  { id: "b2", type: "blank_box", prompt: "", itemNumber: 2 },
  { id: "h3", type: "section_header", prompt: "Suroviny:", itemNumber: 3 },
  { id: "b4", type: "blank_box", prompt: "", itemNumber: 4 },
];

describe("worksheetItemLabel", () => {
  it("uses prompt", () => expect(worksheetItemLabel({ id: "a", type: "mcq", prompt: "Kolik je 2+2?" })).toBe("Kolik je 2+2?"));
  it("strips html", () => expect(worksheetItemLabel({ id: "a", prompt: "<b>Tučně</b> text" })).toBe("Tučně text"));
  it("table caption", () => expect(worksheetItemLabel({ id: "t", type: "table", prompt: "", tableCaption: "Tabulka živin" })).toBe("Tabulka živin"));
  it("heading before blank_box, without number or colon", () => {
    expect(worksheetItemLabel(list[1], list)).toBe("Název pokrmu");
    expect(worksheetItemLabel(list[3], list)).toBe("Suroviny");
  });
  it("type name instead of Úloha N", () => expect(worksheetItemLabel({ id: "w", type: "blank_box", prompt: "", itemNumber: 2 })).toBe("Volná odpověď"));
  it("never returns Úloha N", () => {
    for (const it of [...list, { id: "x", type: "unknown", itemNumber: 9 }]) expect(worksheetItemLabel(it, list)).not.toMatch(/Úloha \d/);
  });
  it("numbered variant only for derived labels", () => {
    expect(worksheetItemLabelNumbered(list[1], list)).toBe("Název pokrmu (č. 2)");
    expect(worksheetItemLabelNumbered({ id: "q", prompt: "Otázka", itemNumber: 5 })).toBe("Otázka");
  });
  it("truncates long text", () => expect(worksheetItemLabel({ id: "l", prompt: "a".repeat(300) }).length).toBe(140));
});
