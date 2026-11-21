import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { AI_MODEL_QUALITY } from "../_shared/ai-models.ts";
import { buildTutorSummaryPrompt, buildTutorSystemPrompt, isTutorProvenanceQuestion, TUTOR_UNCERTAIN_SOURCE_REPLY, type TutorMode, type TutorSourceSnippet } from "./tutor.ts";
import { searchStudentMaterialSnippets } from "./search.ts";
import { SOURCE_KINDS, SOURCE_TEXT_LIMIT, type SourceKind } from "../_shared/practice-phases.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const demoBlock = await demoAiGuard(auth, "ask-zedai-tutor");
    if (demoBlock) return demoBlock;
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return json({ error: "Neplatný požadavek." }, 400);
    const mode = body.mode ?? "context";
    if (mode !== "context" && mode !== "free") return json({ error: "Neplatný režim chatu." }, 400);
    const tutorMode: TutorMode = mode;
    const task = body.task ?? "chat";
    if (task !== "chat" && task !== "summary") return json({ error: "Neplatná operace chatu." }, 400);
    if (task === "summary" && tutorMode !== "free") return json({ error: "Shrnutí je dostupné jen ve volném režimu." }, 400);
    const question = typeof body.question === "string" ? body.question : "";
    const studentMessage = typeof body.studentMessage === "string" ? body.studentMessage.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    if (!studentMessage) return json({ error: "Prázdná zpráva." }, 400);
    if (studentMessage.length > 4000 || question.length > 12000 || subject.length > 200) {
      return json({ error: "Zpráva nebo kontext je příliš dlouhý." }, 400);
    }
    if (task === "chat" && isTutorProvenanceQuestion(studentMessage)) {
      return json({ reply: TUTOR_UNCERTAIN_SOURCE_REPLY, grounded: false, sources: [] });
    }

    let providedMaterial: TutorSourceSnippet | null = null;
    if (body.material !== undefined && body.material !== null) {
      if (tutorMode !== "free" || !body.material || typeof body.material !== "object" || Array.isArray(body.material)) {
        return json({ error: "Materiál lze přidat jen ve volném režimu." }, 400);
      }
      const raw = body.material as Record<string, unknown>;
      const text = typeof raw.text === "string" ? raw.text.trim() : "";
      const title = typeof raw.label === "string" ? raw.label.trim() : "";
      const kind = typeof raw.kind === "string" ? raw.kind : "";
      const rawHref = typeof raw.href === "string" ? raw.href.trim() : "";
      const href = rawHref.length <= 1000 && /^\/(?:student\/(?:sesit|ucebnice)(?:\/|\?)|ucebnice\/)/.test(rawHref) ? rawHref : undefined;
      if (!text || !title || !(SOURCE_KINDS as readonly string[]).includes(kind)) {
        return json({ error: "Materiál nemá platný název, typ nebo text." }, 400);
      }
      if (text.length > SOURCE_TEXT_LIMIT || title.length > 200) {
        return json({ error: `Materiál je příliš dlouhý. Text může mít nejvýše ${SOURCE_TEXT_LIMIT} znaků.` }, 400);
      }
      providedMaterial = { text, title, kind: kind as SourceKind, ...(href ? { href } : {}) };
    }

    const history: ChatMsg[] = Array.isArray(body.conversationHistory)
      ? body.conversationHistory
        .filter((message): message is ChatMsg => Boolean(
          message && typeof message === "object"
          && ((message as ChatMsg).role === "user" || (message as ChatMsg).role === "assistant")
          && typeof (message as ChatMsg).content === "string"
        ))
        .slice(-20)
        .map((message) => ({ role: message.role, content: message.content.slice(0, 4000) }))
      : [];

    let snippets: TutorSourceSnippet[] = [];
    let searchFailed = false;
    if (tutorMode === "free" && task === "chat" && !providedMaterial) {
      try {
        // Důležité: anon klient + původní JWT. RLS rozhoduje, nic se nečte service rolí.
        const studentDb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: auth.authHeader } } },
        );
        snippets = await searchStudentMaterialSnippets(studentDb, auth.userId, studentMessage);
      } catch {
        // Obsah dotazu ani materiálů se neloguje; chat může pokračovat bez úryvků.
        searchFailed = true;
      }
    }
    if (task === "summary" && !history.some((message) => message.role === "user")) {
      return json({ error: "Nejprve si s Bezlai popovídej. Potom můžeš vytvořit shrnutí." }, 400);
    }

    const systemPrompt = task === "summary"
      ? buildTutorSummaryPrompt({ subject, providedMaterial })
      : buildTutorSystemPrompt({
        mode: tutorMode,
        subject,
        question,
        snippets,
        searchFailed,
        providedMaterial,
      });
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL_QUALITY,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: studentMessage },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return json({ error: "Moc otázek najednou, zkus to prosím za chvíli." }, 429);
      if (resp.status === 402) return json({ error: "Nedostatek kreditů pro AI. Kontaktuj učitele." }, 402);
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, `body_len=${t.length}`);
      return json({ error: "Chyba AI služby" }, 500);
    }

    const data = await resp.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "";
    if (!reply) return json({ error: "Prázdná odpověď z AI" }, 500);
    const usedSources = task === "chat" ? (providedMaterial ? [providedMaterial] : snippets) : [];
    return json({
      reply,
      grounded: usedSources.length > 0,
      sources: usedSources.map(({ title, kind, href }) => ({ title, kind, ...(href ? { href } : {}) })),
      ...(searchFailed ? { searchError: "Materiály se nepodařilo prohledat. Bezlai odpoví bez nich." } : {}),
    });
  } catch {
    console.error("ask-zedai-tutor request failed");
    return json({ error: "Bezlai teď není dostupná. Zkus to prosím znovu." }, 500);
  }
});
