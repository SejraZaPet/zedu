import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/pdf-page-renderer", () => ({
  extractPdfText: vi.fn(async (f: File) => ({ text: f.name.includes("scan") ? "  " : "Fotosyntéza probíhá v listech. ".repeat(10) })),
  renderPdfPagesToImages: vi.fn(async () => []),
}));

import { extractFileSource, extractUrlSource, ScannedPdfError } from "@/lib/source-extract";
import { checkAddBatch, isCloudLoginHost, kindForFile, urlErrorMessage, CLOUD_LINK_HINT } from "@/lib/source-bundle";
import { legacyFormatHint, odfContentXmlToText, pptxSlideXmlToText, sheetRowsToText, EMPTY_FILE_MESSAGE } from "@/lib/office-extract";
import { scannedPdfItems } from "@/lib/lesson-or-own-source";

const zipFile = async (name: string, files: Record<string, string>) => {
  const z = new JSZip();
  Object.entries(files).forEach(([p, c]) => z.file(p, c));
  const buffer = await z.generateAsync({ type: "arraybuffer" });
  const file = new File([buffer], name);
  // jsdom File lacks arrayBuffer; exercise the modern browser path, not just FileReader.
  Object.defineProperty(file, "arrayBuffer", { value: vi.fn(async () => buffer) });
  return file;
};

describe("formáty souborů – čtení v prohlížeči", () => {
  it("rozpozná XLSX, ODT/ODP a odmítne staré formáty s radou", () => {
    expect(kindForFile({ name: "t.xlsx", type: "" })).toBe("xlsx");
    expect(kindForFile({ name: "t.odt", type: "" })).toBe("odt");
    expect(kindForFile({ name: "t.odp", type: "" })).toBe("odt");
    expect(kindForFile({ name: "t.ppt", type: "" })).toBeNull();
    expect(checkAddBatch([], [{ kind: null, name: "stara.ppt" }])).toMatch(/\.pptx nebo PDF/);
    expect(checkAddBatch([], [{ kind: null, name: "a.xls" }])).toMatch(/\.xlsx nebo PDF/);
    expect(legacyFormatHint("x.exe")).toBeNull();
  });
  it("XLSX/ODT se počítají do limitu 4 souborů", () => {
    expect(checkAddBatch([], [{ kind: "xlsx" }, { kind: "odt" }, { kind: "pdf" }, { kind: "docx" }, { kind: "pptx" }])).toMatch(/4 soubory/);
  });
  it("PPTX: text snímků v pořadí, včetně poznámek", async () => {
    const f = await zipFile("p.pptx", {
      "ppt/slides/slide2.xml": "<p:sld><a:p><a:r><a:t>Druhý &amp; poslední</a:t></a:r></a:p></p:sld>",
      "ppt/slides/slide1.xml": "<p:sld><a:p><a:r><a:t>Buňka</a:t></a:r><a:r><a:t> rostlinná</a:t></a:r></a:p><a:p><a:r><a:t>Jádro</a:t></a:r></a:p></p:sld>",
      "ppt/notesSlides/notesSlide1.xml": "<p:notes><a:p><a:r><a:t>Zmínit chloroplasty</a:t></a:r></a:p></p:notes>",
    });
    const t = await extractFileSource(f, "pptx");
    expect(t).toBe("Snímek 1\nBuňka rostlinná\nJádro\nPoznámky: Zmínit chloroplasty\n\nSnímek 2\nDruhý & poslední");
  });
  it("DOCX: text odstavců přes mammoth", async () => {
    const f = await zipFile("d.docx", {
      "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      "word/document.xml": '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Koloběh vody</w:t></w:r></w:p><w:p><w:r><w:t>Výpar a srážky</w:t></w:r></w:p></w:body></w:document>',
    });
    const t = await extractFileSource(f, "docx");
    expect(t).toContain("Koloběh vody");
    expect(t).toContain("Výpar a srážky");
  });
  it("XLSX: všechny listy, buňky tabulátorem", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Slovíčka");
    ws.addRow(["pes", "dog"]); ws.addRow([]); ws.addRow(["kočka", "cat"]);
    const buf = await wb.xlsx.writeBuffer();
    const file = new File([buf as ArrayBuffer], "s.xlsx");
    Object.defineProperty(file, "arrayBuffer", { value: vi.fn(async () => buf) });
    const t = await extractFileSource(file, "xlsx");
    expect(t).toBe("List: Slovíčka\npes\tdog\nkočka\tcat");
  });
  it("ODT: odstavce a nadpisy", async () => {
    const f = await zipFile("d.odt", { "content.xml": '<office:text><text:h text:outline-level="1">Voda</text:h><text:p>Skupenství<text:s/>vody</text:p></office:text>' });
    expect(await extractFileSource(f, "odt")).toBe("Voda\nSkupenství vody");
  });
  it("ODP: čte content.xml přes moderní File.arrayBuffer", async () => {
    const file = await zipFile("[TEST].odp", { "content.xml": "<text:p>První snímek</text:p><text:p>Druhý snímek</text:p>" });
    expect(await extractFileSource(file, "odt")).toBe("První snímek\nDruhý snímek");
    expect(file.arrayBuffer).toHaveBeenCalledOnce();
  });
  it("prázdný nebo poškozený soubor skončí srozumitelnou chybou, ne pádem", async () => {
    await expect(extractFileSource(new File([], "e.pptx"), "pptx")).rejects.toThrow(EMPTY_FILE_MESSAGE);
    await expect(extractFileSource(new File(["nezip"], "x.pptx"), "pptx")).rejects.toThrow(/poškozený/);
    const blank = await zipFile("b.pptx", { "ppt/slides/slide1.xml": "<p:sld></p:sld>" });
    await expect(extractFileSource(blank, "pptx")).rejects.toThrow(EMPTY_FILE_MESSAGE);
  });
  it("textové PDF vrátí text, skenované PDF vyhodí ScannedPdfError a UI nabídne fotky", async () => {
    expect(await extractFileSource(new File(["x"], "a.pdf"), "pdf")).toMatch(/Fotosyntéza/);
    await expect(extractFileSource(new File(["x"], "scan.pdf"), "pdf")).rejects.toBeInstanceOf(ScannedPdfError);
    expect(scannedPdfItems([{ id: "1", kind: "pdf", status: "error", scanned: true }])).toEqual(["1"]);
  });
  it("pomocné převody XML/řádků", () => {
    expect(pptxSlideXmlToText("<a:p><a:t>A</a:t></a:p><a:p></a:p>")).toBe("A");
    expect(odfContentXmlToText("<text:p>x&lt;y</text:p>")).toBe("x<y");
    expect(sheetRowsToText("L", [[null, ""]])).toBe("");
  });
});

