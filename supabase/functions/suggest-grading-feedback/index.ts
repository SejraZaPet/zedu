import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AI_MODEL_QUALITY } from "../_shared/ai-models.ts";
import {
  buildPointsUserContent, buildUserContent, classifyAttachment, hasGradableContent, LoadedAttachment,
  MAX_DOC_TEXT_CHARS, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, normalizePointSuggestions,
  POINTS_SYSTEM_PROMPT, sanitizeAttachmentRefs, sanitizePointItems, SYSTEM_PROMPT,
} from "./prompt.ts";
import {
  GRADING_LESSON_CHARS, isUuid, loadAssignmentRow, loadLinkedLesson, loadMaterialFiles, type LoadedMaterial,
  parseMaterialRefs, selectMaterialFiles,
} from "../_shared/assignment-context.ts";

const BUCKETS = ["student-portfolio", "assignment-uploads", "student-attachments"];

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const xml = new TextDecoder().decode(unzipSync(bytes)["word/document.xml"] ?? new Uint8Array());
  return [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
    .map((m) => [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join(" "))
    .join("\n")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const demoBlock = await demoAiGuard(auth, "suggest-grading-feedback");
    if (demoBlock) return demoBlock;
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const pointsMode = body?.mode === "worksheet_points";
    const pointItems = pointsMode ? sanitizePointItems(body?.items) : [];
    const studentAnswer = body?.studentAnswer ?? "";
    const question = typeof body?.question === "string" ? body.question.slice(0, 4000) : "";
    const criteria = typeof body?.criteria === "string" ? body.criteria.slice(0, 4000) : "";
    const itemId = typeof body?.itemId === "string" && /^[0-9a-f-]{36}$/i.test(body.itemId) ? body.itemId : null;
    const { score, maxScore, isCorrect } = body ?? {};
    const refs = sanitizeAttachmentRefs(body?.attachments);

    const answerText = (typeof studentAnswer === "string"
      ? studentAnswer
      : JSON.stringify(studentAnswer ?? "", null, 2)).slice(0, 12000);

    if (pointsMode && pointItems.length === 0) {
      return new Response(JSON.stringify({ error: "V pracovním listu nejsou otevřené položky k bodovému návrhu." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!pointsMode && !hasGradableContent(answerText === '""' ? "" : answerText, refs)) {
      return new Response(JSON.stringify({
        error: "Pro AI chybí čitelný text nebo podporovaná příloha. Audio a video posuďte ručně.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Caller-scoped client: RLS on tables and storage decides what the caller may read.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth.authHeader } } },
    );

    const assignmentId = !pointsMode && isUuid(body?.assignmentId) ? body.assignmentId : null;
    if (refs.length > 0 || itemId || pointsMode || assignmentId) {
      const { data: staff } = await userClient.rpc("is_admin_or_teacher");
      if (staff !== true) {
        return new Response(JSON.stringify({ error: "Návrh hodnocení může vytvořit jen učitel nebo správce." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (itemId) {
      const { data: item } = await userClient
        .from("student_portfolio_items").select("id, student_id").eq("id", itemId).maybeSingle();
      if (!item || item.student_id === auth.userId) {
        return new Response(JSON.stringify({ error: "K této položce portfolia nemáte přístup." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const attachments: LoadedAttachment[] = [];
    let totalBytes = 0;
    for (const ref of refs) {
      const { kind, mime } = classifyAttachment(ref.name, ref.type);
      if (kind === "unsupported") { attachments.push({ name: ref.name, status: "unreadable" }); continue; }
      let bytes: Uint8Array | null = null;
      for (const bucket of BUCKETS) {
        const { data } = await userClient.storage.from(bucket).download(ref.path);
        if (data) { bytes = new Uint8Array(await data.arrayBuffer()); break; }
      }
      if (!bytes || bytes.length === 0 || bytes.length > MAX_FILE_BYTES || totalBytes + bytes.length > MAX_TOTAL_BYTES) {
        attachments.push({ name: ref.name, status: "unreadable" });
        continue;
      }
      totalBytes += bytes.length;
      try {
        if (kind === "docx" || kind === "text") {
          const text = (kind === "docx" ? await extractDocxText(bytes) : new TextDecoder().decode(bytes)).trim();
          attachments.push(text
            ? { name: ref.name, status: "ok", text: text.slice(0, MAX_DOC_TEXT_CHARS) }
            : { name: ref.name, status: "unreadable" });
        } else {
          attachments.push({ name: ref.name, status: "ok", dataUrl: `data:${mime};base64,${toBase64(bytes)}` });
        }
      } catch {
        attachments.push({ name: ref.name, status: "unreadable" });
      }
    }
    console.log("suggest-grading-feedback attachments", {
      count: attachments.length, readable: attachments.filter((a) => a.status === "ok").length, totalBytes,
    });

    // Podklady učitele: úkol, lekce i materiály čte token učitele (RLS + storage politiky), nic service rolí.
    let lessonContext: { title: string; text: string } | null = null;
    let teacherMaterials: LoadedMaterial[] = [];
    if (assignmentId) {
      try {
        const row = await loadAssignmentRow(userClient as any, assignmentId);
        if (row) {
          lessonContext = await loadLinkedLesson(userClient as any, row.lesson_id, row.lesson_source, GRADING_LESSON_CHARS);
          const allRefs = parseMaterialRefs(row.materials);
          const files = selectMaterialFiles(allRefs, MAX_FILES, false);
          const loaded = await loadMaterialFiles(userClient as any, files, { pdfAs: "file", textOnly: false });
          teacherMaterials = [
            ...loaded.materials,
            ...allRefs.filter((ref) => ref.kind === "link").slice(0, MAX_FILES).map((ref) => ({ title: ref.title, status: "link" as const })),
          ];
          console.log("suggest-grading-feedback context", {
            lesson: Boolean(lessonContext), materials: teacherMaterials.length, storageDenied: loaded.storageDenied,
          });
        }
      } catch {
        console.error("suggest-grading-feedback context failed");
      }
    }

    const scoreLine =
      (score != null ? `Skóre: ${score}${maxScore != null ? ` / ${maxScore}` : ""}` : "") +
      (isCorrect === true ? "\nOdpověď je vyhodnocena jako správná."
        : isCorrect === false ? "\nOdpověď je vyhodnocena jako nesprávná." : "");

    const userContent = pointsMode
      ? buildPointsUserContent(question, pointItems)
      : buildUserContent({ question, criteria, answerText, scoreLine, attachments, lesson: lessonContext, teacherMaterials });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL_QUALITY,
        messages: [
          { role: "system", content: pointsMode ? POINTS_SYSTEM_PROMPT : SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        ...(pointsMode ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "worksheet_point_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        points: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["id", "points", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        } : {}),
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to prosím za chvíli." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů pro AI. Kontaktujte administrátora." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, `body_len=${t.length}`);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      return new Response(JSON.stringify({ error: "Prázdná odpověď z AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pointsMode) {
      const suggestions = normalizePointSuggestions(JSON.parse(content), pointItems);
      if (suggestions.length === 0) {
        return new Response(JSON.stringify({ error: "AI nevrátila použitelný návrh bodů." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ items: suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ feedback: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-grading-feedback error:", e instanceof Error ? e.name : "unknown");
    return new Response(
      JSON.stringify({ error: "Návrh se nepodařilo vytvořit, zkuste to prosím znovu." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
