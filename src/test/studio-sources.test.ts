import { describe, it, expect } from "vitest";
import { bundleState, checkAddBatch, kindForFile, mergeSources, moveSource, SOURCE_LIMITS, type SourceItem } from "@/lib/source-bundle";
import { checkUrlShape, htmlToText, isBlockedIp, isCanvaHost } from "../../supabase/functions/_shared/url-guard";

const ready = (id: string, text: string, kind: SourceItem["kind"] = "text"): SourceItem => ({ id, kind, label: id, status: "ready", text });

describe("source-bundle", () => {
  it("pozná druh souboru", () => {
    expect(kindForFile({ name: "a.PDF", type: "" })).toBe("pdf");
    expect(kindForFile({ name: "x.heic", type: "" })).toBe("photo");
    expect(kindForFile({ name: "s.pptx", type: "" })).toBe("pptx");
    expect(kindForFile({ name: "z.exe", type: "" })).toBeNull();
  });
  it("odmítne celou dávku nad 6 fotek, nic nepřidá částečně", () => {
    const items = Array.from({ length: 5 }, () => ({ kind: "photo" as const }));
    expect(checkAddBatch(items, [{ kind: "photo" }, { kind: "photo" }])).toMatch(/6 fotek/);
    expect(checkAddBatch(items, [{ kind: "photo" }])).toBeNull();
  });
  it("odmítne víc než 4 soubory a 10 zdrojů", () => {
    expect(checkAddBatch([], Array(5).fill({ kind: "pdf" }))).toMatch(/4 soubory/);
    expect(checkAddBatch(Array(10).fill({ kind: "text" }), [{ kind: "text" }])).toMatch(/10 zdrojů/);
  });
  it("sloučí v pořadí se záhlavím jen u více zdrojů", () => {
    expect(mergeSources([ready("a", "Jedna")])).toBe("Jedna");
    const m = mergeSources([ready("a", "Jedna"), { ...ready("b", "Dva", "photo") }, { id: "c", kind: "url", label: "c", status: "error" }]);
    expect(m).toBe("--- Zdroj 1: Text ---\nJedna\n\n--- Zdroj 2: Fotka ---\nDva");
  });
  it("nad limitem neořízne, ale zablokuje a řekne kolik přebývá", () => {
    const s = bundleState([ready("a", "x".repeat(20500))], "teacher");
    expect(s.text.length).toBe(20500);
    expect(s.ok).toBe(false);
    expect(s.overBy).toBe(500);
    expect(bundleState([ready("a", "x".repeat(9000))], "student").ok).toBe(false);
    expect(bundleState([ready("a", "x".repeat(SOURCE_LIMITS.minChars))]).ok).toBe(true);
    expect(bundleState([ready("a", "krátké")]).ok).toBe(false);
  });
  it("načítající zdroj blokuje generování", () => {
    expect(bundleState([{ id: "a", kind: "photo", label: "a", status: "loading" }]).ok).toBe(false);
  });
  it("posune položku", () => {
    expect(moveSource([{ id: "a" }, { id: "b" }], "b", -1).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("url-guard (SSRF)", () => {
  it.each([
    "http://localhost/", "http://127.0.0.1/", "http://10.0.0.5/", "http://169.254.169.254/latest",
    "http://[::1]/", "http://[fd00::1]/", "http://[::ffff:127.0.0.1]/", "ftp://example.com/",
    "http://user:pw@example.com/", "http://example.com:8080/", "http://2130706433/", "http://printer.local/", "http://intranet/",
  ])("blokuje %s", (u) => expect(checkUrlShape(u).ok).toBe(false));
  it("povolí veřejnou https adresu", () => expect(checkUrlShape("https://cs.wikipedia.org/wiki/Praha").ok).toBe(true));
  it("blokuje privátní IP z DNS", () => {
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("100.64.0.1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("93.184.216.34")).toBe(false);
    expect(isBlockedIp("2606:4700::1111")).toBe(false);
  });
  it("vytáhne článek bez skriptů a navigace", () => {
    const html = `<title>Řeky &amp; moře</title><nav>Menu</nav><script>alert(1)</script><article><h1>Vltava</h1><p>${"Vltava je nejdelší česká řeka. ".repeat(15)}</p></article><footer>©</footer>`;
    const r = htmlToText(html);
    expect(r.title).toBe("Řeky & moře");
    expect(r.text).toContain("Vltava je nejdelší");
    expect(r.text).not.toMatch(/Menu|alert|©/);
  });
  const para = "Hovězí přední čtvrť se hodí na guláš a vývar, zadní na steaky. ".repeat(10);
  it("(a) stránka celá uvnitř <form id=form1> (ASP.NET) vrátí text", () => {
    const html = `<html><body><form method="post" id="form1"><header>Logo</header><nav>Menu</nav><div class="content"><h1>Rozdělení masa</h1><p>${para}</p></div><footer>©</footer></form></body></html>`;
    const r = htmlToText(html);
    expect(r.text.length).toBeGreaterThan(150);
    expect(r.text).toContain("Rozdělení masa");
    expect(r.loginForm).toBe(false);
  });
  it("(b) přihlášení s heslem vrátí loginForm a formulář nezůstane v textu", () => {
    const r = htmlToText('<form id="login"><label>Uživatelské jméno</label><input name="u"><input type="password"></form>');
    expect(r.loginForm).toBe(true);
    expect(r.text).not.toContain("Uživatelské jméno");
  });
  it("(c) JS-only kostra pořád vrátí málo textu", () => {
    const r = htmlToText('<html><head><title>App</title><script src="a.js"></script></head><body><div id="root"></div><script>window.x=1</script><noscript>Zapněte JavaScript</noscript></body></html>');
    expect(r.text.length).toBeLessThan(150);
    expect(r.frames).toBe(false);
  });
  it("(d) <header><h1> uvnitř <article> zachová nadpis článku", () => {
    const r = htmlToText(`<header>Hlavička webu</header><article><header><h1>Jak dělit maso</h1></header><p>${para}</p></article>`);
    expect(r.text).toContain("Jak dělit maso");
    expect(r.text).not.toContain("Hlavička webu");
  });
  it("vyhledávací formulář se odstraní, rámce a Canva se poznají", () => {
    const r = htmlToText(`<form role="search"><input type="search" placeholder="x">Hledat</form><main><p>${para}</p></main>`);
    expect(r.text).not.toContain("Hledat");
    expect(htmlToText("<frameset><frame src=a></frameset>").frames).toBe(true);
    expect(htmlToText("<body>Tato stránka má použity rámce.</body>").frames).toBe(true);
    expect(isCanvaHost("moje.canva.site")).toBe(true);
    expect(isCanvaHost("www.canva.com")).toBe(true);
    expect(isCanvaHost("canvas.cz")).toBe(false);
  });
  it("pozná přihlašovací formulář", () => {
    expect(htmlToText('<form><input type="password"></form>').loginForm).toBe(true);
  });
});
