// Automatická připomenutí úkolů s blížícím se termínem.
// Spouští se každý den (pg_cron). Posílá notifikaci žákům, kteří mají
// publikovaný úkol s deadlinem v rozmezí ~24-48h a ještě ho nedokončili.
// Idempotence: pokud existuje notifikace s tímto broadcast_id pro daný pár (assignment, student), znovu se neposílá.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Najdi publikované úkoly s deadlinem v okně 24-48h.
  const { data: assignments, error: aErr } = await supabase
    .from("assignments")
    .select("id, title, deadline, class_id, teacher_id")
    .eq("status", "published")
    .gte("deadline", in24h.toISOString())
    .lte("deadline", in48h.toISOString());

  if (aErr) {
    return new Response(JSON.stringify({ error: aErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let created = 0;
  let skipped = 0;

  for (const a of assignments ?? []) {
    if (!a.class_id || !a.deadline) continue;

    // Žáci ve třídě
    const { data: members } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", a.class_id);
    const studentIds = (members ?? []).map((m: any) => m.user_id);
    if (studentIds.length === 0) continue;

    // Žáci, kteří už úkol odevzdali
    const { data: submitted } = await supabase
      .from("assignment_attempts")
      .select("student_id")
      .eq("assignment_id", a.id)
      .eq("status", "submitted");
    const submittedSet = new Set((submitted ?? []).map((s: any) => s.student_id));

    const targets = studentIds.filter((id: string) => !submittedSet.has(id));
    if (targets.length === 0) continue;

    // Idempotence: zkontroluj existující notifikaci pro tento assignment + recipient
    // Použijeme payload.assignment_id pro identifikaci.
    const { data: existing } = await supabase
      .from("notifications")
      .select("recipient_id")
      .in("recipient_id", targets)
      .filter("payload->>assignment_id", "eq", a.id);

    const existingSet = new Set(
      (existing ?? []).map((e: any) => e.recipient_id),
    );
    const finalTargets = targets.filter((id) => !existingSet.has(id));
    skipped += targets.length - finalTargets.length;
    if (finalTargets.length === 0) continue;

    const dueDateLabel = new Date(a.deadline).toLocaleDateString("cs-CZ");
    const rows = finalTargets.map((uid) => ({
      recipient_id: uid,
      sender_id: a.teacher_id,
      sender_role: "system",
      title: `Připomenutí úkolu: ${a.title}`,
      body: `Tvůj úkol „${a.title}" má termín ${dueDateLabel}. Odevzdej ho prosím včas.`,
      type: "reminder",
      is_manual: false,
      status: "sent",
      sent_at: new Date().toISOString(),
      link: `/student/ulohy`,
      payload: { assignment_id: a.id, auto: true },
    }));

    const { error: insErr } = await supabase.from("notifications").insert(rows);
    if (!insErr) created += rows.length;
  }

  return new Response(
    JSON.stringify({ ok: true, created, skipped, scanned: assignments?.length ?? 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