describe("odkazy – české hlášky", () => {
  it("cloudové odkazy škol se odmítnou ještě před stažením s návodem", async () => {
    for (const u of ["https://teams.microsoft.com/l/file/x", "https://skola-my.sharepoint.com/x", "https://drive.google.com/file/d/1", "https://docs.google.com/document/d/1", "https://classroom.google.com/c/1", "https://1drv.ms/w/s!x", "https://onedrive.live.com/x"])
      expect(isCloudLoginHost(u)).toBe(true);
    expect(isCloudLoginHost("https://cs.wikipedia.org/wiki/Voda")).toBe(false);
    await expect(extractUrlSource("https://drive.google.com/file/d/1")).rejects.toThrow(CLOUD_LINK_HINT);
  });
  it("každý chybový kód má českou hlášku s návodem", () => {
    for (const c of ["AUTH_REQUIRED", "JS_ONLY", "UNSUPPORTED_TYPE", "FETCH_FAILED"]) expect(urlErrorMessage(c)).toContain(CLOUD_LINK_HINT);
    expect(urlErrorMessage("FRAMES")).toMatch(/rámce.*PDF/);
    expect(urlErrorMessage("TOO_LARGE")).toMatch(/2 MB.*nahrajte/);
    expect(urlErrorMessage("CANVA")).toMatch(/Canv/);
  });
});
