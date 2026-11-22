import type JSZip from "jszip";
import { createPresentationImageUploader, PresentationImageImportCache, readBlobArrayBuffer, type PresentationImageUpload } from "@/lib/presentation-import-images";
import type { PresentationImportProgress, PresentationImportResult } from "@/lib/presentation-import-types";

const EMU = 914400;
const uid = () => crypto.randomUUID();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const direct = (el: Element | null | undefined, tag: string) => el ? Array.from(el.children).filter((c) => c.tagName === tag) : [];
const all = (el: Element | Document | null | undefined, tag: string) => el ? Array.from(el.getElementsByTagName(tag)) : [];
const first = (el: Element | null | undefined, tag: string) => direct(el, tag)[0] || null;
const num = (v: string | null | undefined, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const xml = (source: string) => new DOMParser().parseFromString(source, "application/xml");

interface RawFrame { x: number; y: number; w: number; h: number; rot: number; flipH?: boolean; flipV?: boolean }
interface ThemeData { colors: Record<string, string>; fonts: string[]; backgroundFills: Element[] }
interface Rel { type: string; target: string }
interface ReadText { text: string; html: string; isTitle: boolean; props: Record<string, any>; fonts: string[] }

function normalizePart(base: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  return parts.join("/");
}

function fontFamily(name: string | null | undefined) {
  const n = (name || "").trim();
  if (/oswald|impact|arial narrow|bebas/i.test(n)) return '"Oswald", "Arial Narrow", sans-serif';
  if (/arial|helvetica|calibri|aptos|segoe/i.test(n)) return "Arial, sans-serif";
  return '"DM Sans", Arial, sans-serif';
}

function shade(hex: string, lumMod: number, lumOff: number) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return hex;
  const channels = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(value.slice(i, i + 2), 16) * lumMod + 255 * lumOff))));
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function readColor(fill: Element | null, theme: ThemeData): { color?: string; opacity?: number } {
  if (!fill) return {};
  const colorEl = direct(fill, "a:srgbClr")[0] || direct(fill, "a:schemeClr")[0] || direct(fill, "a:sysClr")[0] || direct(fill, "a:prstClr")[0];
  if (!colorEl) return {};
  let color = colorEl.getAttribute("val") || colorEl.getAttribute("lastClr") || "000000";
  if (colorEl.tagName === "a:schemeClr") {
    const key = colorEl.getAttribute("val") || "tx1";
    const mapped = key === "tx1" ? "dk1" : key === "tx2" ? "dk2" : key === "bg1" ? "lt1" : key === "bg2" ? "lt2" : key;
    color = theme.colors[mapped] || theme.colors[key] || "000000";
  } else if (colorEl.tagName === "a:prstClr") {
    const presets: Record<string, string> = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080" };
    color = presets[color] || "000000";
  }
  const lumMod = num(first(colorEl, "a:lumMod")?.getAttribute("val"), 100000) / 100000;
  const lumOff = num(first(colorEl, "a:lumOff")?.getAttribute("val"), 0) / 100000;
  const alpha = num(first(colorEl, "a:alpha")?.getAttribute("val"), 100000) / 100000;
  return { color: shade(`#${color.replace("#", "")}`.toUpperCase(), lumMod, lumOff), opacity: alpha < 1 ? alpha : undefined };
}

function transformOf(owner: Element, kind: "sp" | "pic" | "graphic" = "sp"): RawFrame | null {
  const propName = kind === "pic" ? "p:spPr" : kind === "graphic" ? "p:xfrm" : "p:spPr";
  const props = first(owner, propName);
  const xf = kind === "graphic" ? props : first(props, "a:xfrm");
  if (!xf) return null;
  const off = first(xf, "a:off"), ext = first(xf, "a:ext");
  if (!off || !ext) return null;
  return { x: num(off.getAttribute("x")), y: num(off.getAttribute("y")), w: Math.max(1, num(ext.getAttribute("cx"), 1)), h: Math.max(1, num(ext.getAttribute("cy"), 1)), rot: num(xf.getAttribute("rot")) / 60000, flipH: xf.getAttribute("flipH") === "1", flipV: xf.getAttribute("flipV") === "1" };
}

