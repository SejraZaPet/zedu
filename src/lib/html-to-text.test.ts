// @vitest-environment node
import { describe, it, expect } from "vitest";
import { htmlToPlainText } from "@/lib/html-to-text";
describe("htmlToPlainText", () => {
  it("strips tags and joins blocks", () => expect(htmlToPlainText("<p><strong>Distanční výuka 23. 11.</strong></p><p>Ahoj</p>")).toBe("Distanční výuka 23. 11. Ahoj"));
  it("decodes entities", () => expect(htmlToPlainText("<p>A&nbsp;B &amp; C&#39;s</p>")).toBe("A B & C's"));
  it("empty input", () => { expect(htmlToPlainText("")).toBe(""); expect(htmlToPlainText(null)).toBe(""); });
  it("plain text unchanged", () => expect(htmlToPlainText("Nový úkol: Zlomky")).toBe("Nový úkol: Zlomky"));
  it("truncates", () => expect(htmlToPlainText("<p>abcdefghij</p>", 5)).toBe("abcd…"));
});
