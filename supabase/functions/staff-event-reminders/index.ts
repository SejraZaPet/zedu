// Cron: rozesílá upozornění na události pracovního kalendáře (staff_calendar_events).
// Hledá události, kde aktuální čas odpovídá start_time - reminder_minutes (±5 min),
// a které ještě nebyly odeslány (staff_event_reminder_log, UNIQUE(event_id, minutes_before)).
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { getInternalSecret } from "../_shared/internal-secret.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WINDOW_MIN = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = await getInternalSecret("cron_internal_secret");
  if (!secret || req.headers.get("X-Internal-Secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const now = Date.now();
    // Nejdelší podporované upozornění je 2 dny → stačí okno 2 dní dopředu.
    const horizon = new Date(now + 2 * 24 * 60 * 60 * 1000 + WINDOW_MIN * 60000).toISOString();

    const { data: events, error } = await admin
      .from("staff_calendar_events")
      .select("id, title, start_time, created_by, reminder_minutes")
      .not("reminder_minutes", "is", null)
      .gte("start_time", new Date(now).toISOString())
      .lte("start_time", horizon);
    if (error) throw error;

    let sent = 0;
    for (const ev of events ?? []) {
      const startMs = new Date(ev.start_time).getTime();
      for (const minutes of (ev.reminder_minutes as number[]) ?? []) {
        const diffMin = (startMs - minutes * 60000 - now) / 60000;
        if (Math.abs(diffMin) > WINDOW_MIN) continue;

        const { error: logErr } = await admin
          .from("staff_event_reminder_log")
          .insert({ event_id: ev.id, minutes_before: minutes });
        if (logErr) continue; // duplicita → už odesláno

        const label =
          minutes >= 1440
            ? `${Math.round(minutes / 1440)} den/dny`
            : minutes >= 60
              ? `${Math.round(minutes / 60)} h`
              : `${minutes} min`;

        await admin.from("notifications").insert({
          recipient_id: ev.created_by,
          title: `Připomínka: ${ev.title}`,
          body: `Událost začíná za ${label}.`,
          type: "staff_event_reminder",
          link: "/admin",
        });
        sent++;
      }
    }

    return new Response(JSON.stringify({ checked: events?.length ?? 0, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[staff-event-reminders] fatal", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
