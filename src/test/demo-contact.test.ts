import { describe, it, expect } from "vitest";
import {
  buildDemoFinalEmail, buildDemoReminderEmail, DEMO_CONSENT_TEXT, DEMO_CONSENT_VERSION,
  DEMO_FINAL_NOTICE_CONSENT_VERSION, demoCountdownText, demoExtendedText, formatDemoLastDay,
  isDemoFinalClaimStale, isDemoFinalNoticeAllowed, normalizeDemoEmail, sha256Hex, showCountdown,
} from "../../supabase/functions/_shared/demo-contact";
import { DEMO_EXPORT_MAX_ITEMS, exportLimitMessage, onlyOwnRows, uniqueName } from "@/lib/demo-export";

describe("demo kontakt", () => {
  it("souhlas v1 zůstává beze změny a závěrečnou zprávu nepovoluje", () => {
    expect(DEMO_CONSENT_VERSION).toBe("2026-11-19.v1");
    expect(DEMO_CONSENT_TEXT).toBe("Souhlasím, aby Bezli použilo můj e-mail jen k připomenutí smazání ukázkového účtu a k převodu mé práce do ostrého účtu. Žádné novinky ani reklamu. Souhlas mohu kdykoli odvolat; e-mail smažeme nejpozději se smazáním dema.");
    expect(isDemoFinalNoticeAllowed(DEMO_CONSENT_VERSION)).toBe(false);
    expect(isDemoFinalNoticeAllowed("2026-11-21.v2")).toBe(true);
    expect(DEMO_FINAL_NOTICE_CONSENT_VERSION).toBe("2026-11-21.v2");
  });
  it("odmítne neplatný a vymyšlený demo e-mail", () => {
    expect(normalizeDemoEmail("x")).toBeNull();
    expect(normalizeDemoEmail("ucitel-1@demo.bezli.cz")).toBeNull();
    expect(normalizeDemoEmail(" Jana@Skola.CZ ")).toBe("jana@skola.cz");
  });
  it("odpočet se ukáže až od 3 dnů", () => {
    expect(showCountdown(4)).toBe(false);
    expect(showCountdown(3)).toBe(true);
    expect(showCountdown(0)).toBe(true);
    expect(showCountdown(null)).toBe(false);
  });
  it("připomínka D−0 říká dnes o půlnoci a obsahuje odhlášení", () => {
    const e = buildDemoReminderEmail({ kind: "0d", deletesAt: "2026-11-27T23:00:00Z", unsubscribeUrl: "https://x/u?t=abc" });
    expect(e.subject).toBe("Váš ukázkový účet Bezli se smaže dnes o půlnoci");
    expect(e.text).toContain("dnes o půlnoci (27. 11. 2026)");
    expect(e.text).toContain("https://x/u?t=abc");
    expect(e.html).toContain("27. 11. 2026");
  });
  it("připomínka D−3 říká za 3 dny", () => {
    expect(buildDemoReminderEmail({ kind: "3d", deletesAt: "2026-11-27T23:00:00Z", unsubscribeUrl: "u" }).subject).toContain("za 3 dny");
  });
  it("poslední den dema určí správně v zimním i letním čase", () => {
    expect(formatDemoLastDay("2026-12-06T23:00:00Z")).toBe("6. 12. 2026");
    expect(formatDemoLastDay("2026-06-07T22:00:00Z")).toBe("7. 6. 2026");
  });
  it("závěrečný e-mail má přesnou zprávu a nedokončená rezervace zestárne do hodiny", () => {
    const e = buildDemoFinalEmail();
    expect(e.text).toContain("Vaše ukázková data i e-mail byly z Bezli smazány.");
    expect(isDemoFinalClaimStale("2026-11-21T10:00:00Z", Date.parse("2026-11-21T10:59:59Z"))).toBe(false);
    expect(isDemoFinalClaimStale("2026-11-21T10:00:00Z", Date.parse("2026-11-21T11:00:00Z"))).toBe(true);
  });
  it("otisk tokenu je stabilní sha256", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("demo export", () => {
  it("nepošle ukázkový obsah", () => {
    expect(onlyOwnRows([{ id: 1 }, { id: 2, is_demo_seed: true }, { id: 3, demo_seed_key: "k" }]).map((r) => r.id)).toEqual([1]);
  });
  it("limit 200 položek a hláška nabídne kategorie", () => {
    expect(DEMO_EXPORT_MAX_ITEMS).toBe(200);
    expect(exportLimitMessage("bytes")).toContain("50 MB");
    expect(exportLimitMessage("items")).toContain("po kategoriích");
  });
  it("shodné názvy v ZIP se nepřepíšou", () => {
    const used = new Set<string>();
    expect([uniqueName("a.png", used, true), uniqueName("a.png", used, true)]).toEqual(["a.png", "a-2.png"]);
  });
});

describe("odpočet a prodloužení", () => {
  it("české tvary dnů a půlnoc v den konce", () => {
    expect(demoCountdownText(14, "3. 12.")).toBe("Vaše práce se smaže za 14 dní (3. 12.).");
    expect(demoCountdownText(3, null)).toBe("Vaše práce se smaže za 3 dny.");
    expect(demoCountdownText(1, null)).toBe("Vaše práce se smaže zítra.");
    expect(demoCountdownText(0, null)).toBe("Vaše práce se smaže dnes o půlnoci.");
  });
  it("po prodloužení ukáže datum", () => expect(demoExtendedText("17. 12.")).toBe("Prodlouženo do 17. 12."));
});
