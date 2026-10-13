import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("šířka otázky v papírovém editoru", () => {
  const css = readFileSync("src/styles/worksheet-editor.css", "utf8");

  it("otázka zabírá pružný první sloupec, body druhý, bez původního sloupce čísla", () => {
    const rule = css.match(/\.worksheet-paper-prompt\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(rule).not.toContain("18pt");
  });

  it("povolí normální zalamování a bezpečné zalomení dlouhého slova", () => {
    const rule = css.match(/\.worksheet-paper-prompt > :first-child\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("min-width: 0;");
    expect(rule).toContain("white-space: normal;");
    expect(rule).toContain("word-break: normal;");
    expect(rule).toContain("overflow-wrap: anywhere;");
  });
});