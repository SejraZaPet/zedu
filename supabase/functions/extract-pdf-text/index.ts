// Server-side PDF text extraction fallback.
//
// Called by ImportTextbookFileDialog when the browser-side pdfjs pipeline
// returns 0 characters across ALL pages (typically PPT-exported PDFs with
// missing ToUnicode maps or embedded CID fonts).
//
// Strategy: shell out to `pdftotext -layout` (poppler-utils). Poppler has
// substantially better font/encoding heuristics than pdfjs. If poppler is
// not installed in the runtime, or extraction yields nothing, we return an
// empty result — the caller then falls back to the manual textarea UI.
//
// We do NOT ship any fake / regex-based text: better to tell the user
// clearly than to feed the AI garbage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BASE64_BYTES = 40 * 1024 * 1024; // ~30 MB decoded

interface PageText {
  pageNumber: number;
  text: string;
  charCount: number;
}

async function runPdftotext(inputPath: string): Promise<string> {
  // -layout: preserve columnar layout (tables). "-" writes to stdout.
  const cmd = new Deno.Command("pdftotext", {
    args: ["-layout", "-enc", "UTF-8", inputPath, "-"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    const err = new TextDecoder().decode(stderr);
    throw new Error(`pdftotext exit ${code}: ${err.slice(0, 500)}`);
  }
  return new TextDecoder().decode(stdout);
}

function splitPages(fullText: string): PageText[] {
  // pdftotext emits form-feed (\f) between pages.
  const parts = fullText.split(/\f/);
  const pages: PageText[] = [];
  parts.forEach((raw, i) => {
    const text = raw.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
    if (i === parts.length - 1 && text.length === 0) return; // trailing empty
    pages.push({ pageNumber: i + 1, text, charCount: text.length });
  });
  return pages;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { fileBase64?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fileBase64 = body?.fileBase64;
  if (typeof fileBase64 !== "string" || fileBase64.length === 0) {
    return new Response(JSON.stringify({ error: "fileBase64 required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (fileBase64.length > MAX_BASE64_BYTES) {
    return new Response(JSON.stringify({ error: "File too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let bytes: Uint8Array;
  try {
    const bin = atob(fileBase64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid base64" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tmpPath = `/tmp/extract-${crypto.randomUUID()}.pdf`;
  try {
    await Deno.writeFile(tmpPath, bytes);
    let raw = "";
    try {
      raw = await runPdftotext(tmpPath);
    } catch (err) {
      console.error("[extract-pdf-text] pdftotext failed:", err);
      return new Response(
        JSON.stringify({
          text: "",
          pages: [],
          error: "pdftotext_unavailable",
          detail: (err as Error)?.message?.slice(0, 300) ?? "unknown",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pages = splitPages(raw);
    const text = pages.map((p) => `--- Strana ${p.pageNumber} ---\n${p.text}`).join("\n\n").trim();

    return new Response(
      JSON.stringify({ text, pages }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[extract-pdf-text] unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: (err as Error)?.message?.slice(0, 300) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    try {
      await Deno.remove(tmpPath);
    } catch {
      /* ignore */
    }
  }
});
