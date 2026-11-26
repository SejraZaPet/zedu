import { describe, it, expect } from "vitest";
import { headlineTextStyle } from "@/lib/slide-contrast";
import { PRESENTATION_TEMPLATES } from "@/lib/presentation-templates";

describe("headlineTextStyle", () => {
  it("přechodový nadpis nepoužívá zkratku background (ta ruší background-clip)", () => {
    const s = headlineTextStyle({ primary: "#6EC6D9", secondary: "#9B6CFF" }, true) as any;
    expect(s.background).toBeUndefined();
    expect(s.backgroundImage).toContain("linear-gradient");
    expect(s.backgroundClip).toBe("text");
    expect(s.WebkitBackgroundClip).toBe("text");
  });
  it("při shodě barev s přechodem pozadí použije jednolitou kontrastní barvu", () => {
    const s = headlineTextStyle({ primary: "#6EC6D9", secondary: "#9B6CFF" }, true, ["#6ec6d9", "#9B6CFF"]) as any;
    expect(s).toEqual({ color: "#FFFFFF" });
  });
  it("tmavá barva na tmavém pozadí → bílý text", () => {
    expect(headlineTextStyle({ primary: "#2B1A3F", secondary: "#9B6CFF" }, true)).toEqual({ color: "#FFFFFF" });
  });
  it("neznámá barva → jednolitý text, nikdy průhledný", () => {
    expect(headlineTextStyle({ primary: "var(--x)", secondary: "#fff" }, false)).toEqual({ color: "#0F172A" });
  });
});

describe("Prázdná prezentace", () => {
  it("začíná bez skrytého nadpisu", () => {
    const t = PRESENTATION_TEMPLATES.find((x: any) => x.id === "blank")!;
    const [slide] = t.build() as any[];
    expect(slide.projector.headline).toBe("");
    expect(slide.hideEmptyEditorPlaceholders).toBe(true);
    expect(slide.blocks).toEqual([]);
  });
});
