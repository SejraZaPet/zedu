import { PRACTICE_AI_MODEL } from "../_shared/practice-ai-model.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@^4.4.3";
import { generateChatCompletion, GatewayError, type GeminiChatFields } from "npm:@lovable.dev/ai-gateway@0.1.15";
import type {} from "./generated/models.d.ts";

export const PRACTICE_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PRACTICE_PHOTO_MAX_BASE64_CHARS = 4 * Math.ceil(PRACTICE_PHOTO_MAX_BYTES / 3);
export const PRACTICE_PHOTO_MAX_TEXT_CHARS = 20_000;
export const PRACTICE_PHOTO_MIN_TEXT_CHARS = 150;
export const UNREADABLE_PHOTO_MESSAGE =
  "Text se nepodařilo spolehlivě přečíst. Vyfot stránku znovu ostřeji a při lepším světle, nebo text opiš ručně.";

const BodySchema = z.object({
  imageBase64: z.string().min(1).max(PRACTICE_PHOTO_MAX_BASE64_CHARS)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Neplatný formát base64"),
  mimeType: z.literal("image/jpeg"),
}).strict();

const TRANSCRIBE_TOOL = {
  type: "function",
  function: {
    name: "transcribe_photo",
    description: "Doslovně přepíše text viditelný na jedné fotografii stránky.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Pouze doslovně přepsaný text, bez komentáře a úprav." },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
};

type AuthSuccess = { ok: true; userId: string; isServiceRole: boolean; authHeader: string };
type AuthResult = AuthSuccess | { ok: false; status: number; body: { error: string } };
type Dependencies = {
  auth: (req: Request) => Promise<AuthResult>;
  demoGuard: (auth: AuthSuccess, functionName: string) => Promise<Response | null>;
  generate?: (payload: GeminiChatFields & { model: typeof PRACTICE_AI_MODEL }) => Promise<{
    choices?: { finish_reason?: string | null; message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  }>;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodedBase64Bytes(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}

function unreadable(reason: string): Response {
  console.warn("[photo-ocr]", { code: "UNREADABLE_PHOTO", reason });
  return json({ error: "UNREADABLE_PHOTO", message: UNREADABLE_PHOTO_MESSAGE }, 422);
}

function tooLong(reason: string): Response {
  console.warn("[photo-ocr]", { code: "PHOTO_TEXT_TOO_LONG", reason });
  return json({ error: "PHOTO_TEXT_TOO_LONG", message: "Na fotce je moc textu, vyfoť jen část nebo ji rozděl na více fotek." }, 422);
}

export async function handleExtractPracticePhotoText(req: Request, deps: Dependencies): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await deps.auth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return json({ error: "Neplatné JSON tělo požadavku." }, 400);
  }
  const parsed = BodySchema.safeParse(input);
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  if (decodedBase64Bytes(parsed.data.imageBase64) > PRACTICE_PHOTO_MAX_BYTES) {
    return json({ error: "Fotka je větší než 4 MB. Zmenši ji a zkus to znovu." }, 400);
  }

  // Rezervace demo limitu proběhne před jakýmkoli voláním AI; obsah se do DB neukládá.
  const demoBlock = await deps.demoGuard(auth, "extract-practice-photo-text");
  if (demoBlock) return demoBlock;

  try {
    const aiResult = await (deps.generate ?? ((payload) => generateChatCompletion(payload, { maxRetries: 0 })))({
          model: PRACTICE_AI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Jsi přesný přepisovatel fotografií školních materiálů. Přepiš pouze skutečně viditelný text, doslovně a v původním pořadí. Zachovej odstavce a odrážky. Nic neshrnuj, nedoplňuj a nehádej. Nečitelná místa označ [nečitelné]. Pokud text nejde spolehlivě přečíst, vrať prázdný text.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Přepiš text z této jedné fotografie. Nevrať žádný komentář." },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${parsed.data.imageBase64}` },
                },
              ],
            },
          ],
          tools: [TRANSCRIBE_TOOL],
          tool_choice: { type: "function", function: { name: "transcribe_photo" } },
          temperature: 0,
          max_tokens: 16000,
    });
    if (aiResult?.choices?.[0]?.finish_reason === "length") return tooLong("output_token_limit");
    const toolCall = aiResult?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall && "function" in toolCall ? toolCall.function?.arguments : undefined;
    if (typeof args !== "string") return unreadable("missing_tool_arguments");
    let transcription: unknown;
    try {
      transcription = JSON.parse(args);
    } catch {
      return unreadable("invalid_tool_json");
    }
    const rawText = (transcription as { text?: unknown })?.text;
    if (typeof rawText !== "string") return unreadable("missing_text");
    const text = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return unreadable("empty_text");
    if (text.length > PRACTICE_PHOTO_MAX_TEXT_CHARS) return tooLong("text_character_limit");
    if (text.length < PRACTICE_PHOTO_MIN_TEXT_CHARS) {
      console.warn("[photo-ocr]", { code: "INSUFFICIENT_TEXT", reason: "below_minimum" });
      return json({ error: "INSUFFICIENT_TEXT", message: `Text je moc krátký. Potřebuju aspoň ${PRACTICE_PHOTO_MIN_TEXT_CHARS} znaků.` }, 422);
    }
    return json({ text });
  } catch (error) {
    const status = error instanceof GatewayError ? error.httpStatus : undefined;
    console.warn("[photo-ocr]", { code: error instanceof GatewayError ? error.code : "AI_FAILED", reason: "gateway_failure", status });
    if (status === 402) return json({ error: "AI_PAYMENT_REQUIRED", message: "AI nemá dostatek kreditu. Požádejte správce o doplnění nebo text vložte ručně." }, 402);
    if (status === 429) return json({ error: "AI_RATE_LIMITED", message: "AI je právě přetížená. Zkus to znovu za chvíli." }, 429);
    if (status === 403) return json({ error: "AI zpracování fotky není pro tento účet dostupné." }, 403);
    if (status === 400) return json({ error: "Fotku se nepodařilo zpracovat. Zkus menší JPEG." }, 400);
    // Bez logování vstupu, výstupu i těla chyby: fotka ani přepis se nesmí dostat do logů.
    return json({ error: "AI teď neodpovídá. Zkus to za chvíli." }, 502);
  }
}

