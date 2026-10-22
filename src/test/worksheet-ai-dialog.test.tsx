import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { splitLessonActivities, defaultActivityMode } from "@/lib/worksheet-activity-modes";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const acts = [
  { id: "a", deepLinkIndex: 0 },
  { id: "b", deepLinkIndex: 1 },
  { id: "c" }, // vnořená v kartách, bez odkazu
];

describe("splitLessonActivities", () => {
  it("výchozí stav = QR u aktivit s odkazem, převod u ostatních (beze změny)", () => {
    const r = splitLessonActivities(acts, {});
    expect(r.qr.map((a) => a.id)).toEqual(["a", "b"]);
    expect(r.convert.map((a) => a.id)).toEqual(["c"]);
    expect(r.skipped).toEqual([]);
  });
  it("„Nezahrnout“ aktivitu vynechá z QR i z úloh", () => {
    const r = splitLessonActivities(acts, { a: "none", b: "convert" });
    expect(r.qr).toEqual([]);
    expect(r.convert.map((a) => a.id)).toEqual(["b", "c"]);
    expect(r.skipped.map((a) => a.id)).toEqual(["a"]);
  });
  it("aktivita bez odkazu s „none“ se nepřevede", () => {
    expect(splitLessonActivities(acts, { c: "none" }).convert).toEqual([]);
  });
  it("vše „none“ → prázdná pole", () => {
    const r = splitLessonActivities(acts, { a: "none", b: "none", c: "none" });
    expect(r.qr).toEqual([]);
    expect(r.convert).toEqual([]);
  });
  it("výchozí volba podle odkazu", () => {
    expect(defaultActivityMode(acts[0])).toBe("qr");
    expect(defaultActivityMode(acts[2])).toBe("convert");
  });
});

describe("AiSectionsBuilder rozvržení", () => {
  it("řádek sekce se zalamuje a pole se umí zmenšit", async () => {
    const { AiSectionsBuilder } = await import("@/pages/WorksheetEditor");
    render(<AiSectionsBuilder preset="custom" sections={[{ type: "mcq", count: 3, pointsPerItem: 1 }]} onPreset={() => {}} onChange={() => {}} />);
    expect(screen.getByTestId("ai-section-row").className).toContain("flex-wrap");
    expect(screen.getByTestId("ai-section-fields").className).toContain("minmax(0,1fr)");
    expect(screen.getByLabelText("Typ otázek v sekci 1").className).toContain("min-w-0");
  });
});