function groupTransform(group: Element) {
  const xf = first(first(group, "p:grpSpPr"), "a:xfrm");
  if (!xf) return null;
  const off = first(xf, "a:off"), ext = first(xf, "a:ext"), chOff = first(xf, "a:chOff"), chExt = first(xf, "a:chExt");
  if (!off || !ext || !chOff || !chExt) return null;
  return { x: num(off.getAttribute("x")), y: num(off.getAttribute("y")), w: num(ext.getAttribute("cx"), 1), h: num(ext.getAttribute("cy"), 1), cx: num(chOff.getAttribute("x")), cy: num(chOff.getAttribute("y")), cw: Math.max(1, num(chExt.getAttribute("cx"), 1)), ch: Math.max(1, num(chExt.getAttribute("cy"), 1)) };
}

function mapGroupFrame(frame: RawFrame, group: ReturnType<typeof groupTransform>): RawFrame {
  if (!group) return frame;
  return { ...frame, x: group.x + (frame.x - group.cx) * group.w / group.cw, y: group.y + (frame.y - group.cy) * group.h / group.ch, w: frame.w * group.w / group.cw, h: frame.h * group.h / group.ch, rot: frame.rot };
}

function stageFrame(frame: RawFrame, size: { cx: number; cy: number }) {
  const aspect = size.cx / size.cy, stageAspect = 16 / 9;
  const wPct = aspect > stageAspect ? 100 : 100 * aspect / stageAspect;
  const hPct = aspect > stageAspect ? 100 * stageAspect / aspect : 100;
  const ox = (100 - wPct) / 2, oy = (100 - hPct) / 2;
  return { x: ox + frame.x / size.cx * wPct, y: oy + frame.y / size.cy * hPct, w: Math.max(0.05, frame.w / size.cx * wPct), h: Math.max(0.05, frame.h / size.cy * hPct) };
}

