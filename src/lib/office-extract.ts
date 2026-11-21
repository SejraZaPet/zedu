/**
 * Čtení Office/OpenDocument souborů přímo v prohlížeči (nic se neodesílá ani neukládá).
 * DOCX → mammoth, PPTX/ODT/ODP → JSZip + XML, XLSX → ExcelJS.
 */
const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

/** Text jednoho snímku PPTX: odstavce <a:p>, běhy <a:t>. */
export function pptxSlideXmlToText(xml: string): string {
  const paras = xml.split(/<\/a:p>/);
  return paras
    .map((p) => Array.from(p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)).map((m) => decodeXml(m[1])).join(""))
    .map((t) => t.trim()).filter(Boolean).join("\n");
}

/** Text OpenDocument content.xml (ODT/ODP): odstavce a nadpisy. */
export function odfContentXmlToText(xml: string): string {
  const body = xml.replace(/<text:line-break\s*\/>/g, "\n").replace(/<text:tab\s*\/>/g, "\t").replace(/<text:s(?:\s[^>]*)?\/>/g, " ");
  return Array.from(body.matchAll(/<text:(p|h)(?:\s[^>]*)?>([\s\S]*?)<\/text:\1>/g))
    .map((m) => decodeXml(m[2].replace(/<[^>]+>/g, "")).trim()).filter(Boolean).join("\n");
}

/** Řádky listu → text (buňky tabulátorem), prázdné řádky vynechá. */
export function sheetRowsToText(name: string, rows: unknown[][]): string {
  const lines = rows
    .map((r) => r.map((c) => (c == null ? "" : String(c).trim())))
    .filter((r) => r.some(Boolean))
    .map((r) => r.join("\t").replace(/\t+$/, ""));
  return lines.length ? `List: ${name}\n${lines.join("\n")}` : "";
}

const LEGACY_HINT: Record<string, string> = {
  ppt: "Starý formát .ppt neumíme přečíst. V PowerPointu ho uložte jako .pptx nebo PDF a nahrajte znovu.",
  xls: "Starý formát .xls neumíme přečíst. V Excelu ho uložte jako .xlsx nebo PDF a nahrajte znovu.",
  ods: "Tabulky .ods neumíme přečíst. Uložte je jako .xlsx nebo PDF a nahrajte znovu.",
  rtf: "Formát .rtf neumíme přečíst. Uložte dokument jako .docx nebo PDF a nahrajte znovu.",
  pages: "Soubory Pages neumíme přečíst. Exportujte je jako .docx nebo PDF.",
  key: "Soubory Keynote neumíme přečíst. Exportujte je jako .pptx nebo PDF.",
  numbers: "Soubory Numbers neumíme přečíst. Exportujte je jako .xlsx nebo PDF.",
};
/** Srozumitelná rada pro známé, ale nepodporované formáty; jinak null. */
export function legacyFormatHint(name: string): string | null {
  const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) ?? [])[1];
  return ext ? LEGACY_HINT[ext] ?? null : null;
}

export const EMPTY_FILE_MESSAGE = "V souboru jsme nenašli žádný text. Zkontrolujte, že není prázdný, nebo obsah vložte jako text.";
const BROKEN = "Soubor se nepodařilo otevřít – je možná poškozený nebo chráněný heslem. Uložte ho znovu, nebo nahrajte PDF.";

/** Bajty souboru (záloha přes FileReader pro starší prostředí bez File.arrayBuffer). */
async function bytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") return await bytes(file);
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(file);
  });
}

async function zip(file: File) {
  const JSZip = (await import("jszip")).default;
  try { return await JSZip.loadAsync(await bytes(file)); } catch { throw new Error(BROKEN); }
}

export async function extractDocx(file: File): Promise<string> {
  const mammoth: any = await import("mammoth");
  const b = await bytes(file);
  const NodeBuffer = (globalThis as any).Buffer; // jen v testech pod Node
  const input = NodeBuffer ? { buffer: NodeBuffer.from(b) } : { arrayBuffer: b.buffer };
  try {
    const r = await (mammoth.extractRawText ?? mammoth.default.extractRawText)(input);
    return String(r.value ?? "").replace(/\n{3,}/g, "\n\n").trim();
  } catch { throw new Error(BROKEN); }
}

export async function extractPptx(file: File): Promise<string> {
  const z = await zip(file);
  const num = (p: string) => Number((p.match(/(\d+)\.xml$/) ?? [])[1] ?? 0);
  const slides = Object.keys(z.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => num(a) - num(b));
  const out: string[] = [];
  for (const p of slides) {
    const t = pptxSlideXmlToText(await z.file(p)!.async("string"));
    const notesPath = `ppt/notesSlides/notesSlide${num(p)}.xml`;
    const notes = z.file(notesPath) ? pptxSlideXmlToText(await z.file(notesPath)!.async("string")).replace(/^\d+$/gm, "").trim() : "";
    if (t || notes) out.push(`Snímek ${num(p)}\n${t}${notes ? `\nPoznámky: ${notes}` : ""}`);
  }
  return out.join("\n\n").trim();
}

export async function extractOdf(file: File): Promise<string> {
  const z = await zip(file);
  const c = z.file("content.xml");
  if (!c) throw new Error(BROKEN);
  return odfContentXmlToText(await c.async("string"));
}

export async function extractXlsx(file: File): Promise<string> {
  const ExcelJS: any = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await bytes(file) as any); } catch { throw new Error(BROKEN); }
  const parts: string[] = [];
  wb.eachSheet((ws: any) => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      const vals = (row.values as unknown[]).slice(1).map((v: any) =>
        v && typeof v === "object" ? (v.result ?? v.text ?? (Array.isArray(v.richText) ? v.richText.map((r: any) => r.text).join("") : "")) : v);
      rows.push(vals);
    });
    const t = sheetRowsToText(ws.name, rows);
    if (t) parts.push(t);
  });
  return parts.join("\n\n").trim();
}
