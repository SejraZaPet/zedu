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
const MAX_TEXT_CHARS = 60_000;

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
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
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
    // Concatenate all <a:t>…</a:t> runs.
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

const SYSTEM_PROMPT = `Jsi asistent pro tvorbu výukových materiálů. Z dodaného textu vytvoř návrh strukturovaných lekcí pro online učebnici.

Vrať JSON s polem "lessons". Každá lekce má:
- title: krátký výstižný název v češtině
- blocks: pole bloků v pořadí, jak mají jít po sobě

Povolené typy bloků (přesně tyto názvy):
- { "type": "heading", "props": { "level": 2|3, "text": "..." } }
- { "type": "paragraph", "props": { "text": "..." } }
- { "type": "bullet_list", "props": { "items": ["...", "..."] } }
- { "type": "callout", "props": { "title": "...", "text": "...", "variant": "info" } }
- { "type": "quote", "props": { "text": "...", "author": "..." } }
- { "type": "activity", "props": { "title": "Cvičení", "instructions": "..." } }

Pravidla:
- 1–6 lekcí podle délky textu (cca 800–2500 znaků na lekci).
- Každá lekce začíná blokem "heading" s level 2.
- Rozdělej dlouhé odstavce; používej odrážky a callouty pro důležité poznámky.
- Cvičení vlož pouze pokud zdroj obsahuje úkol nebo otázky.
- Žádný markdown, žádné HTML uvnitř textu.
- Piš formálně (vykání) — pro učitele jako autora.`;

async function callAi(text: string): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const truncated = text.length > MAX_TEXT_CHARS
    ? text.slice(0, MAX_TEXT_CHARS) + "\n\n[…text zkrácen…]"
    : text;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Zde je text k zpracování:\n\n${truncated}` },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonResponse({ error: "Invalid JSON" }, 400);

    const { fileBase64, filename, mimeType } = body as {
      fileBase64?: string;
      filename?: string;
      mimeType?: string;
    };

    if (!fileBase64 || !filename) {
      return jsonResponse({ error: "Chybí fileBase64 nebo filename" }, 400);
    }

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

    text = text.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[ \t]+/g, " ").trim();
    if (text.length < 50) {
      return jsonResponse({ error: "Z dokumentu se nepodařilo získat dostatek textu." }, 400);
    }

    const ai = await callAi(text);
    const lessons = (ai.lessons ?? []).map((l: any) => ({
      title: String(l.title ?? "Bez názvu").slice(0, 200),
      blocks: normalizeBlocks(l.blocks ?? []),
    }));

    if (lessons.length === 0) {
      return jsonResponse({ error: "AI nevytvořila žádné lekce." }, 422);
    }

    return jsonResponse({
      lessons,
      stats: { textChars: text.length, lessons: lessons.length },
    });
  } catch (err: any) {
    console.error("import-textbook-file error", err);
    return jsonResponse({ error: err?.message ?? "Neznámá chyba" }, 500);
  }
});
