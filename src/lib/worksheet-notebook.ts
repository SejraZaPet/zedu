/**
 * Pracovní list v sešitu žáka.
 *
 * - „Digitálně“: do sešitu se vloží jedna stránka s odkazem (content.worksheet, mode "digital").
 *   Odpovědi se nekopírují — stránka otevře list (úkol → assignment_attempts, jinak student_worksheet_work).
 * - „PDF pro pero“: každá A4 stránka žákovské verze listu (bez klíče) se vyrenderuje do obrázku
 *   a vloží jako zamčené pozadí nové stránky sešitu; kreslí se přes něj stávajícím NotebookCanvas.
 * - Snapshot při odevzdání: stránky s rukopisem se vyrenderují do obrázků v `assignment-uploads`
 *   (složka úkolu/žáka, kterou učitel smí číst) a uloží se k pokusu pod `answers._notebookSnapshot`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { WorksheetSpec } from "@/lib/worksheet-spec";
import { waitForWorksheetRender } from "@/lib/worksheet-render-ready";
import {
  EMPTY_CONTENT, NOTEBOOK_BUCKET, createNotebookPage, normalizeContent, renderPageToCanvas,
  type Notebook, type NotebookImage, type NotebookPage, type NotebookPageContent,
} from "@/lib/notebook";

export type WorksheetInsertMode = "digital" | "pen";

export interface NotebookWorksheetRef {
  worksheetId: string;
  mode: WorksheetInsertMode;
  title: string;
  assignmentId?: string | null;
  pageIndex?: number;
  pageCount?: number;
}

export interface NotebookSnapshot {
  created_at: string;
  pages: { path: string; title: string }[];
}

export const SNAPSHOT_KEY = "_notebookSnapshot";
export const SNAPSHOT_BUCKET = "assignment-uploads";

export interface InsertableWorksheet {
  id: string;
  title: string;
  subject: string | null;
  assignmentId: string | null;
}

/** Listy, které žák smí číst (RLS), doplněné o úkol, pokud je list zadaný. */
export async function loadInsertableWorksheets(): Promise<InsertableWorksheet[]> {
  const [{ data: ws }, { data: asg }] = await Promise.all([
    supabase.from("worksheets" as any).select("id, title, subject, status").eq("status", "published")
      .order("updated_at", { ascending: false }).limit(200),
    supabase.from("assignments" as any).select("id, worksheet_id").not("worksheet_id", "is", null).limit(500),
  ]);
  const byWs = new Map<string, string>();
  for (const a of ((asg ?? []) as any[])) if (a.worksheet_id && !byWs.has(a.worksheet_id)) byWs.set(a.worksheet_id, a.id);
  return ((ws ?? []) as any[]).map((w) => ({
    id: w.id,
    title: w.title || "Pracovní list",
    subject: w.subject ?? null,
    assignmentId: byWs.get(w.id) ?? null,
  }));
}

/** Stránky sešitu, na které je list už vložený daným způsobem (pořadí stránek sešitu). */
export async function findInsertedPages(
  notebookId: string, worksheetId: string, mode: WorksheetInsertMode,
): Promise<NotebookPage[]> {
  const { data, error } = await (supabase.from("notebook_pages" as any) as any)
    .select("*")
    .eq("notebook_id", notebookId)
    .eq("content->worksheet->>worksheetId", worksheetId)
    .eq("content->worksheet->>mode", mode)
    .order("page_order", { ascending: true });
  if (error) throw new Error("Stránky sešitu se nepodařilo načíst. Zkus to znovu.");
  return ((data ?? []) as any[]).map((p) => ({ ...p, content: normalizeContent(p.content) })) as NotebookPage[];
}

async function nextPageOrder(notebookId: string): Promise<number> {
  const { data, error } = await supabase
    .from("notebook_pages").select("page_order").eq("notebook_id", notebookId)
    .order("page_order", { ascending: false }).limit(1);
  if (error) throw new Error("Pořadí stránek sešitu se nepodařilo načíst. Zkus vložení znovu.");
  const top = (data as any[])?.[0]?.page_order;
  return typeof top === "number" ? top + 1 : 0;
}

export function penPageTitle(title: string, i: number, n: number): string {
  return n > 1 ? `${title} (${i + 1}/${n})` : title;
}

