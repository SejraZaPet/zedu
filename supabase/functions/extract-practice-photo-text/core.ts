import { PRACTICE_AI_MODEL } from "../_shared/practice-ai-model.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@^4.4.3";

export const PRACTICE_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PRACTICE_PHOTO_MAX_BASE64_CHARS = 4 * Math.ceil(PRACTICE_PHOTO_MAX_BYTES / 3);
export const PRACTICE_PHOTO_MAX_TEXT_CHARS = 12_000;
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
  fetchImpl?: typeof fetch;
  apiKey?: string;
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

function unreadable(status = 422): Response {
  return json({ error: "UNREADABLE_PHOTO", message: UNREADABLE_PHOTO_MESSAGE }, status);
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

  const apiKey = deps.apiKey ?? Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI není nakonfigurovaná." }, 500);

  try {
    const response = await (deps.fetchImpl ?? fetch)(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
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
          max_tokens: 4000,
        }),
      },
    );

    if (!response.ok) {
      await response.text(); // vždy spotřebovat tělo; obsah chyby nelogovat ani nepřeposílat
      if (response.status === 402) return json({ error: "Vyčerpané kredity Lovable AI." }, 402);
      if (response.status === 429) return json({ error: "Služba AI je právě přetížená. Zkus to znovu za chvíli." }, 429);
      if (response.status === 403) return json({ error: "AI zpracování fotky není pro tento účet dostupné." }, 403);
      if (response.status === 400) return json({ error: "Fotku se nepodařilo zpracovat. Zkus menší JPEG." }, 400);
      if (response.status === 401) return json({ error: "AI není správně nakonfigurovaná." }, 500);
      return json({ error: "AI teď neodpovídá. Zkus to za chvíli." }, 502);
    }

    const aiResult = await response.json();
    const args = aiResult?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (typeof args !== "string") return unreadable();
    let transcription: unknown;
    try {
      transcription = JSON.parse(args);
    } catch {
      return unreadable();
    }
    const rawText = (transcription as { text?: unknown })?.text;
    if (typeof rawText !== "string") return unreadable();
    const text = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text || text.length > PRACTICE_PHOTO_MAX_TEXT_CHARS) return unreadable();
    if (text.length < PRACTICE_PHOTO_MIN_TEXT_CHARS) {
      return json({ error: "INSUFFICIENT_TEXT", message: `Text je moc krátký. Potřebuju aspoň ${PRACTICE_PHOTO_MIN_TEXT_CHARS} znaků.` }, 422);
    }
    return json({ text });
  } catch {
    // Bez logování vstupu, výstupu i těla chyby: fotka ani přepis se nesmí dostat do logů.
    return json({ error: "AI teď neodpovídá. Zkus to za chvíli." }, 502);
  }
}

