// Odhlášení připomínek dema jedním kliknutím bez přihlášení: token z e-mailu → hash → smazání kontaktu.
// Odpověď je vždy stejná, aby neprozradila, zda token existoval.
import { adminClient } from "../_shared/demo.ts";
import { sha256Hex } from "../_shared/demo-contact.ts";

const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bezli – odhlášení</title></head>
<body style="font-family:Arial,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#1A1F2C;line-height:1.5">
<h1 style="font-size:22px">Hotovo</h1><p>Připomínky dema už vám neposíláme a váš e-mail jsme smazali.</p>
<p><a href="https://www.bezli.cz">Zpět na Bezli</a></p></body></html>`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const t = (url.searchParams.get("t") ?? "").trim();
  if (/^[a-f0-9]{48}$/.test(t)) {
    const hash = await sha256Hex(t);
    await adminClient().from("demo_contacts").delete().contains("unsubscribe_token_hashes", [hash]);
  }
  if (req.method === "POST") return new Response("ok", { status: 200 });
  return new Response(PAGE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
});
