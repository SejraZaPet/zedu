import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
                      enum: ["heading", "paragraph", "bullet_list", "table", "callout", "quote", "divider"],
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
Dostaneš PDF, DOCX nebo PPTX a musíš převést VEŠKERÝ textový obsah do editovatelných bloků.

PRAVIDLA:
- Zachovej veškerý text, nic nevynechávej.
- Každý slide nebo stránku odděl blokem divider.
- Hlavní nadpisy používej jako heading s level 2.
- Podnadpisy používej jako heading s level 3.
- Běžný text převáděj na paragraph.
- Odrážkové i číslované seznamy převáděj na bullet_list s props.items.
- Tabulky převáděj na table s props.headers a props.rows.
- Důležitá upozornění můžeš převést na callout s props.calloutType = "note".
- Citace převáděj na quote.
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
  return paragraphs.join("
");
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
    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((m) => stripXml(m[1]))
      .filter(Boolean);
    if (texts.length > 0) {
      slides.push(`--- Slide ---
${texts.join("
")}`);
    }
  }

  return slides.join("

");
}

async function callGatewayWithFile(apiKey: string, body: { fileBase64: string; fileName: string; mimeType: string; mode: "single" | "split" }) {
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
              type: "file",
              file: {
                filename: body.fileName,
                content_type: body.mimeType || "application/pdf",
                data: body.fileBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
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

async function callGatewayWithText(apiKey: string, payload: { extractedText: string; fileName: string; mimeType: string; mode: "single" | "split" }) {
  const userPrompt = `Soubor: ${payload.fileName}
MIME: ${payload.mimeType}
Režim: ${payload.mode}

OBSAH DOKUMENTU:
${payload.extractedText}`;

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
      return { id, type, visible: true, props: { text: String(props.text ?? "").trim(), level: props.level === 3 ? 3 : 2 } };
    case "bullet_list":
      return {
        id,
        type,
        visible: true,
        props: { items: Array.isArray(props.items) ? props.items.map((item: unknown) => String(item).trim()).filter(Boolean) : [] },
      };
    case "table":
      return {
        id,
        type,
        visible: true,
        props: {
          headers: Array.isArray(props.headers) ? props.headers.map((item: unknown) => String(item)) : [],
          rows: Array.isArray(props.rows)
            ? props.rows.map((row: unknown) => Array.isArray(row) ? row.map((cell: unknown) => String(cell)) : [])
            : [],
        },
      };
    case "callout":
      return { id, type, visible: true, props: { text: String(props.text ?? "").trim(), calloutType: "note" } };
    case "quote":
      return { id, type, visible: true, props: { text: String(props.text ?? "").trim(), author: String(props.author ?? "") } };
    case "divider":
      return { id, type, visible: true, props: { style: "line" } };
    default:
      return { id, type: "paragraph", visible: true, props: { text: String(props.text ?? block?.text ?? "").trim() } };
  }
}

function normalizeLessons(payload: any, fallbackTitle: string, mode: "single" | "split") {
  const lessons = Array.isArray(payload?.lessons) ? payload.lessons : [];
  const normalized = lessons
    .map((lesson: any, index: number) => ({
      title: String(lesson?.title ?? `${fallbackTitle} ${index + 1}`).trim().slice(0, 200) || `${fallbackTitle} ${index + 1}`,
      blocks: Array.isArray(lesson?.blocks) ? lesson.blocks.map(normalizeBlock).filter((block: any) => {
        if (block.type === "heading" || block.type === "paragraph" || block.type === "quote" || block.type === "callout") {
          return Boolean(String(block.props.text ?? "").trim());
        }
        if (block.type === "bullet_list") return block.props.items.length > 0;
        if (block.type === "table") return block.props.headers.length > 0 || block.props.rows.length > 0;
        return true;
      }) : [],
    }))
    .filter((lesson: any) => lesson.blocks.length > 0);

  if (mode === "single" && normalized.length > 1) {
    return [{
      title: fallbackTitle,
      blocks: normalized.flatMap((lesson: any) => lesson.blocks),
    }];
  }

  return normalized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { fileBase64, fileName, mimeType, mode } = await req.json();
    if (!fileBase64 || !fileName) {
      return jsonResponse({ error: "Missing fileBase64 or fileName" }, 400);
    }

    const effectiveMode = mode === "split" ? "split" : "single";
    const cleanMimeType = typeof mimeType === "string" && mimeType ? mimeType : "application/pdf";
    const approxBytes = Math.ceil(String(fileBase64).length * 0.75);
    if (approxBytes > MAX_BASE64_BYTES) {
      return jsonResponse({ error: "Soubor je příliš velký. Limit je 25 MB." }, 400);
    }

    const baseTitle = String(fileName).replace(/\.[^.]+$/, "").trim() || "Importovaná lekce";

    let aiResult: any;
    try {
      aiResult = await callGatewayWithFile(LOVABLE_API_KEY, {
        fileBase64: String(fileBase64),
        fileName: String(fileName),
        mimeType: cleanMimeType,
        mode: effectiveMode,
      });
    } catch (fileError) {
      console.error("File mode failed, trying fallback:", fileError);
      const lower = String(fileName).toLowerCase();
      const bytes = decodeBase64(String(fileBase64));
      let extractedText = "";

      if (lower.endsWith(".docx")) {
        extractedText = await extractDocxText(bytes);
      } else if (lower.endsWith(".pptx")) {
        extractedText = await extractPptxText(bytes);
      } else if (lower.endsWith(".pdf")) {
        extractedText = "[PDF soubor - fallback neumí extrakci bez nativní podpory dokumentů v AI. Zkuste znovu kratší dokument nebo ověřte AI file input.]";
      }

      if (!extractedText || extractedText.length < 50) {
        throw fileError instanceof Error ? fileError : new Error("AI nepodporuje přímé čtení tohoto souboru.");
      }

      aiResult = await callGatewayWithText(LOVABLE_API_KEY, {
        extractedText,
        fileName: String(fileName),
        mimeType: cleanMimeType,
        mode: effectiveMode,
      });
    }

    const parsed = ensureToolArguments(aiResult);
    const lessons = normalizeLessons(parsed, baseTitle, effectiveMode);
    const blocks = lessons.flatMap((lesson: any) => lesson.blocks);

    if (blocks.length === 0) {
      throw new Error("AI nedokázala z dokumentu vytvořit žádné bloky.");
    }

    return jsonResponse({
      lessons,
      blocks,
      blockCount: blocks.length,
    });
  } catch (err) {
    console.error("process-file-content error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Neznámá chyba" }, 500);
  }
});
