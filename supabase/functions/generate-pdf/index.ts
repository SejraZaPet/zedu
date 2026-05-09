import { createClient } from "npm:@supabase/supabase-js@2.45.0";

import { createPdf, finalizePdf, drawFooter } from "./_shared/pdf-engine.ts";
import { buildWorksheetPdf } from "./builders/worksheet.ts";
import { buildLessonPlanPdf } from "./builders/lesson-plan.ts";
import { buildSchedulePdf } from "./builders/schedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type DocType = "worksheet" | "lesson_plan" | "schedule";

interface ReqBody {
  type: DocType;
  id: string;
  template?: string;
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadProfileName(svc: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data } = await svc.from("profiles").select("first_name,last_name").eq("id", userId).maybeSingle();
  return [data?.first_name, data?.last_name].filter(Boolean).join(" ") || "";
}

async function generateForType(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: ReqBody,
): Promise<{ bytes: Uint8Array; suggestedName: string }> {
  const teacherName = await loadProfileName(svc, userId);
  const date = todayStr();

  if (body.type === "worksheet") {
    const { data: ws, error } = await svc.from("worksheets").select("*").eq("id", body.id).maybeSingle();
    if (error) throw new Error("DB error: " + error.message);
    if (!ws) throw new Error("Worksheet nenalezen");
    if ((ws as any).teacher_id && (ws as any).teacher_id !== userId) {
      // Allow if status is published (visible to peers), otherwise deny
      if ((ws as any).status !== "published") throw new Error("Nepatří vám tento worksheet");
    }
    const ctx = await createPdf("portrait");
    await buildWorksheetPdf(ctx, ws as any, { teacherName, date, includeAnswerKey: false });
    drawFooter(ctx, `${(ws as any).title || "Worksheet"}  ·  ${date}`);
    const bytes = await finalizePdf(ctx);
    return { bytes, suggestedName: `worksheet-${slug((ws as any).title)}-${body.id.slice(0, 8)}.pdf` };
  }

  if (body.type === "lesson_plan") {
    const [{ data: plan, error: e1 }, { data: phases }] = await Promise.all([
      svc.from("lesson_plans").select("*").eq("id", body.id).maybeSingle(),
      svc
        .from("lesson_plan_phases")
        .select("*")
        .eq("lesson_plan_id", body.id)
        .order("sort_order", { ascending: true }),
    ]);
    if (e1) throw new Error("DB error: " + e1.message);
    if (!plan) throw new Error("Plán nenalezen");
    if ((plan as any).teacher_id !== userId) throw new Error("Nepatří vám tento plán");
    const ctx = await createPdf("portrait");
    buildLessonPlanPdf(ctx, plan as any, (phases as any[]) || [], { teacherName, date });
    drawFooter(ctx, `${(plan as any).title || "Plán hodiny"}  ·  ${date}`);
    const bytes = await finalizePdf(ctx);
    return { bytes, suggestedName: `plan-${slug((plan as any).title)}-${body.id.slice(0, 8)}.pdf` };
  }

  if (body.type === "schedule") {
    // body.id is class_id
    const [{ data: klass }, { data: slots }] = await Promise.all([
      svc.from("classes").select("id,name,field_of_study,year").eq("id", body.id).maybeSingle(),
      svc.from("class_schedule_slots").select("*").eq("class_id", body.id),
    ]);
    if (!klass) throw new Error("Třída nenalezena");
    const ctx = await createPdf("landscape");
    buildSchedulePdf(ctx, klass as any, (slots as any[]) || [], { teacherName, date });
    drawFooter(ctx, `Rozvrh ${(klass as any).name || ""}  ·  ${date}`);
    const bytes = await finalizePdf(ctx);
    return { bytes, suggestedName: `rozvrh-${slug((klass as any).name)}.pdf` };
  }

  throw new Error("Neznámý typ dokumentu");
}

function slug(s: string | null | undefined): string {
  return (s || "dokument")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function uploadAndSign(
  svc: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  bytes: Uint8Array,
  suggestedName: string,
): Promise<{ url: string; path: string }> {
  const path = `${userId}/${type}/${Date.now()}-${suggestedName}`;
  const { error: upErr } = await svc.storage.from("generated-pdfs").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw new Error("Upload selhal: " + upErr.message);
  const { data: signed, error: sErr } = await svc.storage.from("generated-pdfs").createSignedUrl(path, 3600);
  if (sErr || !signed?.signedUrl) throw new Error("Signed URL selhalo: " + (sErr?.message ?? ""));
  return { url: signed.signedUrl, path };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResp({ error: "Chybí autorizace" }, 401);

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResp({ error: "Neplatný token" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as ReqBody;
    if (!body || !body.type || !body.id) {
      return jsonResp({ error: "Chybí type / id v requestu" }, 400);
    }
    if (!["worksheet", "lesson_plan", "schedule"].includes(body.type)) {
      return jsonResp({ error: "Neznámý type" }, 400);
    }

    // Service-role client for cross-RLS read + storage write
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { bytes, suggestedName } = await generateForType(svc, userId, body);
    const { url, path } = await uploadAndSign(svc, userId, body.type, bytes, suggestedName);

    return jsonResp({ url, path, size: bytes.byteLength });
  } catch (e: any) {
    console.error("[generate-pdf] error", e);
    return jsonResp({ error: e?.message ?? String(e) }, 500);
  }
});
