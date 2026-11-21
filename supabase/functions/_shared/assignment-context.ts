// Podklady k úkolu (propojená lekce + materiály zadání) pro AI funkce.
// Čte se VÝHRADNĚ předaným klientem s JWT volajícího (RLS + storage politiky);
// žádný service-role klient. Obsah se neloguje.
import { cleanLessonText } from "./lesson-text.ts";

export const ASSIGNMENT_MATERIALS_BUCKET = "assignment-materials";
export const CONTEXT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const CONTEXT_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export const CONTEXT_MAX_DOC_CHARS = 12000;
export const GRADING_LESSON_CHARS = 6000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export type MaterialFileKind = "pdf" | "image" | "docx" | "text" | "unsupported";

export interface AssignmentMaterialRef {
  title: string;
  kind: "link" | "file";
  path?: string;
  url?: string;
  mime?: string;
}

export interface LoadedMaterial {
  title: string;
  status: "ok" | "unreadable" | "link";
  text?: string;
  dataUrl?: string;
}

export interface LinkedLessonContext {
  title: string;
  text: string;
  href?: string;
}

const IMAGE_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export function classifyMaterial(name: string, mime = ""): { kind: MaterialFileKind; mime: string } {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const m = mime.toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return { kind: "pdf", mime: "application/pdf" };
  if (IMAGE_MIME[ext] || /^image\/(jpeg|png|webp|gif)$/.test(m)) {
    return { kind: "image", mime: /^image\/(jpeg|png|webp|gif)$/.test(m) ? m : IMAGE_MIME[ext] || "image/jpeg" };
  }
  if (ext === "docx" || m.includes("wordprocessingml")) return { kind: "docx", mime: m };
  if (["txt", "md", "csv"].includes(ext) || m.startsWith("text/")) return { kind: "text", mime: "text/plain" };
  return { kind: "unsupported", mime: m };
}

/** Bezpečné čtení jsonb `assignments.materials` (stejná pravidla jako parseMaterials v klientu). */
export function parseMaterialRefs(value: unknown): AssignmentMaterialRef[] {
  if (!Array.isArray(value)) return [];
  const out: AssignmentMaterialRef[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const title = typeof m.title === "string" && m.title.trim() ? m.title.trim().slice(0, 200) : "Materiál";
    if (m.kind === "link" && typeof m.url === "string") out.push({ title, kind: "link", url: m.url.slice(0, 500) });
    if (m.kind === "file" && typeof m.path === "string") {
      const path = m.path.trim();
      if (!path || path.length > 500 || path.includes("..") || path.startsWith("/") || /^https?:/i.test(path)) continue;
      out.push({ title, kind: "file", path, ...(typeof m.mime === "string" ? { mime: m.mime.slice(0, 100) } : {}) });
    }
  }
  return out;
}

/** Vybere soubory k přečtení. `textOnly` vynechá obrázky (tutor), limit počtu se uplatní až po filtru. */
export function selectMaterialFiles(refs: AssignmentMaterialRef[], maxFiles: number, textOnly: boolean): AssignmentMaterialRef[] {
  return refs
    .filter((ref) => ref.kind === "file")
    .filter((ref) => {
      const { kind } = classifyMaterial(ref.path || ref.title, ref.mime);
      if (kind === "unsupported") return false;
      return textOnly ? kind !== "image" : true;
    })
    .slice(0, maxFiles);
}

/** Text bloků lekce (stejná pravidla jako tutor); viditelné bloky, vyčištěný text. */
export function lessonBlocksText(blocks: unknown, maxLength = 8000): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  const textFields = ["text", "title", "heading", "caption", "content", "question", "explanation", "front", "back"];
  const nestedFields = ["props", "children", "blocks", "items", "data", "quiz", "questions", "answers", "flashcards", "revealCards", "cards"];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      const text = cleanLessonText(node);
      if (text) out.push(text);
      return;
    }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.visible === false) return;
    for (const field of textFields) if (typeof record[field] === "string") walk(record[field]);
    for (const field of nestedFields) if (record[field] && typeof record[field] === "object") walk(record[field]);
  };
  walk(blocks);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

interface Db {
  from: (table: string) => any;
  storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } };
}

