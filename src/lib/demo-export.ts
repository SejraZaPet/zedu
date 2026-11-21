// Export vlastní práce návštěvníka dema do ZIP: strojově čitelný JSON + listy k tisku do PDF + vlastní soubory.
// Nikdy: ukázkový obsah (is_demo_seed), třídy, žáci, odpovědi, výsledky, zprávy.
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET } from "@/lib/teacher-media";

export const DEMO_EXPORT_MAX_ITEMS = 200;
export const DEMO_EXPORT_MAX_BYTES = 50 * 1024 * 1024;

export type DemoExportCategory = "worksheets" | "presentations" | "games" | "textbooks" | "questions" | "media";
export const DEMO_EXPORT_CATEGORIES: { id: DemoExportCategory; label: string }[] = [
  { id: "worksheets", label: "Pracovní listy" },
  { id: "presentations", label: "Prezentace" },
  { id: "games", label: "Hry a aktivity" },
  { id: "textbooks", label: "Učebnice a lekce" },
  { id: "questions", label: "Banka otázek" },
  { id: "media", label: "Nahrané soubory" },
];

/** Tabulky s vlastním obsahem učitele (sloupec vlastníka; seed se vylučuje, kde sloupec existuje). */
const SOURCES: Record<Exclude<DemoExportCategory, "media" | "textbooks">, { table: string; owner: string; seed: boolean; select: string }[]> = {
  worksheets: [{ table: "worksheets", owner: "teacher_id", seed: true, select: "id,title,subject,grade_band,spec,teacher_notes,created_at,updated_at,ai_generated" }],
  presentations: [{ table: "teacher_presentations", owner: "teacher_id", seed: true, select: "id,title,slides,created_at,updated_at" }],
  games: [
    { table: "teacher_game_templates", owner: "teacher_id", seed: false, select: "id,title,description,purpose,subject,activity_data,default_game_mode,created_at,updated_at,demo_seed_key" },
    { table: "activity_templates", owner: "user_id", seed: false, select: "id,name,activity_type,template_props,created_at" },
  ],
  questions: [{ table: "question_bank_items", owner: "teacher_id", seed: true, select: "id,question_type,question_text,choices,correct_index,correct_answer,is_true,subject,created_at" }],
};

export class DemoExportTooLarge extends Error {
  constructor(public reason: "items" | "bytes") { super(reason); }
}

export function exportLimitMessage(reason: "items" | "bytes"): string {
  return reason === "items"
    ? `Export má víc než ${DEMO_EXPORT_MAX_ITEMS} položek. Stáhněte prosím práci po kategoriích.`
    : "Export je větší než 50 MB. Stáhněte prosím práci po kategoriích.";
}

/** Odstraní ukázkové šablony her (mají demo_seed_key) – posílá se jen vlastní práce. */
export function onlyOwnRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter((r) => !r.is_demo_seed && !r.demo_seed_key);
}

async function fetchRows(src: { table: string; owner: string; seed: boolean; select: string }, uid: string) {
  let q = (supabase.from as any)(src.table).select(src.seed ? `${src.select},is_demo_seed` : src.select).eq(src.owner, uid).limit(DEMO_EXPORT_MAX_ITEMS + 1);
  if (src.seed) q = q.eq("is_demo_seed", false);
  const { data, error } = await q;
  if (error) throw new Error("Nepodařilo se načíst vaši práci.");
  return onlyOwnRows((data ?? []) as Record<string, unknown>[]);
}

