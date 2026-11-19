import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildInquiryRow, CURRENT_TERMS_VERSION } from "../../supabase/functions/_shared/license-inquiry";
import { TERMS_VERSION } from "@/lib/terms";

const ok = { name: "[TEST] Jan", email: "jan@example.cz", plan: "Start", termsVersion: TERMS_VERSION, termsAcceptedAt: "2000-01-01T00:00:00Z" };

describe("uložení poptávky", () => {
  it("serverová verze podmínek odpovídá webu", () => expect(CURRENT_TERMS_VERSION).toBe(TERMS_VERSION));
  it("bez souhlasu nebo se starou verzí odmítne", () => {
    expect("error" in buildInquiryRow({ ...ok, termsVersion: undefined }, "x")).toBe(true);
    expect("error" in buildInquiryRow({ ...ok, termsVersion: "0.9" }, "x")).toBe(true);
  });
  it("čas souhlasu určí server, ne prohlížeč", () => {
    const r = buildInquiryRow(ok, "2026-11-19T18:00:00.000Z");
    expect("row" in r && r.row.consent_accepted_at).toBe("2026-11-19T18:00:00.000Z");
    expect("row" in r && r.row.consent_terms_version).toBe("1.0");
  });
  it("zdroj demo bez ověření a neznámý zdroj → form", () => {
    expect("row" in buildInquiryRow({ ...ok, source: "demo" }, "x") && (buildInquiryRow({ ...ok, source: "demo" }, "x") as any).row.source).toBe("form");
    expect((buildInquiryRow({ ...ok, source: "hack" }, "x") as any).row.source).toBe("form");
  });
  it("neplatný e-mail a chybějící pole odmítne", () => {
    expect(buildInquiryRow({ ...ok, email: "x" }, "x")).toMatchObject({ status: 400 });
    expect(buildInquiryRow({ ...ok, plan: "" }, "x")).toMatchObject({ status: 400 });
  });
  it("funkce ukládá před e-mailem, selhání e-mailu vrátí úspěch a neloguje obsah", () => {
    const src = readFileSync("supabase/functions/send-license-inquiry/index.ts", "utf8");
    expect(src.indexOf('from("license_inquiries").insert')).toBeLessThan(src.indexOf("api.resend.com"));
    expect(src).toContain('markEmail("failed", `HTTP ${res.status}`)');
    const logs = src.split("\n").filter((l) => l.includes("console."));
    for (const l of logs) expect(l).not.toMatch(/built\.row|errBody|String\(|\b(email|phone|message|organization)\b(?!_)|[^.]\bname\b/);
  });
});
