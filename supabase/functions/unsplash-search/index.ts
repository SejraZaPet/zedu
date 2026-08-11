// Proxy hledání fotek na Unsplash. Klíč zůstává na serveru.
// Vyžaduje secret UNSPLASH_ACCESS_KEY; bez něj vrací 503 s vysvětlením.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { requireAuth } = await import("../_shared/auth.ts");
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!ACCESS_KEY) {
      return new Response(
        JSON.stringify({
          error: "not_configured",
          message: "Hledání fotek není nastavené. Doplňte prosím secret UNSPLASH_ACCESS_KEY.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const query = String(body.query ?? "").trim().slice(0, 120);
    const page = Math.min(Math.max(Number(body.page) || 1, 1), 10);
    if (!query) {
      return new Response(JSON.stringify({ error: "Zadejte hledaný výraz." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "24");
    url.searchParams.set("page", String(page));
    url.searchParams.set("content_filter", "high");

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}`, "Accept-Version": "v1" },
    });

    if (!resp.ok) {
      console.error("unsplash error", resp.status, await resp.text());
      return new Response(JSON.stringify({ error: "Hledání fotek se nepodařilo." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const results = (data?.results ?? []).map((r: any) => ({
      id: r.id,
      thumb: r.urls?.small,
      full: r.urls?.regular,
      alt: r.alt_description || r.description || "",
      authorName: r.user?.name || "",
      authorLink: r.user?.links?.html || "",
      link: r.links?.html || "",
    }));

    return new Response(JSON.stringify({ results, total: data?.total ?? results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("unsplash-search error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