export async function buildDemoExportZip(uid: string, categories: DemoExportCategory[]): Promise<Blob> {
  const zip = new JSZip();
  const data: Record<string, unknown[]> = {};
  let items = 0;
  let bytes = 0;
  const count = (n: number) => { items += n; if (items > DEMO_EXPORT_MAX_ITEMS) throw new DemoExportTooLarge("items"); };

  for (const cat of categories) {
    if (cat === "media" || cat === "textbooks") continue;
    for (const src of SOURCES[cat]) {
      const rows = await fetchRows(src, uid);
      count(rows.length);
      data[src.table] = rows.map(({ is_demo_seed, demo_seed_key, ...r }) => r);
    }
  }
  if (categories.includes("textbooks")) {
    const books = await fetchRows({ table: "teacher_textbooks", owner: "teacher_id", seed: true, select: "id,title,description,subject,grade_level,created_at" }, uid);
    count(books.length);
    data.teacher_textbooks = books.map(({ is_demo_seed, ...r }) => r);
    if (books.length) {
      const { data: lessons } = await supabase.from("teacher_textbook_lessons")
        .select("id,textbook_id,title,blocks,presentation_slides,sort_order,created_at").in("textbook_id", books.map((b) => String(b.id))).limit(DEMO_EXPORT_MAX_ITEMS + 1);
      count((lessons ?? []).length);
      data.teacher_textbook_lessons = lessons ?? [];
    }
  }

  const json = JSON.stringify({ format: "bezli-demo-export", version: 1, exported_at: new Date().toISOString(), data }, null, 2);
  bytes += json.length;
  zip.file("bezli-data.json", json);

  // Listy jako hotový dokument k tisku (Otevřít → Tisk → Uložit jako PDF).
  if (categories.includes("worksheets") && Array.isArray(data.worksheets)) {
    const { buildWorksheetPdfBlobUrl } = await import("@/lib/worksheet-pdf-export");
    const used = new Set<string>();
    for (const w of data.worksheets as any[]) {
      try {
        const url = await buildWorksheetPdfBlobUrl(w.spec, { worksheetId: w.id, teacherVersion: true, includeAnswerKey: true, teacherNotes: w.teacher_notes ?? undefined });
        const html = await (await fetch(url)).text();
        URL.revokeObjectURL(url);
        bytes += html.length;
        zip.file(`listy-k-tisku/${uniqueName(w.title || "list", used)}.html`, html);
      } catch { /* list s neúplnou strukturou zůstane jen v JSON */ }
    }
  }

  if (categories.includes("media")) {
    const { data: media } = await supabase.from("teacher_media").select("filename,storage_path,size_bytes").eq("teacher_id", uid).limit(DEMO_EXPORT_MAX_ITEMS + 1);
    count((media ?? []).length);
    const used = new Set<string>();
    for (const m of media ?? []) {
      bytes += Number(m.size_bytes ?? 0);
      if (bytes > DEMO_EXPORT_MAX_BYTES) throw new DemoExportTooLarge("bytes");
      const { data: blob } = await supabase.storage.from(MEDIA_BUCKET).download(m.storage_path);
      if (blob) zip.file(`soubory/${uniqueName(m.filename || "soubor", used, true)}`, blob);
    }
  }
  if (bytes > DEMO_EXPORT_MAX_BYTES) throw new DemoExportTooLarge("bytes");
  zip.file("CTI-ME.txt", "Export vaší práce z dema Bezli.\n\nbezli-data.json – strojově čitelná data pro pozdější import.\nlisty-k-tisku – otevřete v prohlížeči a zvolte Tisk → Uložit jako PDF.\nsoubory – vaše nahrané obrázky a dokumenty.\n\nPrezentace do PDF nebo PowerPointu stáhnete přímo v editoru prezentace (Export).\nObsahuje jen vaši vlastní práci, žádná data žáků.\n");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function uniqueName(name: string, used: Set<string>, keepExt = false): string {
  const clean = String(name).replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "polozka";
  let n = clean; let i = 2;
  const dot = keepExt ? clean.lastIndexOf(".") : -1;
  while (used.has(n)) n = dot > 0 ? `${clean.slice(0, dot)}-${i++}${clean.slice(dot)}` : `${clean}-${i++}`;
  used.add(n);
  return n;
}