function readText(owner: Element): ReadText | null {
  const body = first(owner, "p:txBody");
  if (!body) return null;
  const paragraphs = direct(body, "a:p");
  const html: string[] = [], plain: string[] = [], fonts: string[] = [];
  let isBullet = false, ordered = false;
  let firstRpr: Element | null = null, firstPpr: Element | null = null;
  for (const p of paragraphs) {
    const ppr = first(p, "a:pPr");
    if (!firstPpr) firstPpr = ppr;
    const runs = direct(p, "a:r");
    const fieldRuns = direct(p, "a:fld");
    const pieces = [...runs, ...fieldRuns].sort((a, b) => Array.from(p.children).indexOf(a) - Array.from(p.children).indexOf(b));
    let line = "";
    for (const run of pieces) {
      const rpr = first(run, "a:rPr");
      if (!firstRpr && rpr) firstRpr = rpr;
      const face = first(rpr, "a:latin")?.getAttribute("typeface");
      if (face) fonts.push(face);
      let value = all(run, "a:t").map((t) => t.textContent || "").join("");
      if (rpr?.getAttribute("cap") === "all") value = value.toUpperCase();
      if (rpr?.getAttribute("b") === "1") value = `<strong>${esc(value)}</strong>`; else value = esc(value);
      if (rpr?.getAttribute("i") === "1") value = `<em>${value}</em>`;
      line += value;
    }
    const brs = direct(p, "a:br").length;
    if (!line && brs) line = "<br>";
    if (!line) continue;
    const raw = line.replace(/<[^>]+>/g, "");
    plain.push(raw);
    const bullet = first(ppr, "a:buChar"), auto = first(ppr, "a:buAutoNum"), none = first(ppr, "a:buNone");
    if (!none && (bullet || auto || num(ppr?.getAttribute("lvl")) > 0)) {
      isBullet = true; if (auto) ordered = true;
      html.push(`<li>${line}</li>`);
    } else html.push(`<p>${line}</p>`);
  }
  if (!plain.length && !html.length) return null;
  const ph = first(first(owner, "p:nvSpPr"), "p:nvPr");
  const placeholder = first(ph, "p:ph");
  const isTitle = ["title", "ctrTitle"].includes(placeholder?.getAttribute("type") || "");
  // pptxgenjs běžně ukládá velikost do rPr, PowerPoint často do pPr/defRPr.
  // Nespoléhat jen na první běh: jinak se reálný text vrátí k výchozím 18 pt.
  const paragraphDefault = first(firstPpr, "a:defRPr");
  const listDefault = first(first(body, "a:lstStyle"), "a:defRPr");
  const defaultRpr = paragraphDefault || listDefault;
  const size = num(firstRpr?.getAttribute("sz") || defaultRpr?.getAttribute("sz"), 1800) / 100;
  const color = readColor(first(firstRpr, "a:solidFill") || first(defaultRpr, "a:solidFill"), { colors: {}, fonts: [], backgroundFills: [] }).color;
  const alignValue = firstPpr?.getAttribute("algn");
  const align = alignValue === "ctr" ? "center" : alignValue === "r" ? "right" : "left";
  const linePct = num(first(first(firstPpr, "a:lnSpc"), "a:spcPct")?.getAttribute("val"), 120000) / 100000;
  const props: Record<string, any> = {
    fontSize: size,
    fontFamily: fontFamily(fonts[0] || first(defaultRpr, "a:latin")?.getAttribute("typeface")),
    bold: (firstRpr || defaultRpr)?.getAttribute("b") === "1" || undefined,
    italic: (firstRpr || defaultRpr)?.getAttribute("i") === "1" || undefined,
    underline: (firstRpr || defaultRpr)?.getAttribute("u") && (firstRpr || defaultRpr)?.getAttribute("u") !== "none" || undefined,
    align,
    lineHeight: linePct > 0 ? linePct : undefined,
  };
  // Barvu doplní parser s motivem; tady jen evidence z explicitního RGB.
  if (color) props.color = color;
  const joinedHtml = isBullet ? `<${ordered ? "ol" : "ul"}>${html.map((h) => h.startsWith("<li>") ? h : `<li>${h}</li>`).join("")}</${ordered ? "ol" : "ul"}>` : html.join("");
  return { text: plain.join("\n"), html: joinedHtml, isTitle, props, fonts };
}

export interface RichPptxImportOptions {
  themeId?: string;
  userId?: string;
  uploadImage?: PresentationImageUpload;
  onProgress?: (progress: PresentationImportProgress) => void;
}

class Parser {
  private warnings = new Set<string>();
  private counts = { textElements: 0, shapes: 0, images: 0, notes: 0 };
  private docs = new Map<string, Promise<Document>>();
  private rels = new Map<string, Promise<Record<string, Rel>>>();
  private cache: PresentationImageImportCache;
  constructor(private zip: JSZip, private options: RichPptxImportOptions, private theme: ThemeData, private size: { cx: number; cy: number }) {
    this.cache = new PresentationImageImportCache(options.uploadImage || createPresentationImageUploader(options.userId));
  }

