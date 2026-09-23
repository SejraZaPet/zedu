import { describe, it, expect } from "vitest";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";
import { emptyWorksheetSpec } from "@/lib/worksheet-defaults";

const spec = () => emptyWorksheetSpec({ title: "Test list" } as any);

describe("Poznámky pro učitele v tisku", () => {
  it("žákovská verze poznámky nikdy neobsahuje", () => {
    const html = renderWorksheetVariantHtml(spec(), spec().variants[0].variantId, {
      teacherNotes: "TAJNÁ POZNÁMKA",
    });
    expect(html).not.toContain("TAJNÁ POZNÁMKA");
    expect(html).not.toContain("ws-teacher-block");
  });

  it("verze pro učitele obsahuje poznámky, nadpisy sekcí a klíč", () => {
    const s = spec();
    const html = renderWorksheetVariantHtml(s, s.variants[0].variantId, {
      teacherVersion: true,
      teacherNotes: "## Dělení masa\n- 10 min",
    });
    expect(html).toContain("Verze pro učitele");
    expect(html).toContain("<h3>Dělení masa</h3>");
    expect(html).toContain("ws-teacher-notes");
  });
});
