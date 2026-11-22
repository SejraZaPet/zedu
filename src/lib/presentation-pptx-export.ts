import pptxgen from "pptxgenjs";
import { activityToCoreQuestions } from "@/lib/live-game-core";
import { activitySummary } from "@/lib/activity-meta";

const PAGE_W = 13.333, PAGE_H = 7.5;
const hex = (value: any, fallback = "2B1A3F") => String(value || fallback).replace("#", "").slice(0, 6).toUpperCase();
const font = (value: any) => /Oswald/i.test(value || "") ? "Oswald" : /Arial/i.test(value || "") ? "Arial" : "DM Sans";
const pctFrame = (frame: any) => ({ x: Number(frame?.x || 0) * PAGE_W / 100, y: Number(frame?.y || 0) * PAGE_H / 100, w: Math.max(0.03, Number(frame?.w || 100) * PAGE_W / 100), h: Math.max(0.03, Number(frame?.h || 10) * PAGE_H / 100) });

function plainLines(value: any): { text: string; bullet: boolean }[] {
  const html = String(value ?? ""); if (!html) return [];
  if (/<li[\s>]/i.test(html)) {
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const items = Array.from(doc.querySelectorAll("li"));
      if (items.length) return items.map((li) => ({ text: (li.textContent || "").trim(), bullet: true })).filter((x) => x.text);
    }
    return Array.from(html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) => ({ text: m[1].replace(/<[^>]+>/g, "").trim(), bullet: true })).filter((x) => x.text);
  }
  if (typeof DOMParser !== "undefined" && /<[^>]+>/.test(html)) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const paragraphs = Array.from(doc.querySelectorAll("p"));
    if (paragraphs.length) return paragraphs.map((p) => ({ text: (p.textContent || "").trim(), bullet: false })).filter((x) => x.text);
    return (doc.body.textContent || "").split("\n").map((text) => ({ text: text.trim(), bullet: false })).filter((x) => x.text);
  }
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").split("\n").map((text) => ({ text: text.trim(), bullet: false })).filter((x) => x.text);
}

function addText(slide: any, value: any, props: Record<string, any>, frame: any) {
  const lines = plainLines(value); if (!lines.length) return;
  const runs = lines.map((line, index) => ({ text: line.text, options: { bullet: line.bullet ? true : undefined, breakLine: index < lines.length - 1 } }));
  const hiddenPdfText = props.pdfTextLayer && props.color === "transparent";
  slide.addText(runs, { ...frame, margin: 0.04, fontFace: font(props.fontFamily), fontSize: Math.max(6, Number(props.fontSize) || 20), color: hex(hiddenPdfText ? props.sourceTextColor : props.color), transparency: hiddenPdfText ? 100 : 0, bold: !!props.bold, italic: !!props.italic, align: props.align || "left", valign: "mid", breakLine: false, lineSpacingMultiple: Math.max(0.7, Number(props.lineHeight) || 1.1), fit: "shrink", rotate: Number(props.rotation) || 0 });
}

