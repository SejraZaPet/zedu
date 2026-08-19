// Digitální sešit — typy, vykreslování a datová vrstva.
// Kreslicí formát (Stroke) je záměrně shodný s živou tabulí (LiveWhiteboard),
// aby se dala znovupoužít vykreslovací logika. Živá tabule se tímto NEMĚNÍ.

import { supabase } from "@/integrations/supabase/client";

export type NotebookTool = "pen" | "highlight" | "eraser" | "text" | "rect" | "circle" | "arrow";

export interface Stroke {
  id: string;
  tool: NotebookTool;
  color: string;
  width: number;
  points: [number, number][]; // 0..1 relativní souřadnice stránky
  /**
   * Volitelný tlak pera pro každý bod v `points` (0..1). Pero (stylus) posílá
   * proměnlivé hodnoty → tah se kreslí po segmentech s proměnnou šířkou.
   * Chybí-li pole (myš, prst, starší data, živá tabule), kreslí se konstantní šířkou.
   */
  pressures?: number[];
  text?: string;
}


export interface NotebookTextBox {
  id: string;
  x: number; y: number; w: number; h: number; // 0..1
  text: string;
  color: string;
  fontSize: number; // px v prostoru stránky (NB_W x NB_H)
  bold?: boolean;
  italic?: boolean;
  /** Speciální příznak — např. "class-roster" pro automaticky vložený seznam žáků. */
  kind?: string;
}

export interface NotebookImage {
  id: string;
  path: string; // cesta v bucketu notebook-media
  x: number; y: number; w: number; h: number; // 0..1
}

export interface NotebookPageContent {
  strokes: Stroke[];
  textBoxes: NotebookTextBox[];
  images: NotebookImage[];
}

export type BackgroundStyle = "blank" | "lined" | "grid" | "dotted";

export const BACKGROUND_LABELS: Record<BackgroundStyle, string> = {
  blank: "Čistá",
  lined: "Linkovaná",
  grid: "Čtverečkovaná",
  dotted: "Tečkovaná",
};

export interface Notebook {
  id: string;
  owner_id: string;
  title: string;
  subject: string | null;
  cover_color: string | null;
  related_lesson_id: string | null;
  related_class_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotebookPage {
  id: string;
  notebook_id: string;
  page_order: number;
  background_style: BackgroundStyle;
  content: NotebookPageContent;
  created_at: string;
  updated_at: string;
}

/** Rozměry stránky sešitu (A4 portrét) v logických px. */
export const NB_W = 1000;
export const NB_H = 1414;

export const NOTEBOOK_COLORS = [
  "#000000", "#ef4444", "#3b82f6", "#22c55e",
  "#f97316", "#a855f7", "#0f766e", "#facc15",
];

export const NOTEBOOK_WIDTHS = [3, 6, 12];

export const COVER_COLORS = [
  "#2F6F75", "#6EC6D9", "#9B6CFF", "#E8618C", "#F2994A", "#F2C94C", "#27AE60", "#6B7A8F",
];

export const EMPTY_CONTENT: NotebookPageContent = { strokes: [], textBoxes: [], images: [] };

export function normalizeContent(raw: any): NotebookPageContent {
  return {
    strokes: Array.isArray(raw?.strokes) ? raw.strokes : [],
    textBoxes: Array.isArray(raw?.textBoxes) ? raw.textBoxes : [],
    images: Array.isArray(raw?.images) ? raw.images : [],
  };
}

/* ------------------------------------------------------------------ */
/* Vykreslování (shodná logika jako u živé tabule)                     */
/* ------------------------------------------------------------------ */

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(10, ctx.lineWidth * 3);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

export function renderStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  if (!s.points || s.points.length === 0) return;
  const scale = w / NB_W;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.width * scale;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;

