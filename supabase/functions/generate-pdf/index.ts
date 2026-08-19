import { createClient } from "npm:@supabase/supabase-js@2.45.0";

import { createPdf, finalizePdf, drawFooter } from "../_shared/pdf/pdf-engine.ts";
import { buildWorksheetPdf } from "../_shared/pdf/worksheet.ts";
import { buildLessonPlanPdf } from "../_shared/pdf/lesson-plan.ts";
import { buildSchedulePdf } from "../_shared/pdf/schedule.ts";
import { buildMeetingNotesPdf } from "../_shared/pdf/meeting-notes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type DocType = "worksheet" | "lesson_plan" | "schedule" | "meeting_notes";

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
    // body.id is class_id — verify the caller teaches this class (or is admin).
    const [{ data: adminRole }, { data: membership }] = await Promise.all([
      svc.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      svc.from("class_teachers").select("class_id").eq("class_id", body.id).eq("user_id", userId).maybeSingle(),
    ]);
    if (!adminRole && !membership) {
      throw new Error("Nemáte oprávnění k této třídě");
    }
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

  if (body.type === "meeting_notes") {
    const { data: meeting, error: mErr } = await svc
      .from("school_meetings")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (mErr) throw new Error("DB error: " + mErr.message);
    if (!meeting) throw new Error("Porada nenalezena");

    const { data: me } = await svc.from("profiles").select("school_id").eq("id", userId).maybeSingle();
    if (!(me as any)?.school_id || (me as any).school_id !== (meeting as any).school_id) {
      throw new Error("Nemáte oprávnění k této poradě");
    }

    const [{ data: attRows }, { data: ackRows }, { data: taskRows }, { data: school }] = await Promise.all([
      svc.from("school_meeting_attendees").select("teacher_id, attended").eq("meeting_id", body.id),
      svc.from("school_meeting_acknowledgments").select("teacher_id, acknowledged_at").eq("meeting_id", body.id),
      svc.from("school_meeting_tasks").select("task, due_date, assigned_to").eq("meeting_id", body.id),
      svc.from("schools").select("name").eq("id", (meeting as any).school_id).maybeSingle(),
    ]);

    const ids = new Set<string>();
    ((attRows as any[]) || []).forEach((a) => a.teacher_id && ids.add(a.teacher_id));
    ((taskRows as any[]) || []).forEach((t) => t.assigned_to && ids.add(t.assigned_to));
    if ((meeting as any).author_id) ids.add((meeting as any).author_id);

    const nameById = new Map<string, string>();
    if (ids.size > 0) {
      const { data: profs } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", Array.from(ids));
      ((profs as any[]) || []).forEach((p) => {
        const label =
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "Učitel";
        nameById.set(p.id, label);
      });
    }

    const ackMap = new Map<string, string>();
    ((ackRows as any[]) || []).forEach((a) => ackMap.set(a.teacher_id, a.acknowledged_at));

    const attendees = ((attRows as any[]) || []).map((a) => ({
      teacher_id: a.teacher_id,
      attended: !!a.attended,
      name: nameById.get(a.teacher_id) || "Učitel",
      acknowledgedAt: ackMap.get(a.teacher_id) ?? null,
    }));
    const tasks = ((taskRows as any[]) || []).map((t) => ({
      task: t.task,
      due_date: t.due_date,
      assigneeName: t.assigned_to ? nameById.get(t.assigned_to) ?? null : null,
    }));

    const ctx = await createPdf("portrait");
    buildMeetingNotesPdf(ctx, meeting as any, attendees, tasks, {
      schoolName: (school as any)?.name ?? null,
      authorName: (meeting as any).author_id ? nameById.get((meeting as any).author_id) ?? null : null,
      date,
    });
    drawFooter(ctx, `${(meeting as any).title || "Zápis z porady"}  ·  ${date}`);
    const bytes = await finalizePdf(ctx);
    return { bytes, suggestedName: `porada-${slug((meeting as any).title)}-${body.id.slice(0, 8)}.pdf` };
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
    if (!["worksheet", "lesson_plan", "schedule", "meeting_notes"].includes(body.type)) {
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