/** Obsah stránky „PDF pro pero“: zamčené pozadí přes celou stránku + odkaz na list. */
export function buildPenPageContent(path: string, ref: NotebookWorksheetRef): NotebookPageContent {
  const bg: NotebookImage = { id: `ws-bg-${ref.pageIndex ?? 0}`, path, x: 0, y: 0, w: 1, h: 1, locked: true };
  return { ...EMPTY_CONTENT, images: [bg], worksheet: ref };
}

export type PageRenderer = (spec: WorksheetSpec, worksheetId: string) => Promise<Blob[]>;

/**
 * Vyrenderuje žákovskou verzi listu (bez klíče, bez poznámek) po A4 stránkách do JPEG.
 */
export const renderStudentWorksheetPages: PageRenderer = async (spec, worksheetId) => {
  const { buildStudentWorksheetHtml } = await import("@/lib/worksheet-pdf-export");
  // @ts-ignore — html2canvas nemá v projektu typy ve všech verzích
  const html2canvas = (await import("html2canvas")).default;
  const html = await buildStudentWorksheetHtml(spec, worksheetId);
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "297mm", border: "0" });
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Stránky listu se nepodařilo připravit.");
    doc.open(); doc.write(html); doc.close();
    const pages = await waitForWorksheetRender(doc);
    const out: Blob[] = [];
    for (const el of pages) {
      const canvas: HTMLCanvasElement = await html2canvas(el, { scale: 1.4, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (!blob) throw new Error("Stránku listu se nepodařilo převést. Zkus vložení znovu.");
      out.push(blob);
    }
    return out;
  } finally {
    iframe.remove();
  }
};

async function loadSpec(worksheetId: string): Promise<{ spec: WorksheetSpec; title: string; subject: string | null }> {
  const { data, error } = await supabase.from("worksheets" as any).select("spec, title, subject").eq("id", worksheetId).maybeSingle();
  if (error || !data) throw new Error("Pracovní list není dostupný.");
  return { spec: (data as any).spec, title: (data as any).title || "Pracovní list", subject: (data as any).subject ?? null };
}

export interface InsertResult { pages: NotebookPage[]; existed: boolean }

export function isPenInsertionComplete(pages: NotebookPage[]): boolean {
  if (!pages.length) return false;
  const count = pages[0].content.worksheet?.pageCount;
  if (!count || !Number.isInteger(count) || count < 1) return false;
  const indices = new Set(pages.map((page) => page.content.worksheet?.pageIndex));
  return pages.every((page) => page.content.worksheet?.pageCount === count)
    && Array.from({ length: count }, (_, index) => index).every((index) => indices.has(index));
}

