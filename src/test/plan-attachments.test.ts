import { describe, expect, it } from "vitest";
import {
  addAttached,
  attachedHref,
  parseAttached,
  removeAttached,
  validateExternalUrl,
  type AttachedItem,
} from "@/lib/plan-attachments";

describe("validateExternalUrl", () => {
  it("přijme https adresu", () => {
    expect(validateExternalUrl("https://wordwall.net/cs/resource/123")).toBe("https://wordwall.net/cs/resource/123");
  });
  it("doplní chybějící protokol", () => {
    expect(validateExternalUrl("wordwall.net/cs/resource/123")).toBe("https://wordwall.net/cs/resource/123");
  });
  it("odmítne javascript: a jiné protokoly", () => {
    expect(validateExternalUrl("javascript:alert(1)")).toBeNull();
    expect(validateExternalUrl("ftp://example.com/x")).toBeNull();
  });
  it("odmítne prázdný nebo neplatný vstup", () => {
    expect(validateExternalUrl("")).toBeNull();
    expect(validateExternalUrl("   ")).toBeNull();
    expect(validateExternalUrl("localhost")).toBeNull();
  });
});

describe("attachedHref", () => {
  it("pracovní list → editor", () => {
    expect(attachedHref({ type: "worksheet", id: "w1", title: "List" })).toBe("/ucitel/pracovni-listy/w1");
  });
  it("hra → knihovna her", () => {
    expect(attachedHref({ type: "game_template", id: "g1", title: "Hra" })).toBe("/ucitel/hry");
  });
  it("prezentace → přehled prezentací", () => {
    expect(attachedHref({ type: "presentation", id: "p1", title: "Prez" })).toBe("/ucitel/prezentace?open=p1");
  });
  it("lekce učitele → učebnice s lekcí", () => {
    expect(attachedHref({ type: "lesson", id: "l1", title: "L", textbookId: "t1" })).toBe("/ucitel/ucebnice/t1?lesson=l1");
  });
  it("externí odkaz nemá interní cestu", () => {
    expect(attachedHref({ type: "link", url: "https://kahoot.it", title: "K" })).toBeNull();
  });
});

describe("addAttached / removeAttached", () => {
  const phase = { timeMin: "10", description: "d" };
  const ws: AttachedItem = { type: "worksheet", id: "w1", title: "List" };

  it("přidá položku k prázdné fázi", () => {
    const next = addAttached(phase, ws);
    expect(next.attached).toHaveLength(1);
    expect(next.attached![0]).toEqual(ws);
  });
  it("nepřidá duplicitu (stejný typ + id)", () => {
    const once = addAttached(phase, ws);
    const twice = addAttached(once, { ...ws, title: "Jiný název" });
    expect(twice.attached).toHaveLength(1);
  });
  it("dva různé odkazy s různou URL se přidají oba", () => {
    let p = addAttached(phase, { type: "link", url: "https://a.cz", title: "A" });
    p = addAttached(p, { type: "link", url: "https://b.cz", title: "B" });
    expect(p.attached).toHaveLength(2);
  });
  it("odebrání odstraní jen propojení, fáze zůstane", () => {
    let p = addAttached(phase, ws);
    p = addAttached(p, { type: "link", url: "https://a.cz", title: "A" });
    const next = removeAttached(p, 0);
    expect(next.attached).toHaveLength(1);
    expect(next.attached![0].type).toBe("link");
    expect(next.timeMin).toBe("10");
  });
});

describe("parseAttached", () => {
  it("vyfiltruje neplatné záznamy z uložených dat", () => {
    const out = parseAttached([{ type: "link", title: "A", url: "https://a.cz" }, { nope: 1 }, null, "x"]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("link");
  });
  it("prázdný vstup → prázdné pole", () => {
    expect(parseAttached(undefined)).toEqual([]);
    expect(parseAttached({})).toEqual([]);
  });
});
