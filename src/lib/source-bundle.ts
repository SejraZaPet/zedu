import { legacyFormatHint } from "@/lib/office-extract";
/**
 * Jednotný vstup zdrojů (etapa 0) – čisté funkce bez Reactu.
 * Typy položek, limity, sloučení textů a jednotné české hlášky.
 * Nikdy tiše neořezává: překročení limitu se ukáže a generování se zablokuje.
 */
export type SourceKind = "text" | "pdf" | "docx" | "pptx" | "xlsx" | "odt" | "txt" | "photo" | "url" | "lesson";
export type SourceStatus = "loading" | "ready" | "error";
export type SourceAudience = "teacher" | "student";

export interface SourceItem {
  id: string;
  kind: SourceKind;
  label: string;
  status: SourceStatus;
  text?: string;
  error?: string;
  /** Název souboru / host odkazu / název lekce – jen pro popisek, nikdy se neloguje. */
  origin?: string;
  /** Náhled fotky (object URL) – jen v prohlížeči. */
  preview?: string;
  /** PDF bez textové vrstvy – nabídnout zpracování stránek jako fotek. */
  scanned?: boolean;
}

export const SOURCE_LIMITS = {
  maxItems: 10,
  maxPhotos: 6,
  maxFiles: 4,
  maxDocBytes: 20 * 1024 * 1024,
  maxPhotoBytes: 15 * 1024 * 1024,
  maxCharsPerItem: 20000,
  maxTotal: { teacher: 20000, student: 8000 } as Record<SourceAudience, number>,
  minChars: 150,
} as const;

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  text: "Text", pdf: "PDF", docx: "Word", pptx: "PowerPoint", xlsx: "Excel", odt: "OpenDocument", txt: "Textový soubor",
  photo: "Fotka", url: "Odkaz", lesson: "Lekce",
};

/** Limity zobrazené předem u vkládání. */
export const SOURCE_LIMITS_SUMMARY =
  `Nejvýše ${SOURCE_LIMITS.maxItems} zdrojů: ${SOURCE_LIMITS.maxFiles} soubory do ${SOURCE_LIMITS.maxDocBytes / 1048576} MB, ${SOURCE_LIMITS.maxPhotos} fotek do ${SOURCE_LIMITS.maxPhotoBytes / 1048576} MB.`;
export const CLOUD_LINK_HINT =
  "Odkazy z Teamsu, OneDrive, SharePointu, Classroomu a Google Disku vyžadují přihlášení – stáhněte soubor a nahrajte ho, nebo zkopírujte text.";
/** Odkazy na cloudová úložiště škol, která bez přihlášení nejdou načíst. */
export function isCloudLoginHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return /(^|\.)(teams\.microsoft\.com|teams\.live\.com|onedrive\.live\.com|1drv\.ms|sharepoint\.com|classroom\.google\.com|drive\.google\.com|docs\.google\.com)$/.test(h);
  } catch { return false; }
}

export const SOURCE_URL_NOTICE = "Použijte jen obsah, který smíte ve výuce použít, a uveďte zdroj.";

/** Druh zdroje podle souboru; null = nepodporovaný typ. */
export function kindForFile(file: Pick<File, "name" | "type">): SourceKind | null {
  const n = (file.name || "").toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/.test(n)) return "photo";
  if (n.endsWith(".pdf") || t === "application/pdf") return "pdf";
  if (n.endsWith(".docx") || n.endsWith(".doc")) return "docx";
  if (n.endsWith(".pptx")) return "pptx";
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".odt") || n.endsWith(".odp")) return "odt";
  if (n.endsWith(".txt") || n.endsWith(".md") || t === "text/plain") return "txt";
  return null;
}

const isFileKind = (k: SourceKind) => k === "pdf" || k === "docx" || k === "pptx" || k === "xlsx" || k === "odt" || k === "txt";

/**
 * Kontrola, zda lze přidat dávku (celou, nebo vůbec – nikdy jen část).
 * Vrací null, nebo srozumitelnou hlášku.
 */
export function checkAddBatch(
  items: Pick<SourceItem, "kind">[],
  incoming: { kind: SourceKind | null; size?: number; name?: string }[],
): string | null {
  if (incoming.length === 0) return null;
  const bad = incoming.find((f) => f.kind === null);
  if (bad) return legacyFormatHint(bad.name ?? "")
    ?? `Soubor „${bad.name ?? ""}“ nemá podporovaný formát (PDF, Word, PowerPoint, Excel, ODT, TXT nebo fotka).`;
  if (items.length + incoming.length > SOURCE_LIMITS.maxItems)
    return `Najednou lze použít nejvýše ${SOURCE_LIMITS.maxItems} zdrojů. Celý výběr byl odmítnut – odeberte některé zdroje.`;
  const photos = items.filter((i) => i.kind === "photo").length + incoming.filter((i) => i.kind === "photo").length;
  if (photos > SOURCE_LIMITS.maxPhotos)
    return `Nejvýše ${SOURCE_LIMITS.maxPhotos} fotek celkem. Celý výběr byl odmítnut – vyberte méně fotek.`;
  const files = items.filter((i) => isFileKind(i.kind)).length + incoming.filter((i) => i.kind && isFileKind(i.kind)).length;
  if (files > SOURCE_LIMITS.maxFiles)
    return `Nejvýše ${SOURCE_LIMITS.maxFiles} soubory celkem. Celý výběr byl odmítnut.`;
  for (const f of incoming) {
    const max = f.kind === "photo" ? SOURCE_LIMITS.maxPhotoBytes : SOURCE_LIMITS.maxDocBytes;
    if ((f.size ?? 0) > max) return `Soubor „${f.name ?? ""}“ je větší než ${Math.round(max / 1024 / 1024)} MB.`;
  }
  return null;
}

