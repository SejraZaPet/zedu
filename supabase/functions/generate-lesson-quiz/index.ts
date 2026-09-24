import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

/** Z textu lekce vytvoří 8–10 kvízových otázek s výběrem odpovědi pro živou hru. */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { text, title, count } = await req.json();
    if (typeof text !== "string" || text.trim().length < 40) {
      return json({ error: "Lekce neobsahuje dost textu pro vytvoření kvízu." }, 400);
    }
    const n = Math.min(12, Math.max(3, Number(count) || 10));

    const systemPrompt = `Jsi zkušený český pedagog. Z textu lekce vytvoříš kvíz do živé třídní hry (jako Kahoot).
PRAVIDLA:
- Vytvoř ${n} různých otázek (nejméně 8, pokud to obsah dovolí), které pokrývají celý text lekce, ne jen začátek.
- Každá otázka má přesně 4 krátké odpovědi (max. 80 znaků), přesně 1 správnou; distraktory věrohodné.
- Otázka max. 140 znaků, jednoznačná, bez "Která z následujících není..." dvojitých záporů.
- Přidej krátké vysvětlení správné odpovědi (1 věta).
- Vše česky. Nevymýšlej fakta, která v textu nejsou.
Odpověz POUZE platným JSON objektem ve tvaru:
{"questions":[{"question":"...","answers":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}`;

    const userPrompt = `Lekce: ${String(title || "").slice(0, 200)}\n\nText lekce:\n${text.slice(0, 14000)}`;

    const incomingRunId = req.headers.get("X-Lovable-AIG-Run-ID")?.trim();
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
        "Content-Type": "application/json",
        ...(incomingRunId ? { "X-Lovable-AIG-Run-ID": incomingRunId } : {}),
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const runId = response.headers.get("X-Lovable-AIG-Run-ID") ?? incomingRunId ?? "";
    const runHdr = runId ? { "X-Lovable-AIG-Run-ID": runId } : {};

    if (!response.ok || !response.body) {
      const t = await response.text().catch(() => "");
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) return json({ error: "Příliš mnoho požadavků, zkuste to za chvíli." }, 429, runHdr);
      if (response.status === 402) return json({ error: "Nedostatek kreditů pro AI generování." }, 402, runHdr);
      if (response.status === 403) return json({ error: "AI generování není pro tento účet dostupné." }, 403, runHdr);
      return json({ error: "Chyba AI služby" }, 500, runHdr);
    }

    // Stream (SSE) čteme na serveru a skládáme výsledný text.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          const d = evt.choices?.[0]?.delta?.content;
          if (typeof d === "string") out += d;
        } catch { /* neúplný rámec */ }
      }
    }

    const match = out.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "AI nevrátila kvíz. Zkuste to prosím znovu." }, 500, runHdr);
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch {
      return json({ error: "AI vrátila neplatný kvíz. Zkuste to prosím znovu." }, 500, runHdr);
    }

    const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
      .map((q: any) => {
        const question = String(q?.question ?? "").trim();
        const answers = (Array.isArray(q?.answers) ? q.answers : [])
          .map((a: any) => String(typeof a === "string" ? a : a?.text ?? "").trim())
          .filter(Boolean)
          .slice(0, 6);
        let correctIndex = Number.isInteger(q?.correctIndex) ? q.correctIndex : 0;
        if (correctIndex < 0 || correctIndex >= answers.length) correctIndex = 0;
        return { question, answers, correctIndex, explanation: String(q?.explanation ?? "").trim() };
      })
      .filter((q: any) => q.question && q.answers.length >= 2)
      .slice(0, 12);

    if (questions.length === 0) return json({ error: "AI nevytvořila žádnou použitelnou otázku." }, 500, runHdr);
    return json({ questions }, 200, runHdr);
  } catch (e) {
    console.error("generate-lesson-quiz error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