  private warn(message: string) { this.warnings.add(message); }
  private async document(path: string | undefined): Promise<Document | null> {
    if (!path || !this.zip.files[path]) return null;
    if (!this.docs.has(path)) this.docs.set(path, this.zip.files[path].async("string").then(xml));
    return this.docs.get(path)!;
  }
  private async relationships(part: string): Promise<Record<string, Rel>> {
    const dir = part.split("/").slice(0, -1).join("/"), name = part.split("/").pop();
    const path = `${dir}/_rels/${name}.rels`;
    if (!this.rels.has(path)) this.rels.set(path, (async () => {
      const doc = await this.document(path); const result: Record<string, Rel> = {};
      if (doc) for (const rel of Array.from(doc.getElementsByTagName("Relationship"))) {
        const id = rel.getAttribute("Id"); if (id) result[id] = { type: rel.getAttribute("Type") || "", target: normalizePart(part, rel.getAttribute("Target") || "") };
      }
      return result;
    })());
    return this.rels.get(path)!;
  }
  private async related(part: string, typePart: string) {
    const rels = await this.relationships(part);
    return Object.values(rels).find((r) => r.type.includes(typePart))?.target;
  }
  private async image(part: string, rels: Record<string, Rel>, embed: string | null) {
    if (!embed || !rels[embed]) return null;
    const path = rels[embed].target;
    if (/\.(svg|emf|wmf)$/i.test(path)) { this.warn(`Přeskočen nepodporovaný vektorový obrázek: ${path.split("/").pop()}.`); return null; }
    const entry = this.zip.files[path];
    if (!entry) { this.warn(`Chybějící obrázek ${path.split("/").pop()} byl přeskočen.`); return null; }
    try { return await this.cache.import(await entry.async("uint8array")); }
    catch (error: any) { this.warn(`${path.split("/").pop()}: ${error?.message || "obrázek se nepodařilo nahrát"}`); return null; }
  }

  private async fillBackground(part: string, props: Element | null): Promise<Record<string, any> | null> {
    if (!props) return null;
    const solid = props.tagName === "a:solidFill" ? props : first(props, "a:solidFill");
    if (solid) { const { color } = readColor(solid, this.theme); if (color) return { color }; }
    const gradient = props.tagName === "a:gradFill" ? props : first(props, "a:gradFill");
    if (gradient) {
      const stops = direct(first(gradient, "a:gsLst"), "a:gs").map((gs) => readColor(gs, this.theme).color).filter(Boolean) as string[];
      if (stops.length > 2) this.warn("Přechod se třemi a více barvami byl zjednodušen na dvě.");
      if (stops.length) { const ang = num(first(gradient, "a:lin")?.getAttribute("ang"), 0) / 60000; return { gradient: { from: stops[0], to: stops[1] || stops[0], direction: `${(ang + 90) % 360}deg` } }; }
    }
    const blipFill = props.tagName === "a:blipFill" ? props : first(props, "a:blipFill");
    const embed = first(blipFill, "a:blip")?.getAttribute("r:embed");
    const url = await this.image(part, await this.relationships(part), embed);
    return url ? { image: url } : null;
  }

  private async background(part: string, doc: Document): Promise<Record<string, any> | null> {
    const bg = first(first(doc.documentElement, "p:cSld"), "p:bg");
    if (!bg) return null;
    const properties = first(bg, "p:bgPr");
    if (properties) return this.fillBackground(part, properties);
    const reference = first(bg, "p:bgRef");
    if (!reference) return null;
    // bgRef idx=1001+ odkazuje do a:bgFillStyleLst motivu, nikoli přímo na barvu.
    // PowerPoint tak může mít v referenci bílé schemeClr, zatímco skutečná výplň je v motivu.
    const index = num(reference.getAttribute("idx"), 0) - 1001;
    const themed = await this.fillBackground(part, this.theme.backgroundFills[index] || null);
    if (themed) return themed;
    // Některé generátory zapisují barvu přímo do bgRef bez položky v motivu.
    const directColor = readColor(reference, this.theme).color;
    return directColor ? { color: directColor } : null;
  }

  private placeholderTransforms(doc: Document | null) {
    const map = new Map<string, RawFrame>();
    if (!doc) return map;
    for (const sp of all(doc, "p:sp")) {
      const ph = first(first(first(sp, "p:nvSpPr"), "p:nvPr"), "p:ph"); const frame = transformOf(sp);
      if (ph && frame) map.set(`${ph.getAttribute("type") || "body"}:${ph.getAttribute("idx") || "0"}`, frame);
    }
    return map;
  }

