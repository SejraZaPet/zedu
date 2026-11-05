import { describe, it, expect } from "vitest";
import { normalizeAiProps, assertAiFillContent, AI_FILL_EMPTY_ERROR } from "@/lib/activity-ai-normalize";

const blanks = (p: any) => p.fillChoice.tokens.filter((t: any) => t.type === "blank").map((t: any) => t.answer);

describe("AI Doplň z nabídky", () => {
  it("řetězec text vytvoří tokeny a nabídku s odpovědí i distraktory", () => {
    const p = normalizeAiProps({ fillChoice: { text: "Pes {{štěká}}.", options: ["mňouká"] } });
    expect(blanks(p)).toEqual(["štěká"]);
    expect(p.fillChoice.options.sort()).toEqual(["mňouká", "štěká"]);
  });
  it("text jako pole vět vytvoří tokeny", () => {
    const p = normalizeAiProps({ fillChoice: { text: ["A {{x}}.", "B {{y}}."] } });
    expect(blanks(p)).toEqual(["x", "y"]);
  });
  it("fillChoice jako pole {text} vytvoří tokeny", () => {
    const p = normalizeAiProps({ fillChoice: [{ text: "A {{x}}." }, { text: "B {{y}}.", options: ["z"] }] });
    expect(blanks(p)).toEqual(["x", "y"]);
    expect(p.fillChoice.options).toContain("z");
  });
  it("výstup bez místa k doplnění vyhodí chybu", () => {
    const p = normalizeAiProps({ fillChoice: { text: "Bez mezer.", tokens: [] } });
    expect(() => assertAiFillContent("fill_choice", p)).toThrow(AI_FILL_EMPTY_ERROR);
  });
});