/** Vloží list do sešitu; když je už vložený stejným způsobem, vrátí existující stránky. */
export async function insertWorksheetIntoNotebook(input: {
  notebook: Pick<Notebook, "id" | "owner_id" | "subject">;
  worksheetId: string;
  mode: WorksheetInsertMode;
  assignmentId?: string | null;
  render?: PageRenderer;
}): Promise<InsertResult> {
  const { notebook, worksheetId, mode } = input;
  const existing = await findInsertedPages(notebook.id, worksheetId, mode);
  if (existing.length > 0 && (mode === "digital" || isPenInsertionComplete(existing))) return { pages: existing, existed: true };

  const { spec, title, subject } = await loadSpec(worksheetId);
  const section = notebook.subject || subject || null;
  let order = await nextPageOrder(notebook.id);

  if (mode === "digital") {
    const ref: NotebookWorksheetRef = { worksheetId, mode, title, assignmentId: input.assignmentId ?? null };
    const page = await createNotebookPage({
      notebookId: notebook.id, pageOrder: order, title, section,
      content: { ...EMPTY_CONTENT, worksheet: ref },
    });
    return { pages: [page], existed: false };
  }

  const blobs = await (input.render ?? renderStudentWorksheetPages)(spec, worksheetId);
  if (blobs.length === 0) throw new Error("List se nepodařilo převést na stránky.");
  if (existing.some((page) => page.content.worksheet?.pageCount !== blobs.length
    || !Number.isInteger(page.content.worksheet?.pageIndex))) {
    throw new Error("List se od původního vložení změnil. Chybějící stránky nelze bezpečně doplnit; tvoje zápisky zůstávají zachované.");
  }
  const indices = new Set(existing.map((page) => page.content.worksheet?.pageIndex));
  const pages: NotebookPage[] = [...existing];
  try {
  for (let i = 0; i < blobs.length; i++) {
    if (indices.has(i)) continue;
    const path = `${notebook.owner_id}/ws-${worksheetId}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(NOTEBOOK_BUCKET)
      .upload(path, blobs[i], { upsert: false, contentType: "image/jpeg" });
    if (error) throw error;
    const ref: NotebookWorksheetRef = {
      worksheetId, mode, title, assignmentId: input.assignmentId ?? null, pageIndex: i, pageCount: blobs.length,
    };
    pages.push(await createNotebookPage({
      notebookId: notebook.id, pageOrder: order++,
      title: penPageTitle(title, i, blobs.length), section,
      content: buildPenPageContent(path, ref),
    }));
  }
  } catch {
    throw new Error(`Vložených je ${pages.length} z ${blobs.length} stran. Zkus vložení znovu — doplní se jen chybějící stránky a tvoje zápisky zůstanou.`);
  }
  pages.sort((a, b) => (a.content.worksheet?.pageIndex ?? 0) - (b.content.worksheet?.pageIndex ?? 0));
  return { pages, existed: false };
}

/** Všechny stránky „PDF pro pero“ daného listu ve vlastních sešitech žáka. */
export async function loadMyPenPages(worksheetId: string): Promise<NotebookPage[]> {
  const { data, error } = await (supabase.from("notebook_pages" as any) as any)
    .select("*")
    .eq("content->worksheet->>worksheetId", worksheetId)
    .eq("content->worksheet->>mode", "pen")
    .order("page_order", { ascending: true });
  if (error) throw new Error("Stránky sešitu se nepodařilo načíst. Odevzdání není dokončené. Zkus to znovu.");
  return ((data ?? []) as any[]).map((p) => ({ ...p, content: normalizeContent(p.content) })) as NotebookPage[];
}

export type PageRasterizer = (page: NotebookPage) => Promise<Blob>;

const defaultRasterizer: PageRasterizer = async (page) => {
  const canvas = await renderPageToCanvas(page, 1.2, { requireImages: true });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("Stránku se nepodařilo uložit.");
  return blob;
};

/**
 * Neměnná kopie stránek s rukopisem pro odevzdání úkolu. Vrací null, když žák list
 * do sešitu jako „PDF pro pero“ nevložil.
 */
export async function snapshotPenPagesForAttempt(input: {
  worksheetId: string; assignmentId: string; studentId: string; attemptId: string;
  pages?: NotebookPage[]; rasterize?: PageRasterizer;
}): Promise<NotebookSnapshot | null> {
  const pages = input.pages ?? (await loadMyPenPages(input.worksheetId));
  if (pages.length === 0) return null;
  const groups = new Map<string, NotebookPage[]>();
  for (const page of pages) {
    if (page.content.worksheet?.mode !== "pen") continue;
    const group = groups.get(page.notebook_id) ?? [];
    group.push(page);
    groups.set(page.notebook_id, group);
  }
  if ([...groups.values()].some((group) => !isPenInsertionComplete(group))) {
    throw new Error("V sešitě chybí stránky pracovního listu. Zkus list vložit znovu; odevzdání zatím není dokončené.");
  }
  const rasterize = input.rasterize ?? defaultRasterizer;
  const stamp = Date.now();
  const out: NotebookSnapshot["pages"] = [];
  for (let i = 0; i < pages.length; i++) {
    const blob = await rasterize(pages[i]);
    const path = `${input.assignmentId}/${input.studentId}/notebook-${input.attemptId}-${stamp}-${i + 1}.jpg`;
    const { error } = await supabase.storage.from(SNAPSHOT_BUCKET)
      .upload(path, blob, { upsert: false, contentType: "image/jpeg" });
    if (error) throw error;
    out.push({ path, title: pages[i].title || `Strana ${i + 1}` });
  }
  return { created_at: new Date(stamp).toISOString(), pages: out };
}

export function readSnapshot(answers: Record<string, unknown> | null | undefined): NotebookSnapshot | null {
  const s = (answers as any)?.[SNAPSHOT_KEY];
  return s && Array.isArray(s.pages) && s.pages.length > 0 ? (s as NotebookSnapshot) : null;
}

/** Odkaz, kam stránka „Digitálně“ vede (úkol má přednost). */
export function worksheetLinkHref(ref: NotebookWorksheetRef): string {
  return ref.assignmentId ? `/student/ulohy/${ref.assignmentId}` : `/student/pracovni-list/${ref.worksheetId}`;
}