function activityText(spec: any): string {
  if (!spec) return "";
  try {
    const questions = activityToCoreQuestions(spec);
    if (questions.length) return questions.map((q, i) => `${i + 1}. ${q.question}\n${q.answers.map((a, j) => `${String.fromCharCode(65 + j)}) ${a}${j === q.correctIndex ? " ✓" : ""}`).join("\n")}${q.explanation ? `\nVysvětlení: ${q.explanation}` : ""}`).join("\n\n");
  } catch { /* obecný text níže */ }
  const lines: string[] = [spec.question || spec.title || ""].filter(Boolean);
  if (Array.isArray(spec.options)) lines.push(...spec.options.map((o: any, i: number) => `${String.fromCharCode(65 + i)}) ${o.text || o}`));
  if (spec.trueFalse?.statements) lines.push(...spec.trueFalse.statements.map((s: any) => `${s.text} — ${s.isTrue ? "Pravda" : "Nepravda"}`));
  if (spec.matching) lines.push(...(spec.matching.left || []).map((left: string, i: number) => `${left} — ${spec.matching.right?.[i] || ""}`));
  if (spec.ordering?.items) lines.push(spec.ordering.items.map((x: string, i: number) => `${i + 1}. ${x}`).join("\n"));
  if (spec.sorting?.items) lines.push(...spec.sorting.items.map((x: any) => `${x.text} — ${spec.sorting.groups?.[x.group] || ""}`));
  if (spec.fillBlanks?.text) lines.push(spec.fillBlanks.text);
  if (spec.fillChoice?.tokens) lines.push(spec.fillChoice.tokens.map((x: any) => x.text || x).join(" "));
  if (spec.flashcards) lines.push(...spec.flashcards.map((x: any) => `${x.front} — ${x.back}`));
  if (spec.revealCards?.cards) lines.push(...spec.revealCards.cards.map((x: any) => `${x.title}: ${x.content}`));
  if (spec.memoryGame?.pairs) lines.push(...spec.memoryGame.pairs.map((x: any) => `${x.left} — ${x.right}`));
  if (spec.crossword?.entries) lines.push(...spec.crossword.entries.map((x: any) => `${x.clue} — ${x.answer}`));
  if (spec.wordSearchWords) lines.push(`Slova: ${spec.wordSearchWords.join(", ")}`);
  if (spec.explanation) lines.push(`Vysvětlení: ${spec.explanation}`);
  const summary = activitySummary(spec); if (summary && lines.length < 2) lines.push(summary);
  return lines.join("\n");
}

async function imageData(url: string): Promise<string> {
  if (!url) throw new Error("Prázdný obrázek");
  if (url.startsWith("data:")) return url;
  const response = await fetch(url); if (!response.ok) throw new Error(`Obrázek nelze načíst (${response.status}).`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Obrázek nelze převést pro PPTX.")); reader.readAsDataURL(blob); });
}

async function gradientData(gradient: any): Promise<string | null> {
  if (!gradient || typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    const direction = String(gradient.direction || "135deg");
    const g = direction === "to right" ? ctx.createLinearGradient(0, 0, 1600, 0) : direction === "to bottom" ? ctx.createLinearGradient(0, 0, 0, 900) : ctx.createLinearGradient(0, 0, 1600, 900);
    g.addColorStop(0, gradient.from); g.addColorStop(1, gradient.to); ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 900);
    return canvas.toDataURL("image/png");
  } catch { return null; }
}

async function applyBackground(slide: any, source: any) {
  const bg = source?.backgroundOverride || {};
  if (bg.image) { try { slide.background = { data: await imageData(bg.image) }; return; } catch { slide.background = { color: "FFFFFF" }; return; } }
  if (bg.gradient) { const data = await gradientData(bg.gradient); if (data) { slide.background = { data }; return; } slide.background = { color: hex(bg.gradient.from) }; return; }
  if (bg.color) { slide.background = { color: hex(bg.color) }; return; }
  slide.background = { color: "1A1A2E" };
}