  private async parseContainer(part: string, doc: Document, group: ReturnType<typeof groupTransform> = null, placeholders = new Map<string, RawFrame>(), picturesOnly = false): Promise<Record<string, any>[]> {
    const tree = all(doc, "p:spTree")[0]; if (!tree) return [];
    const blocks: Record<string, any>[] = [];
    const rels = await this.relationships(part);
    const children = Array.from(tree.children);
    let flow = 0, z = 0;
    const visit = async (nodes: Element[], activeGroup: ReturnType<typeof groupTransform>) => {
      for (const node of nodes) {
        if (node.tagName === "p:grpSp") {
          const next = groupTransform(node);
          const inner = first(node, "p:spTree") ? Array.from(first(node, "p:spTree")!.children) : Array.from(node.children).filter((c) => ["p:sp", "p:pic", "p:graphicFrame", "p:grpSp"].includes(c.tagName));
          await visit(inner, next || activeGroup); continue;
        }
        if (node.tagName === "p:sp" && !picturesOnly) {
          const text = readText(node); const ph = first(first(first(node, "p:nvSpPr"), "p:nvPr"), "p:ph");
          let raw = transformOf(node);
          if (!raw && ph) raw = placeholders.get(`${ph.getAttribute("type") || "body"}:${ph.getAttribute("idx") || "0"}`) || null;
          if (!raw) raw = { x: this.size.cx * 0.06, y: this.size.cy * (0.06 + flow++ * 0.13), w: this.size.cx * 0.88, h: this.size.cy * 0.11, rot: 0 };
          const frame = stageFrame(mapGroupFrame(raw, activeGroup), this.size);
          const spPr = first(node, "p:spPr"), preset = first(first(spPr, "a:prstGeom"), "a:prstGeom")?.getAttribute("prst") || first(spPr, "a:prstGeom")?.getAttribute("prst") || "rect";
          const shapeMap: Record<string, string> = { rect: "rectangle", roundRect: "rounded-rect", ellipse: "circle", round1Rect: "rounded-rect", round2SameRect: "rounded-rect", pill: "pill" };
          const shapeKind = shapeMap[preset];
          const solid = readColor(first(spPr, "a:solidFill"), this.theme), line = first(spPr, "a:ln"), stroke = readColor(first(line, "a:solidFill"), this.theme);
          const hasShape = !!first(spPr, "a:solidFill") || !!first(spPr, "a:gradFill") || !!shapeKind && !!text && preset !== "rect";
          if (!shapeKind && (first(spPr, "a:solidFill") || first(spPr, "a:gradFill"))) this.warn(`Tvar ${preset} byl nahrazen textovým prvkem; obsah zůstal zachovaný.`);
          if (text?.props) {
            const runColor = readColor(first(first(first(first(first(node, "p:txBody"), "a:p"), "a:r"), "a:rPr"), "a:solidFill"), this.theme);
            if (runColor.color) text.props.color = runColor.color;
          }
          const base = { id: uid(), visible: true, frame, zIndex: ++z, props: { rotation: raw.rot || undefined } as Record<string, any> };
          if (hasShape && shapeKind) {
            const gradient = first(spPr, "a:gradFill");
            const stops = gradient ? direct(first(gradient, "a:gsLst"), "a:gs").map((gs) => readColor(gs, this.theme).color).filter(Boolean) : [];
            blocks.push({ ...base, type: "shape", props: { ...base.props, shapeKind, fillColor: solid.color || "#FFFFFF", fillOpacity: solid.opacity, strokeColor: stroke.color, strokeOpacity: stroke.opacity, strokeWidth: line ? num(line.getAttribute("w"), 12700) / 12700 : 0, borderRadius: preset === "roundRect" ? 18 : undefined, fillGradient: stops.length ? { from: stops[0], to: stops[1] || stops[0], direction: `${num(first(gradient, "a:lin")?.getAttribute("ang"), 0) / 60000 + 90}deg` } : undefined, text: text?.html || "", fontSize: text?.props.fontSize, color: text?.props.color, fontFamily: text?.props.fontFamily, bold: text?.props.bold, italic: text?.props.italic, align: text?.props.align, lineHeight: text?.props.lineHeight } });
            this.counts.shapes++; if (text) this.counts.textElements++;
          } else if (text) {
            const isTitle = text.isTitle || (Number(text.props.fontSize) >= 28 && !blocks.some((b) => b.type === "heading"));
            blocks.push({ ...base, type: isTitle ? "heading" : "paragraph", props: { ...base.props, ...(isTitle ? { level: 1, text: text.html } : { text: text.html }), ...text.props } });
            this.counts.textElements++;
          }
          continue;
        }
        if (node.tagName === "p:pic") {
          let raw = transformOf(node, "pic"); if (!raw) { this.warn("Obrázek bez pozice byl přeskočen."); continue; }
          const frame = stageFrame(mapGroupFrame(raw, activeGroup), this.size);
          const blip = first(first(node, "p:blipFill"), "a:blip");
          const url = await this.image(part, rels, blip?.getAttribute("r:embed")); if (!url) continue;
          const src = first(first(node, "p:blipFill"), "a:srcRect");
          const crop = src ? { left: num(src.getAttribute("l")) / 1000, top: num(src.getAttribute("t")) / 1000, right: num(src.getAttribute("r")) / 1000, bottom: num(src.getAttribute("b")) / 1000 } : undefined;
          const alt = first(first(node, "p:nvPicPr"), "p:cNvPr")?.getAttribute("descr") || "";
          blocks.push({ id: uid(), type: "image", visible: true, frame, zIndex: ++z, props: { url, alt, objectFit: crop ? "cover" : "contain", crop, rotation: raw.rot || undefined, flipH: raw.flipH, flipV: raw.flipV } });
          this.counts.images++; continue;
        }
        if (node.tagName === "p:graphicFrame" && !picturesOnly) {
          const raw = transformOf(node, "graphic"); const frame = raw ? stageFrame(mapGroupFrame(raw, activeGroup), this.size) : { x: 8, y: 20 + flow++ * 15, w: 84, h: 14 };
          const uri = first(first(node, "a:graphic"), "a:graphicData")?.getAttribute("uri") || "";
          let text = all(node, "a:t").map((t) => t.textContent || "").join(" ").trim();
          if (uri.includes("diagram")) {
            const rel = Object.values(rels).find((r) => r.type.includes("diagramData"));
            const dataDoc = await this.document(rel?.target);
            if (dataDoc) text = all(dataDoc, "a:t").map((t) => t.textContent || "").join(" ").trim();
            this.warn("SmartArt byl převeden pouze na upravitelný text.");
          }
          if (text) { blocks.push({ id: uid(), type: "paragraph", visible: true, frame, zIndex: ++z, props: { text: esc(text), fontSize: 18, fontFamily: '"DM Sans", Arial, sans-serif', color: "#2B1A3F" } }); this.counts.textElements++; }
        }
      }
    };
    await visit(children, group);
    return blocks;
  }

