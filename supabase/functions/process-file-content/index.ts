import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BASE64_BYTES = 25 * 1024 * 1024;
const BLOCK_TOOL = {
  type: "function",
  function: {
    name: "create_blocks",
    description: "Převeď vstupní studijní materiál do editovatelných bloků ZEdu.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        lessons: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "blocks"],
            properties: {
              title: { type: "string" },
              blocks: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "type", "props", "visible"],
                  properties: {
                    id: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["heading", "paragraph", "bullet_list", "table", "callout", "quote", "divider", "hierarchy"],
                    },
                    visible: { type: "boolean" },
                    props: {
                      type: "object",
                      additionalProperties: true,
                      properties: {
                        level: { type: "number" },
                        text: { type: "string" },
                        items: { type: "array", items: { type: "string" } },
                        headers: { type: "array", items: { type: "string" } },
                        rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                        calloutType: { type: "string" },
                        author: { type: "string" },
                        style: { type: "string" },
                        shape: { type: "string", enum: ["pyramid", "layers", "steps"] },
                        direction: { type: "string", enum: ["top-to-bottom", "bottom-to-top"] },
                        levels: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["label"],
                            properties: {
                              label: { type: "string" },
                              description: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      required: ["lessons"],
    },
  },
};

const SYSTEM_PROMPT = `Jsi expert na zpracování vzdělávacích materiálů pro platformu ZEdu.
Dostaneš text z PDF, DOCX nebo PPTX a musíš převést VEŠKERÝ textový obsah do editovatelných bloků.

DŮLEŽITÉ: Použij VÝHRADNĚ text z dokumentu. NEVYMÝŠLEJ žádný vlastní obsah. Pokud text neobsahuje informaci, NEVKLÁDEJ ji. Struktura musí přesně odpovídat originálnímu dokumentu.

PRAVIDLA:
- Zachovej veškerý text z dokumentu doslovně, nic nevynechávej a nic nedoplňuj.
- Každý slide nebo stránku odděl blokem divider.
- Hlavní nadpisy používej jako heading s level 2.
- Podnadpisy používej jako heading s level 3.
- Běžný text převáděj na paragraph.
- Odrážkové i číslované seznamy převáděj na bullet_list s props.items.
- Tabulky převáděj na table s props.headers a props.rows.
- Důležitá upozornění můžeš převést na callout s props.calloutType = "note".
- Citace převáděj na quote.
- HIERARCHIE (blok "hierarchy"): Použij POUZE tehdy, když text popisuje skutečně uspořádané úrovně/stupně/vrstvy s jasným pořadím a vztahem nadřazenosti — např. Maslowova pyramida potřeb, potravinová pyramida, organizační struktura firmy, geologické vrstvy, fáze procesu se závaznou posloupností. NEPOUŽÍVEJ pro běžné odrážkové seznamy, výčty vlastností nebo neuspořádané položky — ty jsou vždy bullet_list. Když je hierarchy vhodná, vytvoř props: { shape: "pyramid" (pro pyramidy potřeb, potravinové pyramidy) | "layers" (pro vrstvy stejné důležitosti) | "steps" (pro sekvenční fáze), direction: "top-to-bottom" (vrchol nahoře) | "bottom-to-top" (základna nahoře, typické pro Maslowa), levels: [{ label: "název úrovně", description: "krátký popis (volitelně)" }] }. Pořadí levels: první = vrchol / horní vrstva, poslední = základna / spodní vrstva. Min 2, max 8 úrovní.
- Každý blok musí mít: id (6 náhodných alfanumerických znaků), type, visible=true, props.
- Text nesmí obsahovat markdown ani HTML.
- Pokud je režim split, vrať více lekcí podle přirozených sekcí/slidů; pokud je režim single, vrať právě jednu lekci.
- Vrať pouze data přes tool call create_blocks.`;

const textDecoder = new TextDecoder();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64(base64: string) {
  const clean = base64.includes(",") ? base64.split(",", 2)[1] : base64;
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function stripXml(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractDocxText(bytes: Uint8Array) {
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = unzipSync(bytes);
  const docXml = unzipped["word/document.xml"];
  if (!docXml) return "";

  const xml = textDecoder.decode(docXml);
  const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
    .map((match) => {
      const paragraphXml = match[0];
      const texts = [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((m) => stripXml(m[1]))
        .filter(Boolean);
      return texts.join(" ").trim();
    })
    .filter(Boolean);

  return paragraphs.join("\n");
}

// Extract text from a single slide's XML, detecting visual column layouts
// (multiple shapes positioned side-by-side) and rendering them as markdown
// tables so the AI can preserve the structure.
function extractSlideText(xml: string, _slideLabel = "unknown"): string {
  type Shape = { x: number; y: number; cx: number; cy: number; text: string };

  // --- Extract and strip <p:grpSp> groups first ---
  // Grouped shapes use local coordinates relative to the group transform,
  // so they cannot participate in table detection based on absolute x/y.
  // Instead, collect all text inside each group and emit as one text block.
  const groupTexts: string[] = [];
  let stripped = "";
  {
    let i = 0;
    while (i < xml.length) {
      const start = xml.indexOf("<p:grpSp", i);
      if (start === -1) { stripped += xml.slice(i); break; }
      // Ensure we matched a full tag, not a prefix like <p:grpSpPr>
      const nextChar = xml[start + "<p:grpSp".length];
      if (nextChar !== " " && nextChar !== ">" && nextChar !== "\t" && nextChar !== "\n") {
        stripped += xml.slice(i, start + 1);
        i = start + 1;
        continue;
      }
      stripped += xml.slice(i, start);
      // Balanced scan for </p:grpSp>
      let depth = 1;
      let j = start + "<p:grpSp".length;
      while (j < xml.length && depth > 0) {
        const openIdx = xml.indexOf("<p:grpSp", j);
        const closeIdx = xml.indexOf("</p:grpSp>", j);
        if (closeIdx === -1) { j = xml.length; break; }
        // Only count opens that are real grpSp tags (not grpSpPr)
        let realOpen = -1;
        if (openIdx !== -1 && openIdx < closeIdx) {
          const nc = xml[openIdx + "<p:grpSp".length];
          if (nc === " " || nc === ">" || nc === "\t" || nc === "\n") {
            realOpen = openIdx;
          }
        }
        if (realOpen !== -1) {
          depth++;
          j = realOpen + "<p:grpSp".length;
        } else {
          depth--;
          j = closeIdx + "</p:grpSp>".length;
        }
      }
      const groupXml = xml.slice(start, j);
      const paras = [...groupXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
        .map((p) => [...p[0].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
          .map((m) => stripXml(m[1]))
          .filter(Boolean)
          .join(" ").trim())
        .filter((s) => s.length > 0);
      if (paras.length > 0) groupTexts.push(paras.join("\n"));
      i = j;
    }
  }

  const workXml = stripped;

  // --- Native <a:tbl> tables (deterministic). ---
  const nativeTables: string[] = [];
  const tblRegex = /<a:tbl\b[\s\S]*?<\/a:tbl>/g;
  for (const tblMatch of workXml.matchAll(tblRegex)) {
    const tblXml = tblMatch[0];
    const trMatches = [...tblXml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)];
    const rows: string[][] = [];
    for (const trMatch of trMatches) {
      const tcMatches = [...trMatch[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)];
      const cells = tcMatches.map((tc) => {
        const paragraphs = [...tc[0].matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
          .map((p) => [...p[0].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
            .map((m) => stripXml(m[1]))
            .filter(Boolean)
            .join(" "))
          .filter(Boolean);
        return paragraphs.join(" ").trim();
      });
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 2 && rows[0].length >= 2) {
      const cols = Math.max(...rows.map((r) => r.length));
      const norm = rows.map((r) => {
        const padded = [...r];
        while (padded.length < cols) padded.push("");
        return padded;
      });
      const lines = [
        `| ${norm[0].join(" | ")} |`,
        `| ${norm[0].map(() => "---").join(" | ")} |`,
        ...norm.slice(1).map((r) => `| ${r.join(" | ")} |`),
      ];
      nativeTables.push(lines.join("\n"));
    }
  }

  const shapes: Shape[] = [];
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  const offRegex = /<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"\s*\/>/;
  const extRegex = /<a:ext\s+cx="(-?\d+)"\s+cy="(-?\d+)"\s*\/>/;

  for (const match of workXml.matchAll(spRegex)) {
    const spXml = match[0];
    const spPr = spXml.match(/<p:spPr\b[\s\S]*?<\/p:spPr>/)?.[0] ?? "";
    const off = spPr.match(offRegex);
    const ext = spPr.match(extRegex);
    const paragraphs = [...spXml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
      .map((p) => {
        const runs = [...p[0].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
          .map((m) => stripXml(m[1]))
          .filter(Boolean);
        return runs.join(" ");
      })
      .filter(Boolean);
    const text = paragraphs.join("\n").trim();
    if (!text) continue;
    shapes.push({
      x: off ? parseInt(off[1], 10) : 0,
      y: off ? parseInt(off[2], 10) : 0,
      cx: ext ? parseInt(ext[1], 10) : 0,
      cy: ext ? parseInt(ext[2], 10) : 0,
      text,
    });
  }

  const emitGroups = () => groupTexts.length > 0 ? groupTexts.join("\n\n") : "";

  if (shapes.length === 0) {
    const parts: string[] = [];
    if (nativeTables.length > 0) parts.push(nativeTables.join("\n\n"));
    if (groupTexts.length > 0) parts.push(emitGroups());
    if (parts.length === 0) {
      const texts = [...workXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((m) => stripXml(m[1]))
        .filter(Boolean);
      return texts.join("\n");
    }
    return parts.join("\n\n");
  }

  // Sort by y then x for reading order.
  shapes.sort((a, b) => a.y - b.y || a.x - b.x);

  // Cluster into rows by y proximity.
  const rows: Shape[][] = [];
  const yTolerance = 360000;
  for (const s of shapes) {
    const tol = Math.max(1, Math.min(yTolerance, s.cy > 0 ? s.cy / 2 : yTolerance));
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - s.y) <= tol) {
      last.push(s);
    } else {
      rows.push([s]);
    }
  }
  for (const r of rows) r.sort((a, b) => a.x - b.x);

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const stdev = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
  };

  const MAX_COLS = 5;
  const X_ALIGN_TOL = 300000;
  const WIDTH_CV_MAX = 0.35;

  const widthCV = (r: Shape[]) => {
    const widths = r.map((s) => s.cx).filter((w) => w > 0);
    if (widths.length < 2) return Infinity;
    const m = mean(widths);
    if (m <= 0) return Infinity;
    return stdev(widths) / m;
  };

  // --- Header-row + body-row multiline table detector ---
  // Row A: 2..MAX_COLS shapes, each exactly 1 text line (headers), uniform widths.
  // Row B: same shape count, each >=1 line, x-aligned to row A by nearest x.
  // Body may have differing line counts per column — output uses max length,
  // shorter columns pad with empty strings.
  const multilineTables: string[] = [];
  const consumedRowIdx = new Set<number>();
  for (let idx = 0; idx < rows.length - 1; idx++) {
    if (consumedRowIdx.has(idx)) continue;
    const header = rows[idx];
    if (header.length < 2 || header.length > MAX_COLS) continue;
    const hLines = header.map((s) => s.text.split("\n").map((l) => l.trim()).filter(Boolean));
    if (!hLines.every((l) => l.length === 1)) continue;
    if (widthCV(header) > WIDTH_CV_MAX) continue;

    const body = rows[idx + 1];
    if (consumedRowIdx.has(idx + 1)) continue;
    if (body.length !== header.length) continue;
    const bLines = body.map((s) => s.text.split("\n").map((l) => l.trim()).filter(Boolean));
    if (bLines.some((c) => c.length < 1)) continue;

    // Pair body shapes to header shapes by nearest x within tolerance.
    const usedB = new Set<number>();
    const paired: number[] = [];
    let aligned = true;
    for (let h = 0; h < header.length; h++) {
      let best = -1;
      let bestDist = Infinity;
      for (let b = 0; b < body.length; b++) {
        if (usedB.has(b)) continue;
        const d = Math.abs(body[b].x - header[h].x);
        if (d < bestDist) { bestDist = d; best = b; }
      }
      if (best === -1 || bestDist > X_ALIGN_TOL) { aligned = false; break; }
      paired.push(best);
      usedB.add(best);
    }
    if (!aligned) continue;

    const cols = paired.map((bIdx, hIdx) => ({
      header: header[hIdx].text.trim(),
      body: bLines[bIdx],
    }));
    const maxRows = Math.max(...cols.map((c) => c.body.length));
    const out: string[] = [];
    out.push(`| ${cols.map((c) => c.header).join(" | ")} |`);
    out.push(`| ${cols.map(() => "---").join(" | ")} |`);
    for (let li = 0; li < maxRows; li++) {
      out.push(`| ${cols.map((c) => c.body[li] ?? "").join(" | ")} |`);
    }
    multilineTables.push(out.join("\n"));
    consumedRowIdx.add(idx);
    consumedRowIdx.add(idx + 1);
  }

  // Multi-row same-column-count table detection (fallback for grid layouts).
  const lines: string[] = [];
  let i = 0;
  while (i < rows.length) {
    if (consumedRowIdx.has(i)) { i++; continue; }
    const base = rows[i];
    const cols = base.length;

    let canStart = true;
    if (cols < 2 || cols > MAX_COLS) {
      canStart = false;
    } else if (!base.every((s) => s.text.length > 0)) {
      canStart = false;
    } else if (widthCV(base) > WIDTH_CV_MAX) {
      canStart = false;
    }

    if (canStart) {
      const group: Shape[][] = [base];
      let j = i + 1;
      while (j < rows.length && !consumedRowIdx.has(j)) {
        const next = rows[j];
        if (next.length !== cols) break;
        if (!next.every((s) => s.text.length > 0)) break;
        if (widthCV(next) > WIDTH_CV_MAX) break;
        let aligned = true;
        for (let k = 0; k < cols; k++) {
          if (Math.abs(next[k].x - base[k].x) > X_ALIGN_TOL) { aligned = false; break; }
        }
        if (!aligned) break;
        group.push(next);
        j++;
      }

      if (group.length >= 2) {
        const headerRow = group[0].map((s) => s.text.split("\n").join(" ").trim());
        lines.push(`| ${headerRow.join(" | ")} |`);
        lines.push(`| ${headerRow.map(() => "---").join(" | ")} |`);
        for (let r = 1; r < group.length; r++) {
          const cells = group[r].map((s) => s.text.split("\n").join(" ").trim());
          lines.push(`| ${cells.join(" | ")} |`);
        }
        i = j;
        continue;
      }
    }

    for (const s of base) lines.push(s.text);
    i++;
  }

  const parts: string[] = [];
  if (nativeTables.length > 0) parts.push(nativeTables.join("\n\n"));
  if (multilineTables.length > 0) parts.push(multilineTables.join("\n\n"));
  if (lines.length > 0) parts.push(lines.join("\n"));
  if (groupTexts.length > 0) parts.push(emitGroups());
  return parts.join("\n\n");
}



async function extractPptxText(bytes: Uint8Array) {
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = unzipSync(bytes);
  const slideFiles = Object.keys(unzipped)
    .filter((name) => /ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  const slides: string[] = [];
  for (const slidePath of slideFiles) {
    const xml = textDecoder.decode(unzipped[slidePath]);
    const slideNumber = slidePath.match(/slide(\d+)\.xml$/)?.[1] ?? slidePath;
    const slideText = extractSlideText(xml, slideNumber).trim();
    if (slideText.length > 0) {
      slides.push(`--- Slide ---\n${slideText}`);
    }
  }

  return slides.join("\n\n");
}

async function callGatewayWithFile(
  apiKey: string,
  body: { fileBase64: string; fileName: string; mimeType: string; mode: "single" | "split" },
) {
  const userPrompt = `Zpracuj soubor "${body.fileName}" a převeď jeho kompletní obsah do editovatelných bloků ZEdu. Režim: ${body.mode}.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${body.mimeType || "application/pdf"};base64,${body.fileBase64}`,
              },
            },
          ],
        },
      ],
      tools: [BLOCK_TOOL],
      tool_choice: { type: "function", function: { name: "create_blocks" } },
      temperature: 0.1,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway file mode failed: ${response.status} - ${errText.slice(0, 400)}`);
  }

  return response.json();
}

async function callGatewayWithText(
  apiKey: string,
  payload: { extractedText: string; fileName: string; mimeType: string; mode: "single" | "split" },
) {
  const userPrompt = `Zpracuj tento extrahovaný text z dokumentu "${payload.fileName}" a převeď ho do JSON bloků. ZACHOVEJ PŘESNĚ text z dokumentu, NEVYMÝŠLEJ vlastní obsah. Režim: ${payload.mode} (split = rozděl podle slidů/sekcí, single = jedna lekce).\n\nEXTRAHOVANÝ TEXT:\n${payload.extractedText}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [BLOCK_TOOL],
      tool_choice: { type: "function", function: { name: "create_blocks" } },
      temperature: 0.1,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway text mode failed: ${response.status} - ${errText.slice(0, 400)}`);
  }

  return response.json();
}

function ensureToolArguments(aiResult: any) {
  const toolArgs = aiResult?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!toolArgs) {
    throw new Error("AI nevrátila strukturovaný výstup bloků.");
  }
  return JSON.parse(toolArgs);
}

function normalizeBlock(block: any) {
  const type = typeof block?.type === "string" ? block.type : "paragraph";
  const id = typeof block?.id === "string" && /^[a-zA-Z0-9]{6,}$/.test(block.id)
    ? block.id.slice(0, 12)
    : crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  const props = typeof block?.props === "object" && block.props ? block.props : {};

  switch (type) {
    case "heading":
      return {
        id,
        type,
        visible: true,
        props: { text: String(props.text ?? "").trim(), level: props.level === 3 ? 3 : 2 },
      };
    case "bullet_list":
      return {
        id,
        type,
        visible: true,
        props: {
          items: Array.isArray(props.items)
            ? props.items.map((item: unknown) => String(item).trim()).filter(Boolean)
            : [],
        },
      };
    case "table":
      return {
        id,
        type,
        visible: true,
        props: {
          headers: Array.isArray(props.headers) ? props.headers.map((item: unknown) => String(item)) : [],
          rows: Array.isArray(props.rows)
            ? props.rows.map((row: unknown) => (Array.isArray(row) ? row.map((cell: unknown) => String(cell)) : []))
            : [],
        },
      };
    case "callout":
      return {
        id,
        type,
        visible: true,
        props: { text: String(props.text ?? "").trim(), calloutType: "note" },
      };
    case "quote":
      return {
        id,
        type,
        visible: true,
        props: { text: String(props.text ?? "").trim(), author: String(props.author ?? "") },
      };
    case "divider":
      return { id, type, visible: true, props: { style: "line" } };
    case "hierarchy": {
      const shape = ["pyramid", "layers", "steps"].includes(props.shape) ? props.shape : "pyramid";
      const direction = props.direction === "bottom-to-top" ? "bottom-to-top" : "top-to-bottom";
      const rawLevels = Array.isArray(props.levels) ? props.levels : [];
      const levels = rawLevels
        .map((lvl: any) => ({
          id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
          label: String(lvl?.label ?? "").trim(),
          description: String(lvl?.description ?? "").trim(),
        }))
        .filter((lvl: any) => lvl.label || lvl.description)
        .slice(0, 8);
      return { id, type, visible: true, props: { shape, direction, levels } };
    }
    default:
      return {
        id,
        type: "paragraph",
        visible: true,
        props: { text: String(props.text ?? block?.text ?? "").trim() },
      };
  }
}

function normalizeLessons(payload: any, fallbackTitle: string, mode: "single" | "split") {
  const lessons = Array.isArray(payload?.lessons) ? payload.lessons : [];

  const normalized = lessons
    .map((lesson: any, index: number) => ({
      title:
        String(lesson?.title ?? `${fallbackTitle} ${index + 1}`).trim().slice(0, 200) ||
        `${fallbackTitle} ${index + 1}`,
      blocks: Array.isArray(lesson?.blocks)
        ? lesson.blocks
            .map(normalizeBlock)
            .filter((block: any) => {
              if (["heading", "paragraph", "quote", "callout"].includes(block.type)) {
                return Boolean(String(block.props.text ?? "").trim());
              }
              if (block.type === "bullet_list") return block.props.items.length > 0;
              if (block.type === "table") return block.props.headers.length > 0 || block.props.rows.length > 0;
              if (block.type === "hierarchy") return Array.isArray(block.props.levels) && block.props.levels.length >= 2;
              return true;
            })
        : [],
    }))
    .filter((lesson: any) => lesson.blocks.length > 0);

  if (mode === "single" && normalized.length > 1) {
    return [{ title: fallbackTitle, blocks: normalized.flatMap((lesson: any) => lesson.blocks) }];
  }

  return normalized;
}

const RASTER_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const VECTOR_SKIP_EXT = new Set(["emf", "wmf"]);
const PER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function mimeForExt(ext: string): string {
  switch (ext) {
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    default: return "image/jpeg";
  }
}

async function extractZipMedia(bytes: Uint8Array, prefix: "word/media/" | "ppt/media/") {
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const unzipped = unzipSync(bytes);
  const images: { fileName: string; ext: string; data: Uint8Array }[] = [];
  let skipped = 0;

  for (const name of Object.keys(unzipped)) {
    if (!name.startsWith(prefix)) continue;
    const base = name.split("/").pop() || name;
    const ext = (base.split(".").pop() || "").toLowerCase();
    if (VECTOR_SKIP_EXT.has(ext)) { skipped++; continue; }
    if (!RASTER_EXT.has(ext)) continue;
    const data = unzipped[name];
    if (!data || data.byteLength === 0) continue;
    if (data.byteLength > PER_IMAGE_MAX_BYTES) { skipped++; continue; }
    images.push({ fileName: base, ext, data });
  }
  return { images, skipped };
}

async function uploadMediaToStorage(
  serviceRoleClient: ReturnType<typeof createClient>,
  folder: string,
  files: { fileName: string; ext: string; data: Uint8Array }[],
): Promise<{ urls: string[]; byFileName: Map<string, string> }> {
  const urls: string[] = [];
  const byFileName = new Map<string, string>();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const path = `${folder}/${i + 1}-${f.fileName}`.replace(/\s+/g, "-");
    const { error } = await serviceRoleClient.storage
      .from("lesson-images")
      .upload(path, f.data, { contentType: mimeForExt(f.ext), upsert: true });
    if (error) {
      console.warn("Media upload failed:", path, error.message);
      continue;
    }
    const { data } = serviceRoleClient.storage.from("lesson-images").getPublicUrl(path);
    if (data?.publicUrl) {
      urls.push(data.publicUrl);
      byFileName.set(f.fileName, data.publicUrl);
    }
  }
  return { urls, byFileName };
}

const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

function extractPptxLinkedShapes(bytes: Uint8Array, unzipped: Record<string, Uint8Array>): {
  youtube: { url: string; mediaFileName?: string }[];
  other: { url: string; mediaFileName?: string }[];
} {
  const youtube: { url: string; mediaFileName?: string }[] = [];
  const other: { url: string; mediaFileName?: string }[] = [];
  const slideFiles = Object.keys(unzipped).filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n));
  for (const slidePath of slideFiles) {
    const num = slidePath.match(/slide(\d+)\.xml$/)?.[1];
    if (!num) continue;
    const relsData = unzipped[`ppt/slides/_rels/slide${num}.xml.rels`];
    if (!relsData) continue;
    const relsXml = textDecoder.decode(relsData);
    const relMap = new Map<string, { target: string; mode?: string }>();
    for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const tag = m[0];
      const id = tag.match(/Id="([^"]+)"/)?.[1];
      const target = tag.match(/Target="([^"]+)"/)?.[1];
      const mode = tag.match(/TargetMode="([^"]+)"/)?.[1];
      if (id && target) relMap.set(id, { target, mode });
    }
    const slideXml = textDecoder.decode(unzipped[slidePath]);
    const shapeRegex = /<p:(?:pic|sp)\b[\s\S]*?<\/p:(?:pic|sp)>/g;
    for (const sm of slideXml.matchAll(shapeRegex)) {
      const shapeXml = sm[0];
      const hlinkId = shapeXml.match(/<a:hlinkClick\b[^>]*\sr:id="([^"]+)"/)?.[1];
      if (!hlinkId) continue;
      const rel = relMap.get(hlinkId);
      if (!rel?.target || rel.mode !== "External") continue;
      const url = rel.target;
      const embedId = shapeXml.match(/<a:blip\b[^>]*\sr:embed="([^"]+)"/)?.[1];
      let mediaFileName: string | undefined;
      if (embedId) {
        const mediaRel = relMap.get(embedId);
        if (mediaRel?.target) mediaFileName = mediaRel.target.split("/").pop();
      }
      if (YOUTUBE_RE.test(url)) youtube.push({ url, mediaFileName });
      else other.push({ url, mediaFileName });
    }
  }
  return { youtube, other };
}

// Map slideNumber -> media file names for ALL <a:blip r:embed="..."> images on that slide.
function extractPptxImagesBySlide(unzipped: Record<string, Uint8Array>): Map<number, string[]> {
  const bySlide = new Map<number, string[]>();
  const slideFiles = Object.keys(unzipped).filter((n) => /ppt\/slides\/slide\d+\.xml$/.test(n));
  for (const slidePath of slideFiles) {
    const num = Number(slidePath.match(/slide(\d+)\.xml$/)?.[1]);
    if (!num) continue;
    const relsData = unzipped[`ppt/slides/_rels/slide${num}.xml.rels`];
    if (!relsData) continue;
    const relsXml = textDecoder.decode(relsData);
    const relMap = new Map<string, string>();
    for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const tag = m[0];
      const id = tag.match(/Id="([^"]+)"/)?.[1];
      const target = tag.match(/Target="([^"]+)"/)?.[1];
      if (id && target) relMap.set(id, target);
    }
    const slideXml = textDecoder.decode(unzipped[slidePath]);
    const seen: string[] = [];
    for (const bm of slideXml.matchAll(/<a:blip\b[^>]*\sr:embed="([^"]+)"/g)) {
      const target = relMap.get(bm[1]);
      if (!target) continue;
      const fileName = target.split("/").pop();
      if (fileName && !seen.includes(fileName)) seen.push(fileName);
    }
    if (seen.length > 0) bySlide.set(num, seen);
  }
  return bySlide;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { fileBase64, fileName, mimeType, mode, extractedText } = await req.json();
    if (!fileName) {
      return jsonResponse({ error: "Missing fileName" }, 400);
    }
    if (!fileBase64 && !extractedText) {
      return jsonResponse({ error: "Missing fileBase64 or extractedText" }, 400);
    }

    const effectiveMode = mode === "split" ? "split" : "single";
    const cleanMimeType = typeof mimeType === "string" && mimeType ? mimeType : "application/pdf";

    if (fileBase64) {
      const approxBytes = Math.ceil(String(fileBase64).length * 0.75);
      if (approxBytes > MAX_BASE64_BYTES) {
        return jsonResponse({ error: "Soubor je příliš velký. Limit je 25 MB." }, 400);
      }
    }

    const baseTitle = String(fileName).replace(/\.[^.]+$/, "").trim() || "Importovaná lekce";

    let aiResult: any;

    // Priority 1: extractedText provided by frontend (most reliable, no hallucinations)
    if (typeof extractedText === "string" && extractedText.trim().length >= 50) {
      aiResult = await callGatewayWithText(LOVABLE_API_KEY, {
        extractedText: extractedText.trim(),
        fileName: String(fileName),
        mimeType: cleanMimeType,
        mode: effectiveMode,
      });
    } else {
      // Priority 2: try AI with the raw file (PDF/image multimodal)
      try {
        aiResult = await callGatewayWithFile(LOVABLE_API_KEY, {
          fileBase64: String(fileBase64),
          fileName: String(fileName),
          mimeType: cleanMimeType,
          mode: effectiveMode,
        });
      } catch (fileError) {
        console.error("File mode failed, trying server-side extraction fallback:", fileError);

        const lower = String(fileName).toLowerCase();
        const bytes = decodeBase64(String(fileBase64));
        let fallbackText = "";

        if (lower.endsWith(".docx")) {
          fallbackText = await extractDocxText(bytes);
        } else if (lower.endsWith(".pptx")) {
          fallbackText = await extractPptxText(bytes);
        }

        if (!fallbackText || fallbackText.length < 50) {
          throw fileError instanceof Error
            ? fileError
            : new Error("AI nedokázala přečíst dokument. Zkopírujte text ručně do textového pole.");
        }

        aiResult = await callGatewayWithText(LOVABLE_API_KEY, {
          extractedText: fallbackText,
          fileName: String(fileName),
          mimeType: cleanMimeType,
          mode: effectiveMode,
        });
      }
    }

    const parsed = ensureToolArguments(aiResult);
    const lessons = normalizeLessons(parsed, baseTitle, effectiveMode);
    const blocks = lessons.flatMap((lesson: any) => lesson.blocks);

    if (blocks.length === 0) {
      throw new Error("AI nedokázala z dokumentu vytvořit žádné bloky.");
    }

    // Best-effort embedded-image extraction for DOCX/PPTX zip archives.
    // PDF embedded images are extracted on the frontend (pdfjs).
    let embeddedImages: string[] = [];
    let skippedImages = 0;
    const linkedBlocks: any[] = [];
    let embeddedImagesBySlide: { slideNumber: number; urls: string[] }[] = [];
    if (fileBase64) {
      const lower = String(fileName).toLowerCase();
      const prefix = lower.endsWith(".docx")
        ? "word/media/"
        : lower.endsWith(".pptx")
          ? "ppt/media/"
          : null;
      if (prefix) {
        try {
          const bytes = decodeBase64(String(fileBase64));
          const { images, skipped } = await extractZipMedia(bytes, prefix);
          skippedImages = skipped;

          // For PPTX: detect shapes with external hyperlinks (esp. YouTube)
          // and map every embedded image to its slide.
          let pptxLinks: { youtube: { url: string; mediaFileName?: string }[]; other: { url: string; mediaFileName?: string }[] } | null = null;
          let pptxImagesBySlide: Map<number, string[]> | null = null;
          if (lower.endsWith(".pptx")) {
            try {
              const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
              const unzipped = unzipSync(bytes);
              pptxLinks = extractPptxLinkedShapes(bytes, unzipped);
              pptxImagesBySlide = extractPptxImagesBySlide(unzipped);
            } catch (linkErr) {
              console.warn("PPTX slide/hyperlink extraction failed (non-fatal):", linkErr);
            }
          }

          let byFileName = new Map<string, string>();
          if (images.length > 0) {
            const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
            const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
            if (SUPABASE_URL && SERVICE_ROLE) {
              const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
              const folder = `import-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
              const uploaded = await uploadMediaToStorage(admin, folder, images);
              embeddedImages = uploaded.urls;
              byFileName = uploaded.byFileName;
            }
          }

          // Build hyperlink blocks and remove their thumbnails from the
          // generic embedded-image pool so we don't render them twice.
          const consumed = new Set<string>();
          if (pptxLinks) {
            for (const yt of pptxLinks.youtube) {
              linkedBlocks.push({
                id: crypto.randomUUID(),
                type: "youtube",
                visible: true,
                props: { url: yt.url, caption: "", width: "full" },
              });
              if (yt.mediaFileName) {
                const url = byFileName.get(yt.mediaFileName);
                if (url) consumed.add(url);
              }
            }
            for (const link of pptxLinks.other) {
              const imageUrl = link.mediaFileName ? byFileName.get(link.mediaFileName) : undefined;
              if (imageUrl) {
                linkedBlocks.push({
                  id: crypto.randomUUID(),
                  type: "image",
                  visible: true,
                  props: { url: imageUrl, caption: link.url, width: "full", alignment: "center" },
                });
                consumed.add(imageUrl);
              } else {
                linkedBlocks.push({
                  id: crypto.randomUUID(),
                  type: "paragraph",
                  visible: true,
                  props: { text: `Odkaz: ${link.url}` },
                });
              }
            }
            if (consumed.size > 0) {
              embeddedImages = embeddedImages.filter((u) => !consumed.has(u));
            }
          }

          // Resolve slide->URL map, excluding thumbnails consumed by linkedBlocks.
          if (pptxImagesBySlide) {
            const out: { slideNumber: number; urls: string[] }[] = [];
            const sorted = [...pptxImagesBySlide.entries()].sort((a, b) => a[0] - b[0]);
            for (const [slideNumber, fileNames] of sorted) {
              const urls: string[] = [];
              for (const fn of fileNames) {
                const url = byFileName.get(fn);
                if (url && !consumed.has(url)) urls.push(url);
              }
              if (urls.length > 0) out.push({ slideNumber, urls });
            }
            embeddedImagesBySlide = out;
          }
        } catch (mediaErr) {
          console.warn("Embedded media extraction failed (non-fatal):", mediaErr);
        }
      }
    }

    return jsonResponse({ lessons, blocks, blockCount: blocks.length, embeddedImages, embeddedImagesBySlide, skippedImages, linkedBlocks });
  } catch (err) {
    console.error("process-file-content error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Neznámá chyba" }, 500);
  }
});
