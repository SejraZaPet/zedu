// Send Web Push notifications to all subscriptions of a recipient.
// Triggered by the DB trigger `notifications_send_push` after a new row in `notifications`,
// or invoked manually with `{ test: true }` from the client.
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC =
  "BKv-g73e0ou_IoTM9xe2Jlld00MntQD88gmahEQV2H3a_45rXrnWIpa3h2YGB77hnxQniytP9baipmoFH1HRWQs";
// Normalize private key: trim whitespace/quotes, convert standard b64 -> url-safe, strip '=' padding.
const VAPID_PRIVATE = (Deno.env.get("VAPID_PRIVATE_KEY") || "")
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\s+/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "");

const RAW_SUBJECT = (Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@zedu.cz").trim();
const VAPID_SUBJECT = /^(mailto:|https?:\/\/)/i.test(RAW_SUBJECT)
  ? RAW_SUBJECT
  : `mailto:${RAW_SUBJECT.includes("@") ? RAW_SUBJECT : "noreply@zedu.cz"}`;

let _vapidReady = false;
let _vapidError: string | null = null;
function ensureVapid() {
  if (_vapidReady) return true;
  try {
    if (!VAPID_PRIVATE) throw new Error("VAPID_PRIVATE_KEY not configured");
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    _vapidReady = true;
    _vapidError = null;
    return true;
  } catch (e) {
    _vapidError = (e as Error).message;
    console.error("[send-push] VAPID config invalid:", _vapidError, "len=", VAPID_PRIVATE.length);
    return false;
  }
}

interface Payload {
  recipient_id?: string;
  title?: string;
  body?: string;
  link?: string;
  notification_id?: string;
  type?: string;
  test?: boolean;
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await supa.auth.getUser();
  return data?.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Payload;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let recipient_id = body.recipient_id;
    let title = body.title || "ZEdu";
    let text = body.body || "";
    let link = body.link || "/";

    if (body.test) {
      const uid = await getUserId(req);
      if (!uid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipient_id = uid;
      title = "ZEdu — testovací notifikace";
      text = "Push notifikace fungují správně. 🎉";
      link = "/profil";
    }

    if (!recipient_id) {
      return new Response(JSON.stringify({ error: "recipient_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipient_id);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: text,
      link,
      notification_id: body.notification_id ?? null,
      tag: body.notification_id ?? body.type ?? undefined,
    });

    let sent = 0;
    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) stale.push(s.id);
          else console.error("[send-push] error", code, (err as Error)?.message);
        }
      })
    );

    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ sent, removed_stale: stale.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-push] fatal", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