  async run(): Promise<PresentationImportResult> {
    const presentation = await this.document("ppt/presentation.xml"); if (!presentation) throw new Error("Chybí ppt/presentation.xml.");
    const presentationRels = await this.relationships("ppt/presentation.xml");
    const slideParts = all(presentation, "p:sldId").map((id) => presentationRels[id.getAttribute("r:id") || ""]?.target).filter(Boolean);
    if (!slideParts.length) throw new Error("V souboru nejsou žádné snímky.");
    const slides: Record<string, any>[] = [];
    for (let i = 0; i < slideParts.length; i++) {
      const part = slideParts[i]; this.options.onProgress?.({ current: i + 1, total: slideParts.length, message: `Zpracovávám slide ${i + 1} z ${slideParts.length}…` });
      const doc = await this.document(part); if (!doc) continue;
      const layoutPart = await this.related(part, "/slideLayout"); const layout = await this.document(layoutPart);
      const masterPart = layoutPart ? await this.related(layoutPart, "/slideMaster") : undefined; const master = await this.document(masterPart);
      const inherited = new Map([...this.placeholderTransforms(master), ...this.placeholderTransforms(layout)]);
      const background = await this.background(part, doc) || (layout ? await this.background(layoutPart!, layout) : null) || (master ? await this.background(masterPart!, master) : null);
      const masterBlocks = master ? await this.parseContainer(masterPart!, master, null, new Map(), true) : [];
      const layoutBlocks = layout ? await this.parseContainer(layoutPart!, layout, null, new Map(), true) : [];
      const blocks = await this.parseContainer(part, doc, null, inherited);
      const notesPart = await this.related(part, "/notesSlide"); const notesDoc = await this.document(notesPart);
      const notes = notesDoc ? all(notesDoc, "a:p").map((p) => all(p, "a:t").map((t) => t.textContent || "").join("").trim()).filter((t) => t && t !== String(i + 1)).join("\n").trim() : "";
      if (notes) this.counts.notes++;
      if (all(doc, "p:timing").length) this.warn("Animace a časování se do editoru nepřenášejí.");
      slides.push({ slideId: uid(), type: "content", projector: { headline: "", body: "" }, device: { instructions: "" }, blocks: [...masterBlocks, ...layoutBlocks, ...blocks].map((b, index) => ({ ...b, zIndex: index + 1 })), teacherNotes: notes, ...(background ? { backgroundOverride: background } : {}), ...(this.options.themeId ? { themeId: this.options.themeId } : {}), importSource: "pptx", sourceAspectRatio: this.size.cx / this.size.cy });
    }
    return { slides, summary: { slideCount: slides.length, ...this.counts, warnings: [...this.warnings] } };
  }
}