  if (s.tool === "highlight") {
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = s.width * 3 * scale;
  } else if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = s.width * 4 * scale;
  }

  const pts = s.points.map(([x, y]) => [x * w, y * h] as [number, number]);

  if (s.tool === "pen" || s.tool === "highlight" || s.tool === "eraser") {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  } else if (s.tool === "rect" && pts.length >= 2) {
    const [x1, y1] = pts[0];
    const [x2, y2] = pts[pts.length - 1];
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (s.tool === "circle" && pts.length >= 2) {
    const [x1, y1] = pts[0];
    const [x2, y2] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.tool === "arrow" && pts.length >= 2) {
    drawArrow(ctx, pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
  } else if (s.tool === "text" && s.text) {
    const size = Math.max(16, s.width * 6) * scale;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(s.text, pts[0][0], pts[0][1]);
  }
  ctx.restore();
}

/** CSS podklad stránky (linky / čtverečky / tečky). */
export function backgroundCss(style: BackgroundStyle, scale = 1): React.CSSProperties {
  const step = 40 * scale;
  const line = "rgba(110,198,217,0.45)";
  if (style === "lined") {
    return {
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${step - 1}px, ${line} ${step - 1}px, ${line} ${step}px)`,
    };
  }
  if (style === "grid") {
    return {
      backgroundImage:
        `repeating-linear-gradient(to bottom, transparent 0, transparent ${step - 1}px, ${line} ${step - 1}px, ${line} ${step}px),` +
        `repeating-linear-gradient(to right, transparent 0, transparent ${step - 1}px, ${line} ${step - 1}px, ${line} ${step}px)`,
    };
  }
  if (style === "dotted") {
    return {
      backgroundImage: `radial-gradient(${line} ${Math.max(1, 1.5 * scale)}px, transparent ${Math.max(1, 1.5 * scale)}px)`,
      backgroundSize: `${step}px ${step}px`,
    };
  }
  return {};
}

/* ------------------------------------------------------------------ */
/* Úložiště obrázků                                                    */
/* ------------------------------------------------------------------ */

export const NOTEBOOK_BUCKET = "notebook-media";

export async function uploadNotebookImage(ownerId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(NOTEBOOK_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function signNotebookImages(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(NOTEBOOK_BUCKET).createSignedUrls(unique, 3600);
  const map: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  return map;
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

export async function loadNotebooks(ownerId: string): Promise<Notebook[]> {
  const { data, error } = await supabase
    .from("notebooks")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Notebook[];
}

export async function createNotebook(input: {
  ownerId: string; title: string; subject?: string | null;
  coverColor?: string | null; relatedLessonId?: string | null; relatedClassId?: string | null;
}): Promise<Notebook> {
  const { data, error } = await supabase
    .from("notebooks")
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      subject: input.subject ?? null,
      cover_color: input.coverColor ?? COVER_COLORS[0],
      related_lesson_id: input.relatedLessonId ?? null,
      related_class_id: input.relatedClassId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  // Každý nový sešit má hned první prázdnou stránku
  await supabase.from("notebook_pages").insert({ notebook_id: data.id, page_order: 0 });
  return data as Notebook;
}

export async function loadPages(notebookId: string): Promise<NotebookPage[]> {
  const { data, error } = await supabase
    .from("notebook_pages")
    .select("*")
    .eq("notebook_id", notebookId)
    .order("page_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, content: normalizeContent(p.content) })) as NotebookPage[];
}

export async function savePageContent(pageId: string, content: NotebookPageContent) {
  const { error } = await supabase
    .from("notebook_pages")
    .update({ content: content as any })
    .eq("id", pageId);
  if (error) throw error;
}

/** Příznak textboxu se seznamem žáků třídy. */
export const CLASS_ROSTER_KIND = "class-roster";

/** Načte jména žáků třídy (abecedně) pro vložení do sešitu. */
export async function loadClassStudentNames(classId: string): Promise<string[]> {
  const { data: members, error } = await supabase
    .from("class_members")
    .select("user_id")
    .eq("class_id", classId);
  if (error) throw error;
  const ids = (members ?? []).map((m: any) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .in("id", ids);
  if (pErr) throw pErr;
  return (profs ?? [])
    .map((p: any) => `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "cs"));
}