/** Sloučí připravené zdroje v zobrazeném pořadí; u více zdrojů přidá záhlaví. */
export function mergeSources(items: SourceItem[]): string {
  const ready = items.filter((i) => i.status === "ready" && (i.text ?? "").trim());
  if (ready.length === 1) return ready[0].text!.trim();
  return ready
    .map((i, n) => `--- Zdroj ${n + 1}: ${SOURCE_KIND_LABEL[i.kind]}${i.origin ? ` (${i.origin})` : ""} ---\n${i.text!.trim()}`)
    .join("\n\n");
}

export interface BundleState {
  text: string;
  chars: number;
  max: number;
  overBy: number;
  busy: boolean;
  /** Lze generovat – vše připraveno, v limitu a dost textu. */
  ok: boolean;
  /** Proč nelze generovat (null když ok). */
  message: string | null;
}

export function bundleState(items: SourceItem[], audience: SourceAudience = "teacher"): BundleState {
  const text = mergeSources(items);
  const chars = text.length;
  const max = SOURCE_LIMITS.maxTotal[audience];
  const overBy = Math.max(0, chars - max);
  const busy = items.some((i) => i.status === "loading");
  const fmt = (n: number) => n.toLocaleString("cs-CZ");
  let message: string | null = null;
  if (busy) message = "Zdroje se ještě načítají…";
  else if (items.length === 0) message = "Přidejte alespoň jeden zdroj.";
  else if (overBy > 0) message = `Zdroje mají ${fmt(chars)} znaků, limit je ${fmt(max)} – přebývá ${fmt(overBy)}. Odeberte zdroj nebo text zkraťte.`;
  else if (items.some((i) => i.status === "ready" && (i.text ?? "").length > SOURCE_LIMITS.maxCharsPerItem))
    message = `Jeden zdroj má víc než ${fmt(SOURCE_LIMITS.maxCharsPerItem)} znaků. Zkraťte ho.`;
  else if (chars < SOURCE_LIMITS.minChars) message = `Zdroje mají jen ${chars} znaků; potřeba je alespoň ${SOURCE_LIMITS.minChars}.`;
  return { text, chars, max, overBy, busy, ok: message === null, message };
}

export function moveSource<T extends { id: string }>(items: T[], id: string, delta: number): T[] {
  const i = items.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Chybové kódy funkce fetch-source-url → česká hláška. */
export function urlErrorMessage(code: unknown): string {
  const save = "Uložte ji jako PDF (Ctrl+P) a nahrajte, nebo text zkopírujte.";
  switch (code) {
    case "BLOCKED_URL": return "Tento odkaz nelze načíst. Použijte veřejnou webovou adresu začínající http(s)://.";
    case "CLOUD_LOGIN":
    case "AUTH_REQUIRED": return `Stránka vyžaduje přihlášení. ${CLOUD_LINK_HINT}`;
    case "JS_ONLY": return `Stránka se vykresluje skriptem a text z ní nejde načíst. ${save} ${CLOUD_LINK_HINT}`;
    case "FRAMES": return `Stránka používá rámce. Vložte odkaz na konkrétní podstránku s textem, nebo ji ${save.charAt(0).toLowerCase()}${save.slice(1)}`;
    case "CANVA": return "Web z Canvy nejde načíst odkazem. V Canvě stáhněte PDF (Sdílet → Stáhnout) a nahrajte ho jako soubor.";
    case "TOO_LARGE": return "Stránka nebo soubor na odkazu je příliš velký (víc než 2 MB). Stáhněte ho a nahrajte jako soubor, nebo zkopírujte podstatný text.";
    case "UNSUPPORTED_TYPE": return `Odkaz nevede na webovou stránku, text ani PDF. Soubor (např. Word nebo PowerPoint) stáhněte a nahrajte. ${CLOUD_LINK_HINT}`;
    case "FETCH_FAILED": return `Stránku se nepodařilo stáhnout (je nedostupná nebo vyžaduje přihlášení). ${CLOUD_LINK_HINT}`;
    default: return `Odkaz se nepodařilo načíst. ${CLOUD_LINK_HINT}`;
  }
}