async function themeAndSize(zip: JSZip): Promise<{ theme: ThemeData; size: { cx: number; cy: number } }> {
  const read = async (path: string) => zip.files[path] ? xml(await zip.files[path].async("string")) : null;
  const themeDoc = await read("ppt/theme/theme1.xml"); const colors: Record<string, string> = { dk1: "#111111", lt1: "#FFFFFF", dk2: "#2B1A3F", lt2: "#F3F1E6", accent1: "#663196", accent2: "#63C7CF" };
  const scheme = themeDoc ? all(themeDoc, "a:clrScheme")[0] : null;
  if (scheme) for (const child of Array.from(scheme.children)) {
    const rgb = first(child, "a:srgbClr")?.getAttribute("val") || first(child, "a:sysClr")?.getAttribute("lastClr");
    if (rgb) colors[child.tagName.replace("a:", "")] = `#${rgb.toUpperCase()}`;
  }
  const fonts = themeDoc ? all(themeDoc, "a:latin").map((e) => e.getAttribute("typeface") || "").filter(Boolean) : [];
  const presentation = await read("ppt/presentation.xml"); const sldSz = presentation ? all(presentation, "p:sldSz")[0] : null;
  const backgroundFills = themeDoc ? Array.from(all(themeDoc, "a:bgFillStyleLst")[0]?.children || []) : [];
  return { theme: { colors, fonts, backgroundFills }, size: { cx: num(sldSz?.getAttribute("cx"), 13.333 * EMU), cy: num(sldSz?.getAttribute("cy"), 7.5 * EMU) } };
}

export async function importRichPptx(file: Blob, options: RichPptxImportOptions = {}): Promise<PresentationImportResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await readBlobArrayBuffer(file));
  const { theme, size } = await themeAndSize(zip);
  return new Parser(zip, options, theme, size).run();
}
