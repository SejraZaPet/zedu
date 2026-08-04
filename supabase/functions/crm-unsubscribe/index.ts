import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const page = (title: string, message: string) =>
  new Response(
    `<!doctype html><html lang="cs"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;margin:0;padding:48px 16px;color:#1f2933">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;text-align:center">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="font-size:15px;line-height:1.6;margin:0">${message}</p>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const contactId = url.searchParams.get("c") ?? "";
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRe.test(contactId)) {
    return page("Neplatný odkaz", "Odkaz pro odhlášení není platný. Kontaktujte nás prosím přímo.");
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await admin
    .from("crm_contacts")
    .update({ unsubscribed_at: new Date().toISOString(), marketing_consent: false })
    .eq("id", contactId)
    .is("unsubscribed_at", null);

  if (error) {
    console.error("crm-unsubscribe error");
    return page("Něco se nepovedlo", "Odhlášení se nepodařilo zpracovat. Zkuste to prosím později.");
  }

  return page("Odhlášení proběhlo", "Už vám nebudeme posílat hromadné informační e-maily.");
});