export async function createPresentationPptx(slides: any[], title = "Prezentace") {
  const pptx = new pptxgen(); pptx.layout = "LAYOUT_WIDE"; pptx.author = "Bezli"; pptx.title = title; pptx.subject = "Prezentace vytvořená v Bezli"; pptx.company = "Bezli"; pptx.theme = { headFontFace: "Oswald", bodyFontFace: "DM Sans" };
  for (const source of slides || []) {
    const slide = pptx.addSlide(); await applyBackground(slide, source);
    slide.addNotes(String(source?.teacherNotes || ""));
    const spec = source?.activitySpec;
    if (spec) {
      const text = activityText(spec) || source?.projector?.headline || "Aktivita";
      addText(slide, text, { fontSize: 22, color: spec.colors?.text || "#2B1A3F", fontFamily: '"DM Sans"' }, { x: 0.8, y: 1.25, w: 11.73, h: 5.2 });
      slide.addText("Aktivita", { x: 0.8, y: 0.45, w: 11.73, h: 0.55, fontFace: "Oswald", fontSize: 28, bold: true, color: hex(spec.colors?.accent, "663196"), margin: 0 });
      continue;
    }
    const framed = Array.isArray(source?.blocks) ? source.blocks.filter((b: any) => b?.frame && b?.visible !== false && b?.type !== "activity") : [];
    if (source?.projector?.headline) addText(slide, source.projector.headline, { fontSize: 32, bold: true, color: "#FFFFFF", fontFamily: "Oswald" }, { x: 0.65, y: 0.35, w: 12, h: 0.8 });
    let flowY = source?.projector?.headline ? 1.35 : 0.55;
    const flow = Array.isArray(source?.blocks) ? source.blocks.filter((b: any) => !b?.frame && b?.visible !== false && b?.type !== "activity") : [];
    for (const block of [...framed, ...flow]) {
      const p = block.props || {}; const frame = block.frame ? pctFrame(block.frame) : { x: 0.65, y: flowY, w: 12, h: 0.8 };
      if (block.type === "image" && p.url) {
        try {
          const data = await imageData(p.url); const options: any = { ...frame, data, rotate: Number(p.rotation) || 0, transparency: p.opacity === undefined ? 0 : Math.round((1 - p.opacity) * 100), flipH: !!p.flipH, flipV: !!p.flipV };
          if (p.crop) { const c = p.crop; options.sizing = { type: "crop", x: frame.x + frame.w * Number(c.left || 0) / 100, y: frame.y + frame.h * Number(c.top || 0) / 100, w: frame.w * (100 - Number(c.left || 0) - Number(c.right || 0)) / 100, h: frame.h * (100 - Number(c.top || 0) - Number(c.bottom || 0)) / 100 }; }
          slide.addImage(options);
        } catch { slide.addText("[Obrázek se nepodařilo vložit]", { ...frame, fontSize: 14, color: "B91C1C" }); }
      } else if (block.type === "shape") {
        const kind = p.shapeKind === "circle" ? pptx.ShapeType.ellipse : p.shapeKind === "rectangle" ? pptx.ShapeType.rect : pptx.ShapeType.roundRect;
        slide.addShape(kind, { ...frame, rectRadius: p.shapeKind === "pill" ? frame.h / 2 : Math.max(0.02, Number(p.borderRadius || 12) / 100), rotate: Number(p.rotation) || 0, fill: { color: hex(p.fillColor, "FFFFFF"), transparency: p.fillOpacity === undefined ? 0 : Math.round((1 - p.fillOpacity) * 100) }, line: { color: hex(p.strokeColor, p.fillColor || "FFFFFF"), transparency: p.strokeColor ? (p.strokeOpacity === undefined ? 0 : Math.round((1 - p.strokeOpacity) * 100)) : 100, width: Math.max(0, Number(p.strokeWidth) || 0) } });
        if (p.text) addText(slide, p.text, p, frame);
      } else if (block.type === "bullet_list") {
        addText(slide, (p.items || []).map((x: string) => `<li>${x}</li>`).join(""), p, frame);
      } else if (p.text || p.html) addText(slide, p.text || p.html, p, frame);
      if (!block.frame) flowY += Math.min(2.2, Math.max(0.65, String(p.text || "").length / 130 + 0.55));
    }
  }
  return pptx;
}

/** pptxgenjs 4 může vytvořit Override pro neexistující master a přehodit notesMaster za sldId. */
export async function sanitizePresentationPptx(bytes: Uint8Array): Promise<Uint8Array> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const typesPath = "[Content_Types].xml";
  let types = await zip.file(typesPath)!.async("string");
  types = types.replace(/<Override\b[^>]*PartName="([^"]+)"[^>]*\/>/g, (tag, part) => zip.files[part.replace(/^\//, "")] ? tag : "");
  zip.file(typesPath, types);
  const presentationPath = "ppt/presentation.xml";
  let presentation = await zip.file(presentationPath)!.async("string");
  const notes = presentation.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/)?.[0];
  if (notes) presentation = presentation.replace(notes, "").replace(/(<p:sldMasterIdLst>[\s\S]*?<\/p:sldMasterIdLst>)/, `$1${notes}`);
  zip.file(presentationPath, presentation);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function exportPresentationToPptx(slides: any[], title = "Prezentace") {
  const pptx = await createPresentationPptx(slides, title);
  const raw = await pptx.write({ outputType: "uint8array" }) as Uint8Array;
  const sanitized = await sanitizePresentationPptx(new Uint8Array(raw));
  const blob = new Blob([new Uint8Array(sanitized)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  const safe = title.replace(/[\\/:*?"<>|]/g, "-").trim() || "prezentace";
  anchor.href = url; anchor.download = `${safe}.pptx`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
