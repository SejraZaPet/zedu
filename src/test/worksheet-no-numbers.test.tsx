import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createDefaultItem, emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({}) },
}));

function makeSpec() {
  const spec = emptyWorksheetSpec({ title: "Bez čísel" });
  spec.variants[0].items = [
    { ...createDefaultItem("section_header", 1), prompt: "Oddíl první" },
    { ...createDefaultItem("open_answer", 2), id: "a", prompt: "Otázka alfa" },
    { ...createDefaultItem("open_answer", 3), id: "b", prompt: "Otázka beta" },
    { ...createDefaultItem("section_header", 4), prompt: "Oddíl druhý" },
    { ...createDefaultItem("open_answer", 11), id: "c", prompt: "Otázka gama" },
  ] as never;
  return spec;
}

describe("pracovní list bez čísel úloh", () => {
  it("tisk nezobrazí čísla úloh", () => {
    const html = renderWorksheetVariantHtml(makeSpec(), "A");
    expect(html).not.toContain(`class="ws-item-num"`);
    expect(html).toContain("Otázka gama");
    expect(html).not.toMatch(/11\.\s*<\/span>/);
  });

  it("obrazovka (paper) nezobrazí čísla úloh", async () => {
    const { default: WorksheetPlayer } = await import("@/components/WorksheetPlayer");
    const { container } = render(
      <MemoryRouter>
        <WorksheetPlayer {...({ spec: makeSpec(), variantId: "A" } as any)} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Otázka alfa");
    expect(text).not.toMatch(/\b(1|2|3|11)\.\s*Otázka/);
  });
});
