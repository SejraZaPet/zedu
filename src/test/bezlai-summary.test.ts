import { describe, expect, it } from "vitest";
import { parseBezlaiSummary, practiceSourceFromBezlaiSummary, summaryPracticeUrl } from "@/lib/bezlai-summary";
import { SOURCE_TEXT_LIMIT } from "../../supabase/functions/_shared/practice-phases";

 describe("Bezlai – koncept poznámek", () => {
  it("rozdělí název, hlavní body a zdroje do upravitelného konceptu", () => {
    expect(parseBezlaiSummary("NÁZEV: Hovězí maso\nHLAVNÍ BODY:\n- Rozdělení masa\n- Tepelná úprava\nZDROJE:\n- Můj materiál")).toEqual({
      title: "Hovězí maso",
      text: "Hlavní body:\n- Rozdělení masa\n- Tepelná úprava\n\nZdroje:\n- Můj materiál",
    });
  });

  it("neočekávaný AI výstup nezahodí a doplní bezpečný název", () => {
    expect(parseBezlaiSummary("Vlastní text bez struktury")).toEqual({ title: "Poznámky z Bezlai", text: "Vlastní text bez struktury" });
  });

  it("do procvičování předá jen text v rámci existujícího limitu", () => {
    const source = practiceSourceFromBezlaiSummary({ title: "Téma", text: "x".repeat(SOURCE_TEXT_LIMIT + 100) });
    expect(source.kind).toBe("text");
    expect(source.label).toBe("Bezlai – Téma");
    expect(source.text.length).toBe(SOURCE_TEXT_LIMIT);
    expect(summaryPracticeUrl("flashcards")).toBe("/student/z-materialu?typ=flashcards");
    expect(summaryPracticeUrl("mcq")).toBe("/student/z-materialu?typ=mcq");
  });
});
