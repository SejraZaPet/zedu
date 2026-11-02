import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MatchingItem, { matchingOptions } from "@/components/worksheet-items/MatchingItem";
import EditorErrorBoundary from "@/components/EditorErrorBoundary";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";

const base = { id: "m1", type: "matching", itemNumber: 1, prompt: "Spoj", answerSpace: { type: "none", heightMm: 0 } };
const noop = () => {};

describe("Spojování s neúplnými páry", () => {
  it("3. pár s prázdnou pravou stranou nespadne a nabídka má 2 možnosti", () => {
    const pairs = [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "", right: "" }];
    expect(matchingOptions(pairs)).toEqual(["1", "2"]);
    expect(() => render(<MatchingItem item={{ ...base, matchPairs: pairs } as any} value={undefined} onChange={noop} disabled showResults={false} />)).not.toThrow();
  });

  it("duplicitní pravé strany jsou v nabídce jen jednou", () => {
    expect(matchingOptions([{ left: "a", right: "x" }, { left: "b", right: "x" }, { left: "c", right: "y" }])).toEqual(["x", "y"]);
  });

  it("chybějící left/right nespadne", () => {
    const pairs: any = [{ left: "a" }, { right: "z" }, null];
    expect(() => render(<MatchingItem item={{ ...base, matchPairs: pairs } as any} value={undefined} onChange={noop} disabled showResults={false} />)).not.toThrow();
  });

  it("ErrorBoundary ukáže hlášku a Zkusit znovu místo prázdné stránky", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Boom = () => { throw new Error("boom"); };
    render(<EditorErrorBoundary resetKey="k"><Boom /></EditorErrorBoundary>);
    expect(screen.getByRole("alert").textContent).toContain("Náhled této aktivity se nepodařilo zobrazit");
    expect(screen.getByRole("button", { name: "Zkusit znovu" })).toBeTruthy();
    spy.mockRestore();
  });

  it("tisk s prázdným párem nevyhodí výjimku a pár vynechá", () => {
    const spec: any = {
      specVersion: "1", worksheetId: "w1", title: "T", subject: "S", grade: 1, language: "cs-CZ",
      variants: [{ variantId: "A", seed: 1, items: [{ ...base, matchPairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "", right: "" }] }] }],
      answerKeys: { A: [] }, randomizationRules: [], header: { title: "T", studentNameField: true }, renderConfig: { showPoints: false, includeAnswerKey: false },
    };
    let html = "";
    expect(() => { html = renderWorksheetVariantHtml(spec, "A"); }).not.toThrow();
    expect(html).toContain("2. b");
    expect(html).not.toContain("<td>3. ");
  });
});
