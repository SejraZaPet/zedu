// Import textbook file: extract text from PDF/DOCX/PPTX and turn it into block-structured lessons via Lovable AI.
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import mammoth from "npm:mammoth@1.8.0";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_TEXT_CHARS = 120_000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function extractFromPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  if (Array.isArray(text)) {
    return text.map((t, i) => `--- Strana ${i + 1} ---\n${t}`).join("\n\n");
  }
  return String(text ?? "");
}

async function extractFromDocx(bytes: Uint8Array): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value ?? "";
}

async function extractFromPptx(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
      return na - nb;
    });

  const out: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
    const text = matches
      .map((m) => m.replace(/<[^>]+>/g, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.push(`--- Slide ${i + 1} ---\n${text}`);
  }
  return out.join("\n\n");
}

const SYSTEM_PROMPT_SPLIT = `Jsi asistent pro tvorbu výukových materiálů. Z dodaného textu vytvoř návrh strukturovaných lekcí pro online učebnici.

Vrať JSON s polem "lessons". Každá lekce má:
- title: krátký výstižný název v češtině
- blocks: pole bloků v pořadí, jak mají jít po sobě

Povolené typy bloků (přesně tyto názvy):
- { "type": "heading", "props": { "level": 2|3, "text": "..." } }
- { "type": "paragraph", "props": { "text": "..." } }
- { "type": "bullet_list", "props": { "items": ["...", "..."] } }
- { "type": "table", "props": { "headers": ["...","..."], "rows": [["...","..."]] } }
- { "type": "callout", "props": { "title": "...", "text": "...", "variant": "info" } }
- { "type": "quote", "props": { "text": "...", "author": "..." } }
- { "type": "activity", "props": { "title": "Cvičení", "instructions": "..." } }

Pravidla:
- 1–6 lekcí podle délky textu (cca 800–2500 znaků na lekci).
- Každá lekce začíná blokem "heading" s level 2.
- Rozdělej dlouhé odstavce; používej odrážky a callouty pro důležité poznámky.
- Žádný markdown, žádné HTML uvnitř textu.
- Piš formálně (vykání).`;

const SYSTEM_PROMPT_SINGLE = `Jsi asistent pro tvorbu výukových materiálů. Z dodaného textu (typicky stránky PDF/PPTX prezentace) vytvoř JEDNU lekci jako strukturované bloky pro online učebnici.

Vrať JSON s polem "lessons" obsahujícím právě JEDNU lekci. Lekce má:
- title: krátký výstižný název v češtině (odvoď z obsahu)
- blocks: pole bloků v pořadí přesně podle stránek vstupu

Povolené typy bloků (přesně tyto názvy):
- { "type": "heading", "props": { "level": 2|3, "text": "..." } }
- { "type": "paragraph", "props": { "text": "..." } }
- { "type": "bullet_list", "props": { "items": ["...", "..."] } }
- { "type": "table", "props": { "headers": ["...","..."], "rows": [["...","..."]] } }
- { "type": "callout", "props": { "title": "...", "text": "...", "variant": "info" } }
- { "type": "quote", "props": { "text": "...", "author": "..." } }

KRITICKÁ pravidla:
- Vytvoř PRÁVĚ JEDNU lekci, NIKDY víc.
- Zachovej VEŠKERÝ obsah ze vstupu — nadpisy, odstavce, seznamy, tabulky. Nic nezkracuj, neshrnuj, nevynechávej.
- Zachovej pořadí podle stránek/slidů. Každá stránka = jeden nebo více bloků za sebou.
- Pro každou stránku/slide začni blokem heading s level 2 nebo 3 (název stránky / hlavní téma stránky).
- Odrážky převeď na bullet_list, tabulky na table.
- Žádný markdown, žádné HTML uvnitř textu.
- Piš formálně (vykání).`;

