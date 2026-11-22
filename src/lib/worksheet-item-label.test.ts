import { describe, it, expect } from "vitest";
import { worksheetItemLabel } from "./worksheet-item-label";

describe("worksheetItemLabel", () => {
  it("uses prompt", () => expect(worksheetItemLabel({ id: "a", type: "mcq", prompt: "Kolik je 2+2?" })).toBe("Kolik je 2+2?"));
  it("strips html", () => expect(worksheetItemLabel({ id: "a", prompt: "<b>Tučně</b> text" })).toBe("Tučně text"));
  it("table caption", () => expect(worksheetItemLabel({ id: "t", type: "table", prompt: "", tableCaption: "Tabulka živin" })).toBe("Tabulka živin"));
  it("two boxes title", () => expect(worksheetItemLabel({ id: "b", type: "two_boxes", prompt: "", leftTitle: "Výhody" })).toBe("Výhody"));
  it("preceding heading", () => {
    const items = [{ id: "h", type: "section_header", prompt: "Popiš trávení" }, { id: "w", type: "write_lines", prompt: "", itemNumber: 3 }];
    expect(worksheetItemLabel(items[1], items)).toBe("Popiš trávení (úloha 3)");
  });
  it("fallback", () => expect(worksheetItemLabel({ id: "w", type: "blank_box", prompt: "", itemNumber: 2 }, [])).toBe("Úloha 2"));
});
