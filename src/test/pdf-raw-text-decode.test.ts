import { describe, it, expect } from "vitest";
import { decodePdfLiteral, decodePdfTextBytes } from "@/lib/pdf-raw-text-decode";

const SAMPLE = "Řešení problémů, přátel, udržovat, nedorozumění, Snaž se, říkají, často, tělo, sdělujeme, vše, obličeje, ČĎĚŇŘŠŤŮŽ ďňť";

const toUtf16beBytes = (s: string, bom = false) =>
  (bom ? "\u00fe\u00ff" : "") + Array.from(s).map((c) => {
    const n = c.charCodeAt(0);
    return String.fromCharCode(n >> 8) + String.fromCharCode(n & 0xff);
  }).join("");

const toOctalLiteral = (bytes: string) =>
  Array.from(bytes).map((c) => "\\" + c.charCodeAt(0).toString(8).padStart(3, "0")).join("");

describe("raw PDF text decoding keeps Czech diacritics", () => {
  it("decodes UTF-16BE strings without BOM (Identity-H style)", () => {
    expect(decodePdfTextBytes(toUtf16beBytes(SAMPLE))).toBe(SAMPLE.normalize("NFC"));
  });
  it("decodes UTF-16BE strings with BOM", () => {
    expect(decodePdfTextBytes(toUtf16beBytes(SAMPLE, true))).toBe(SAMPLE);
  });
  it("decodes octal-escaped UTF-16BE literals", () => {
    expect(decodePdfLiteral(toOctalLiteral(toUtf16beBytes("přátel tělo")))).toBe("přátel tělo");
  });
  it("never produces the broken low-byte form", () => {
    const out = decodePdfTextBytes(toUtf16beBytes("Řešení přátel"));
    expect(out).not.toContain("Yeaen");
    expect(out).not.toContain("pYátel");
  });
  it("leaves plain single-byte literals unchanged", () => {
    expect(decodePdfLiteral("Hello \\(world\\)")).toBe("Hello (world)");
  });
});