async function callAi(text: string, mode: "single" | "split", baseTitle: string): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const truncated = text.length > MAX_TEXT_CHARS
    ? text.slice(0, MAX_TEXT_CHARS) + "\n\n[…text zkrácen…]"
    : text;

  const systemPrompt = mode === "single" ? SYSTEM_PROMPT_SINGLE : SYSTEM_PROMPT_SPLIT;
  const userPrompt = mode === "single"
    ? `Název souboru: "${baseTitle}". Zde je text k zpracování (rozdělený podle stránek/slidů):\n\n${truncated}`
    : `Zde je text k zpracování:\n\n${truncated}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "create_lessons",
            description: "Návrh lekcí složených z bloků",
            parameters: {
              type: "object",
              properties: {
                lessons: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      blocks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            props: { type: "object", additionalProperties: true },
                          },
                          required: ["type", "props"],
                        },
                      },
                    },
                    required: ["title", "blocks"],
                  },
                },
              },
              required: ["lessons"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "create_lessons" } },
    }),
  });

  if (res.status === 429) throw new Error("Překročen limit AI – zkuste to znovu za chvíli.");
  if (res.status === 402) throw new Error("Vyčerpán AI kredit. Doplňte ho v Lovable.");
  if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI nevrátila strukturovaný výstup.");
  return JSON.parse(call.function.arguments);
}

const ALLOWED_TYPES = new Set([
  "heading",
  "paragraph",
  "bullet_list",
  "table",
  "callout",
  "quote",
  "activity",
]);

function normalizeBlocks(raw: any[]): any[] {
  return (raw ?? [])
    .filter((b) => b && ALLOWED_TYPES.has(b.type))
    .map((b) => ({
      id: crypto.randomUUID(),
      type: b.type,
      visible: true,
      props: b.props ?? {},
    }));
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Importovaná lekce";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonResponse({ error: "Invalid JSON" }, 400);

    const { fileBase64, filename, mimeType, mode } = body as {
      fileBase64?: string;
      filename?: string;
      mimeType?: string;
      mode?: "single" | "split";
    };

    if (!fileBase64 || !filename) {
      return jsonResponse({ error: "Chybí fileBase64 nebo filename" }, 400);
    }

    const effectiveMode: "single" | "split" = mode === "split" ? "split" : "single";

    const bytes = decodeBase64(fileBase64);
    if (bytes.byteLength > MAX_BYTES) {
      return jsonResponse({ error: "Soubor je příliš velký (max 15 MB)." }, 400);
    }

    const lower = filename.toLowerCase();
    let text = "";
    if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
      text = await extractFromPdf(bytes);
    } else if (
      lower.endsWith(".docx") ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await extractFromDocx(bytes);
    } else if (
      lower.endsWith(".pptx") ||
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      text = await extractFromPptx(bytes);
    } else {
      return jsonResponse({ error: "Nepodporovaný formát. Podporuje: PDF, DOCX, PPTX." }, 400);
    }

    text = text.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === "\n" ? "\n" : " "))
      .replace(/[ \t]+/g, " ")
      .trim();
    if (text.length < 50) {
      return jsonResponse({ error: "Z dokumentu se nepodařilo získat dostatek textu." }, 400);
    }

    const baseTitle = stripExt(filename);
    const ai = await callAi(text, effectiveMode, baseTitle);
    let lessons = (ai.lessons ?? []).map((l: any) => ({
      title: String(l.title ?? "Bez názvu").slice(0, 200),
      blocks: normalizeBlocks(l.blocks ?? []),
    }));

    if (effectiveMode === "single") {
      // Sloučit do jedné lekce, použít název souboru
      const allBlocks = lessons.flatMap((l: any) => l.blocks);
      lessons = [{ title: baseTitle.slice(0, 200), blocks: allBlocks }];
    }

    if (lessons.length === 0 || lessons[0].blocks.length === 0) {
      return jsonResponse({ error: "AI nevytvořila žádné lekce." }, 422);
    }

    return jsonResponse({
      lessons,
      stats: { textChars: text.length, lessons: lessons.length, mode: effectiveMode },
    });
  } catch (err: any) {
    console.error("import-textbook-file error", err);
    return jsonResponse({ error: err?.message ?? "Neznámá chyba" }, 500);
  }
});
