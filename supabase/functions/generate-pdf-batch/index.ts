import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import JSZip from "npm:jszip@3.10.1";

import { createPdf, finalizePdf, drawFooter } from "../_shared/pdf/pdf-engine.ts";
import { buildWorksheetPdf } from "../_shared/pdf/worksheet.ts";
import { buildLessonPlanPdf } from "../_shared/pdf/lesson-plan.ts";
import { buildSchedulePdf } from "../_shared/pdf/schedule.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_IDS = 50;

interface ReqBody {
  type: "worksheet" | "lesson_plan" | "schedule";
  ids: string[];
}

function json(b: unknown, s = 200): Response {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

const today = () => new Date().toISOString().slice(0, 10);

async function genWorksheet(svc: any, id: string, teacherName: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  const { data: ws } = await svc.from("worksheets").select("*").eq("id", id).maybeSingle();
  if (!ws) return null;
  const ctx = await createPdf("portrait");
  await buildWorksheetPdf(ctx, ws, { teacherName, date: today() });
  drawFooter(ctx, `${ws.title || "Worksheet"} · ${today()}`);
  return { name: `worksheet-${slug(ws.title)}-${id.slice(0, 8)}.pdf`, bytes: await finalizePdf(ctx) };
}

async function genLessonPlan(svc: any, id: string, teacherName: string) {
  const [{ data: plan }, { data: phases }] = await Promise.all([
    svc.from("lesson_plans").select("*").eq("id", id).maybeSingle(),
    svc.from("lesson_plan_phases").select("*").eq("lesson_plan_id", id).order("sort_order", { ascending: true }),
  ]);
  if (!plan) return null;
  const ctx = await createPdf("portrait");
  buildLessonPlanPdf(ctx, plan, phases || [], { teacherName, date: today() });
  drawFooter(ctx, `${plan.title || "Plán hodiny"} · ${today()}`);
  return { name: `plan-${slug(plan.title)}-${id.slice(0, 8)}.pdf`, bytes: await finalizePdf(ctx) };
}

async function genSchedule(svc: any, id: string, teacherName: string) {
  const [{ data: klass }, { data: slots }] = await Promise.all([
    svc.from("classes").select("id,name,field_of_study,year").eq("id", id).maybeSingle(),
    svc.from("class_schedule_slots").select("*").eq("class_id", id),
  ]);
  if (!klass) return null;
  const ctx = await createPdf("landscape");
  buildSchedulePdf(ctx, klass, slots || [], { teacherName, date: today() });
  drawFooter(ctx, `Rozvrh ${klass.name || ""} · ${today()}`);
  return { name: `rozvrh-${slug(klass.name)}-${id.slice(0, 8)}.pdf`, bytes: await finalizePdf(ctx) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Chybí autorizace" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Neplatný token" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as ReqBody;
    if (!body?.type || !Array.isArray(body.ids) || body.ids.length === 0) {
      return json({ error: "Chybí type / ids" }, 400);
    }
    if (body.ids.length > MAX_IDS) {
      return json({ error: `Maximálně ${MAX_IDS} dokumentů na request` }, 400);
    }

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: prof } = await svc.from("profiles").select("first_name,last_name").eq("id", userId).maybeSingle();
    const teacherName = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "";

    const zip = new JSZip();
    const errors: string[] = [];

    for (const id of body.ids) {
      try {
        let r: { name: string; bytes: Uint8Array } | null = null;
        if (body.type === "worksheet") r = await genWorksheet(svc, id, teacherName);
        else if (body.type === "lesson_plan") r = await genLessonPlan(svc, id, teacherName);
        else if (body.type === "schedule") r = await genSchedule(svc, id, teacherName);
        if (r) zip.file(r.name, r.bytes);
        else errors.push(`${id}: nenalezeno`);
      } catch (e: any) {
        errors.push(`${id}: ${e?.message ?? e}`);
      }
    }

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const path = `${userId}/${body.type}-batch/${Date.now()}-${body.type}-${body.ids.length}.zip`;
    const { error: upErr } = await svc.storage.from("generated-pdfs").upload(path, zipBytes, {
      contentType: "application/zip",
      upsert: false,
    });
    if (upErr) throw new Error("Upload ZIP selhal: " + upErr.message);
    const { data: signed } = await svc.storage.from("generated-pdfs").createSignedUrl(path, 3600);
    if (!signed?.signedUrl) throw new Error("Signed URL selhalo");

    return json({ url: signed.signedUrl, path, count: body.ids.length, errors });
  } catch (e: any) {
    console.error("[generate-pdf-batch] error", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