/** Vloží (nebo aktualizuje) textbox se seznamem žáků na stránce. */
export function upsertClassRosterTextBox(
  content: NotebookPageContent,
  names: string[],
): NotebookPageContent {
  const text = names.join("\n");
  const existing = content.textBoxes.find((t) => t.kind === CLASS_ROSTER_KIND);
  if (existing) {
    return {
      ...content,
      textBoxes: content.textBoxes.map((t) =>
        t.kind === CLASS_ROSTER_KIND ? { ...t, text } : t,
      ),
    };
  }
  const box: NotebookTextBox = {
    id: crypto.randomUUID(),
    kind: CLASS_ROSTER_KIND,
    x: 0.06,
    y: 0.06,
    w: 0.42,
    h: Math.min(0.85, Math.max(0.12, (names.length * 34 + 24) / NB_H)),
    text,
    color: "#000000",
    fontSize: 26,
  };
  return { ...content, textBoxes: [...content.textBoxes, box] };
}

/** Vyrenderuje stránku do canvasu (bílý podklad + obrázky + kresba + textboxy). */
export async function renderPageToCanvas(
  page: Pick<NotebookPage, "background_style" | "content">,
  scale = 1,
): Promise<HTMLCanvasElement> {
  const w = Math.round(NB_W * scale);
  const h = Math.round(NB_H * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // podklad
  const step = 40 * scale;
  ctx.save();
  ctx.strokeStyle = "rgba(110,198,217,0.45)";
  ctx.fillStyle = "rgba(110,198,217,0.45)";
  ctx.lineWidth = 1;
  if (page.background_style === "lined" || page.background_style === "grid") {
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }
  if (page.background_style === "grid") {
    for (let x = step; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  }
  if (page.background_style === "dotted") {
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        ctx.beginPath(); ctx.arc(x, y, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();

  const content = normalizeContent(page.content);

  // obrázky
  const urls = await signNotebookImages(content.images.map((i) => i.path));
  await Promise.all(
    content.images.map(
      (img) =>
        new Promise<void>((resolve) => {
          const url = urls[img.path];
          if (!url) return resolve();
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => {
            ctx.drawImage(el, img.x * w, img.y * h, img.w * w, img.h * h);
            resolve();
          };
          el.onerror = () => resolve();
          el.src = url;
        }),
    ),
  );

  // kresba
  for (const s of content.strokes) renderStroke(ctx, s, w, h);

  // textboxy
  for (const tb of content.textBoxes) {
    const size = tb.fontSize * scale;
    ctx.save();
    ctx.fillStyle = tb.color;
    ctx.font = `${tb.italic ? "italic " : ""}${tb.bold ? "700 " : "400 "}${size}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    const maxW = tb.w * w;
    let y = tb.y * h;
    for (const paragraph of (tb.text || "").split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, tb.x * w, y);
          y += size * 1.25;
          line = word;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, tb.x * w, y);
      y += size * 1.25;
    }
    ctx.restore();
  }

  return canvas;
}

/** Export celého sešitu do PDF (jedna stránka sešitu = jedna A4). */
export async function exportNotebookToPdf(notebook: Notebook, pages: NotebookPage[]): Promise<void> {
  if (pages.length === 0) throw new Error("Sešit neobsahuje žádné stránky.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderPageToCanvas(pages[i], 1.5);
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(data, "JPEG", 0, 0, pageW, pageH);
  }

  const name = (notebook.title || "sesit")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "sesit";
  pdf.save(`${name}.pdf`);
}

/** Přidá vyrenderovanou stránku sešitu do portfolia žáka. */
export async function addPageToPortfolio(
  studentId: string,
  notebook: Notebook,
  page: NotebookPage,
  pageNumber: number,
): Promise<void> {
  const canvas = await renderPageToCanvas(page, 1.5);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nepodařilo se vyrenderovat stránku."))), "image/png"),
  );
  const file = new File([blob], `sesit-strana-${pageNumber}.png`, { type: "image/png" });

  const { uploadPortfolioAttachment } = await import("@/lib/portfolio");
  const path = await uploadPortfolioAttachment(studentId, file);

  const { data: item, error } = await supabase
    .from("student_portfolio_items")
    .insert({
      student_id: studentId,
      type: "project",
      title: `${notebook.title} — strana ${pageNumber}`,
      description: "Stránka z digitálního sešitu",
      subject: notebook.subject,
      attachment_url: path,
      source_type: "manual",
      content_json: { notebook_id: notebook.id, notebook_page_id: page.id } as any,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("student_portfolio_files" as any).insert({
    portfolio_item_id: item.id,
    file_name: file.name,
    file_url: path,
    file_type: "image/png",
    sort_order: 0,
  });
}
