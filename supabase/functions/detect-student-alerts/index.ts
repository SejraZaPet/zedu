// Proactive student alert detection.
// Scheduled daily via pg_cron. Verifies X-Cron-Secret from Vault.
// Creates 'inactive' and 'struggling_topic' alerts + notifies teachers & parents.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getInternalSecret } from "../_shared/internal-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CRON_SECRET = (await getInternalSecret("cron_internal_secret"))?.trim();
  const got = req.headers.get("X-Cron-Secret")?.trim();
  if (!CRON_SECRET || got !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const inactivityCutoff = new Date(now.getTime() - 7 * DAY);
  const accountMinAge = new Date(now.getTime() - 7 * DAY);
  const dedupeInactive = new Date(now.getTime() - 7 * DAY);
  const dedupeStruggling = new Date(now.getTime() - 14 * DAY);

  const createdAlerts: any[] = [];

  // --- Load all students (profiles with role = 'student') older than 7d ---
  const { data: students, error: sErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, created_at")
    .eq("role", "student")
    .lte("created_at", accountMinAge.toISOString());

  if (sErr) {
    console.error("[alerts] load students failed", sErr);
    return new Response(JSON.stringify({ error: sErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const st of students ?? []) {
    const studentId = (st as any).id as string;
    const studentName = `${(st as any).first_name ?? ""} ${(st as any).last_name ?? ""}`.trim() || "Žák";

    // --- INACTIVITY ---
    const [ar, aa, ps] = await Promise.all([
      supabase.from("student_activity_results").select("completed_at").eq("user_id", studentId).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("assignment_attempts").select("submitted_at").eq("student_id", studentId).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("student_practice_sessions").select("created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const lastActs: number[] = [];
    if ((ar.data as any)?.completed_at) lastActs.push(new Date((ar.data as any).completed_at).getTime());
    if ((aa.data as any)?.submitted_at) lastActs.push(new Date((aa.data as any).submitted_at).getTime());
    if ((ps.data as any)?.created_at) lastActs.push(new Date((ps.data as any).created_at).getTime());

    const lastAct = lastActs.length > 0 ? Math.max(...lastActs) : 0;
    const daysSince = lastAct > 0
      ? Math.floor((now.getTime() - lastAct) / DAY)
      : Math.floor((now.getTime() - new Date((st as any).created_at).getTime()) / DAY);

    if (!lastAct || lastAct < inactivityCutoff.getTime()) {
      // Check dedupe: unresolved inactive alert in past 7d?
      const { data: recent } = await supabase
        .from("student_alerts")
        .select("id")
        .eq("student_id", studentId)
        .eq("alert_type", "inactive")
        .eq("resolved", false)
        .gte("created_at", dedupeInactive.toISOString())
        .limit(1);

      if (!recent || recent.length === 0) {
        // Find primary class (first class membership)
        const { data: cm } = await supabase
          .from("class_members")
          .select("class_id")
          .eq("user_id", studentId)
          .limit(1)
          .maybeSingle();
        const classId = (cm as any)?.class_id ?? null;

        // Find teachers of that class
        const { data: teachers } = classId
          ? await supabase.from("class_teachers").select("user_id").eq("class_id", classId)
          : { data: [] as any[] };

        const teacherIds = ((teachers ?? []) as any[]).map((t) => t.user_id);
        const primaryTeacherId = teacherIds[0] ?? null;

        const detail = `Nepřihlásil(a) se ${daysSince} dní.`;
        const { data: inserted, error: insErr } = await supabase
          .from("student_alerts")
          .insert({
            student_id: studentId,
            teacher_id: primaryTeacherId,
            class_id: classId,
            alert_type: "inactive",
            detail,
          })
          .select("id")
          .single();

        if (!insErr && inserted) {
          createdAlerts.push({ studentId, alert_type: "inactive" });
          const recipients = new Set<string>(teacherIds);
          const { data: parents } = await supabase
            .from("parent_student_links")
            .select("parent_id")
            .eq("student_id", studentId);
          for (const p of (parents ?? []) as any[]) recipients.add(p.parent_id);

          if (recipients.size > 0) {
            const rows = Array.from(recipients).map((rid) => ({
              recipient_id: rid,
              sender_role: "system",
              title: `Neaktivní žák: ${studentName}`,
              body: detail,
              type: "warning",
              is_manual: false,
              status: "sent",
              sent_at: new Date().toISOString(),
              link: "/upozorneni",
              payload: { alert_id: (inserted as any).id, alert_type: "inactive", student_id: studentId },
            }));
            await supabase.from("notifications").insert(rows);
          }
        }
      }
    }

    // --- STRUGGLING TOPIC (per subject) ---
    // Fetch last submitted attempts joined to assignments -> classes.subject
    const { data: attempts } = await supabase
      .from("assignment_attempts")
      .select("score, max_score, submitted_at, assignment:assignments(class_id, classes:classes(subject, id))")
      .eq("student_id", studentId)
      .eq("status", "submitted")
      .not("score", "is", null)
      .not("max_score", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(30);

    if (attempts && attempts.length >= 3) {
      // Group by subject
      const bySubject = new Map<string, { classId: string | null; scores: number[]; }>();
      for (const a of attempts as any[]) {
        const cls = a.assignment?.classes;
        const subject = cls?.subject as string | undefined;
        if (!subject) continue;
        if (!a.max_score) continue;
        const pct = (a.score ?? 0) / a.max_score;
        const entry = bySubject.get(subject) ?? { classId: cls.id ?? null, scores: [] };
        if (entry.scores.length < 3) entry.scores.push(pct);
        bySubject.set(subject, entry);
      }

      for (const [subject, entry] of bySubject.entries()) {
        if (entry.scores.length < 3) continue;
        const avg = entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length;
        if (avg >= 0.5) continue;

        // Dedupe
        const { data: existing } = await supabase
          .from("student_alerts")
          .select("id")
          .eq("student_id", studentId)
          .eq("alert_type", "struggling_topic")
          .eq("context", subject)
          .eq("resolved", false)
          .gte("created_at", dedupeStruggling.toISOString())
          .limit(1);
        if (existing && existing.length > 0) continue;

        const { data: teachers } = entry.classId
          ? await supabase.from("class_teachers").select("user_id").eq("class_id", entry.classId)
          : { data: [] as any[] };
        const teacherIds = ((teachers ?? []) as any[]).map((t) => t.user_id);
        const primaryTeacherId = teacherIds[0] ?? null;

        const pctLabel = Math.round(avg * 100);
        const detail = `Průměr ${pctLabel} % za poslední ${entry.scores.length} pokusy v předmětu ${subject}.`;

        const { data: inserted, error: insErr } = await supabase
          .from("student_alerts")
          .insert({
            student_id: studentId,
            teacher_id: primaryTeacherId,
            class_id: entry.classId,
            alert_type: "struggling_topic",
            context: subject,
            detail,
          })
          .select("id")
          .single();

        if (!insErr && inserted) {
          createdAlerts.push({ studentId, alert_type: "struggling_topic", subject });
          const recipients = new Set<string>(teacherIds);
          const { data: parents } = await supabase
            .from("parent_student_links")
            .select("parent_id")
            .eq("student_id", studentId);
          for (const p of (parents ?? []) as any[]) recipients.add(p.parent_id);

          if (recipients.size > 0) {
            const rows = Array.from(recipients).map((rid) => ({
              recipient_id: rid,
              sender_role: "system",
              title: `Zaostávání: ${studentName} – ${subject}`,
              body: detail,
              type: "warning",
              is_manual: false,
              status: "sent",
              sent_at: new Date().toISOString(),
              link: "/upozorneni",
              payload: { alert_id: (inserted as any).id, alert_type: "struggling_topic", student_id: studentId, subject },
            }));
            await supabase.from("notifications").insert(rows);
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: students?.length ?? 0,
      created: createdAlerts.length,
      breakdown: createdAlerts,
      ts: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