export interface AssignmentRow {
  id: string;
  lesson_id: string | null;
  lesson_source: string | null;
  materials: unknown;
}

/** Úkol přes RLS volajícího; null = neexistuje nebo k němu volající nemá přístup. */
export async function loadAssignmentRow(db: Db, assignmentId: string): Promise<AssignmentRow | null> {
  if (!isUuid(assignmentId)) return null;
  const { data, error } = await db.from("assignments")
    .select("id, lesson_id, lesson_source, materials")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AssignmentRow;
}

export async function loadLinkedLesson(
  db: Db, lessonId: string | null, source: string | null, maxChars: number,
): Promise<LinkedLessonContext | null> {
  if (!isUuid(lessonId)) return null;
  if (source === "textbook_lessons") {
    const { data } = await db.from("textbook_lessons")
      .select("id, title, blocks, textbook_topics(id, subject, grade)")
      .eq("id", lessonId).maybeSingle();
    if (!data) return null;
    const text = lessonBlocksText(data.blocks, maxChars);
    if (!text) return null;
    const topic = Array.isArray(data.textbook_topics) ? data.textbook_topics[0] : data.textbook_topics;
    const href = topic
      ? `/ucebnice/${encodeURIComponent(topic.subject)}/${topic.grade}/${encodeURIComponent(topic.id)}/${encodeURIComponent(lessonId)}`
      : undefined;
    return { title: data.title || "Lekce", text, ...(href ? { href } : {}) };
  }
  const { data } = await db.from("teacher_textbook_lessons")
    .select("id, title, blocks, textbook_id").eq("id", lessonId).maybeSingle();
  if (!data) return null;
  const text = lessonBlocksText(data.blocks, maxChars);
  if (!text) return null;
  return {
    title: data.title || "Lekce od učitele",
    text,
    href: `/student/ucebnice/${encodeURIComponent(data.textbook_id)}?lesson=${encodeURIComponent(lessonId)}`,
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const xml = new TextDecoder().decode(unzipSync(bytes)["word/document.xml"] ?? new Uint8Array());
  return [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
    .map((m) => [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join(" "))
    .join("\n")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : String(text ?? "")).trim();
}

/**
 * Přečte vybrané soubory z `assignment-materials` tokenem volajícího.
 * `pdfAs: "text"` (tutor) převede PDF na text, `"file"` (hodnocení) ho pošle AI jako soubor.
 * Nečitelné nebo zakázané soubory se jen označí; nic se nehází dál.
 */
export async function loadMaterialFiles(
  db: Db, refs: AssignmentMaterialRef[], opts: { pdfAs: "text" | "file"; textOnly: boolean },
): Promise<{ materials: LoadedMaterial[]; storageDenied: number }> {
  const materials: LoadedMaterial[] = [];
  let total = 0;
  let storageDenied = 0;
  for (const ref of refs) {
    const { kind, mime } = classifyMaterial(ref.path || ref.title, ref.mime);
    const { data } = await db.storage.from(ASSIGNMENT_MATERIALS_BUCKET).download(ref.path!);
    if (!data) { storageDenied += 1; materials.push({ title: ref.title, status: "unreadable" }); continue; }
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (!bytes.length || bytes.length > CONTEXT_MAX_FILE_BYTES || total + bytes.length > CONTEXT_MAX_TOTAL_BYTES) {
      materials.push({ title: ref.title, status: "unreadable" });
      continue;
    }
    total += bytes.length;
    try {
      if (kind === "text" || kind === "docx" || (kind === "pdf" && opts.pdfAs === "text")) {
        const text = kind === "text" ? new TextDecoder().decode(bytes).trim() : kind === "docx" ? await docxText(bytes) : await pdfText(bytes);
        materials.push(text ? { title: ref.title, status: "ok", text: text.slice(0, CONTEXT_MAX_DOC_CHARS) } : { title: ref.title, status: "unreadable" });
      } else if (!opts.textOnly) {
        materials.push({ title: ref.title, status: "ok", dataUrl: `data:${mime};base64,${toBase64(bytes)}` });
      }
    } catch {
      materials.push({ title: ref.title, status: "unreadable" });
    }
  }
  return { materials, storageDenied };
}
