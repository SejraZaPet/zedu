import { describe, expect, it } from "vitest";
import { createWriteLinePatch, getWriteLineCount } from "@/lib/worksheet-write-lines";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";

describe("worksheet write lines compatibility", () => {
  it("prefers the legacy top-level count when both stored values differ", () => {
    expect(getWriteLineCount({ lineCount: 7, answerSpace: { type: "lines", heightMm: 30, lineCount: 19 } })).toBe(7);
  });

  it("falls back to the answer-space count for older compatible data", () => {
    expect(getWriteLineCount({ answerSpace: { type: "lines", heightMm: 45, lineCount: 6 } })).toBe(6);
  });

  it("updates count and derived print height as one patch", () => {
    expect(createWriteLinePatch({ answerSpace: { type: "none", heightMm: 0 } }, 4)).toEqual({
      lineCount: 4,
      answerSpace: { type: "lines", lineCount: 4, heightMm: 30 },
    });
  });

  it("clamps unsupported values", () => {
    expect(getWriteLineCount({ lineCount: 30, answerSpace: { type: "lines", heightMm: 30 } })).toBe(20);
    expect(createWriteLinePatch({ answerSpace: { type: "lines", heightMm: 30 } }, 0).lineCount).toBe(1);
  });

  it("prints a legacy item from its compatible answer-space count", () => {
    const spec: any = {
      specVersion: "1",
      worksheetId: "write-lines-test",
      title: "Test",
      subject: "Test",
      grade: 1,
      language: "cs-CZ",
      variants: [{
        variantId: "A",
        seed: 1,
        items: [{
          id: "lines",
          type: "write_lines",
          itemNumber: 1,
          prompt: "Napište odpověď",
          difficulty: "easy",
          timeEstimateSec: 30,
          answerSpace: { type: "lines", heightMm: 45, lineCount: 6 },
        }],
      }],
      answerKeys: { A: [] },
      randomizationRules: [],
      header: { title: "Test", studentNameField: true },
      renderConfig: { showPoints: false, pointsEnabled: false, includeAnswerKey: false },
    };

    const html = renderWorksheetVariantHtml(spec, "A");
    expect(html.match(/border-bottom:1px dotted #999/g)).toHaveLength(6);
  });
});
