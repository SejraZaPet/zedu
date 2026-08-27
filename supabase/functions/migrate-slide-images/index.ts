// Jednorázová migrace: podepsané (vypršitelné) URL z privátního bucketu
// `teacher-media` ve slide datech nahradí trvalými veřejnými URL z `lesson-images`.
//
// Spuštění: POST /functions/v1/migrate-slide-images  { "dryRun": true }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_BUCKET = "teacher-media";
const TARGET_BUCKET = "lesson-images";

const TARGETS: { table: string; column: string }[] = [
  { table: "teacher_presentations", column: "slides" },
  { table: "lesson_plans", column: "slides" },
  { table: "teacher_textbook_lessons", column: "presentation_slides" },
  { table: "textbook_lessons", column: "presentation_slides" },
];

/** Najde všechny podepsané URL na teacher-media v serializovaných slide datech. */
function findSignedUrls(json: string): string[] {
  const re = new RegExp(
    `https?://[^"'\\\\\\s]*?/storage/v1/object/sign/${SOURCE_BUCKET}/[^"'\\\\\\s]+`,
    "g",
  );
  return Array.from(new Set(json.match(re) ?? []));
}

/** Z podepsané URL vytáhne cestu k souboru v bucketu. */
function storagePathFromSignedUrl(url: string): string {
  const marker = `/storage/v1/object/sign/${SOURCE_BUCKET}/`;
  const raw = url.slice(url.indexOf(marker) + marker.length);
  return decodeURIComponent(raw.split("?")[0]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = Boolean(body?.dryRun);
  } catch {
    // bez těla = skutečná migrace
  }

  const report = {
    dryRun,
    rowsUpdated: 0,
    urlsMigrated: 0,
    unresolved: [] as { table: string; id: string; url: string; reason: string }[],
    byTable: {} as Record<string, { rowsScanned: number; rowsUpdated: number; urls: number }>,
  };

  // Cache: storage_path -> public URL (stejný soubor se může opakovat)
  const migrated = new Map<string, string>();

  for (const { table, column } of TARGETS) {
    const stats = { rowsScanned: 0, rowsUpdated: 0, urls: 0 };
    report.byTable[table] = stats;

    const { data: rows, error } = await admin.from(table).select(`id, ${column}`);
    if (error) {
      report.unresolved.push({ table, id: "-", url: "-", reason: `Čtení tabulky: ${error.message}` });
      continue;
    }

    for (const row of rows ?? []) {
      stats.rowsScanned++;
      const value = (row as Record<string, unknown>)[column];
      if (!value) continue;
      let json = JSON.stringify(value);
      const urls = findSignedUrls(json);
      if (urls.length === 0) continue;

      let changed = false;
      for (const url of urls) {
        const path = storagePathFromSignedUrl(url);
        let publicUrl = migrated.get(path);

        if (!publicUrl) {
          const { data: file, error: dlErr } = await admin.storage.from(SOURCE_BUCKET).download(path);
          if (dlErr || !file) {
            report.unresolved.push({
              table,
              id: String((row as any).id),
              url,
              reason: `Originál nenalezen (${dlErr?.message ?? "prázdná odpověď"})`,
            });
            continue;
          }
          const ext = path.split(".").pop()?.toLowerCase() || "jpg";
          const targetPath = `presentations/migrated/${crypto.randomUUID()}.${ext}`;
          if (dryRun) {
            publicUrl = `DRY_RUN:${targetPath}`;
          } else {
            const { error: upErr } = await admin.storage
              .from(TARGET_BUCKET)
              .upload(targetPath, file, { contentType: file.type || "image/jpeg", upsert: false });
            if (upErr) {
              report.unresolved.push({
                table,
                id: String((row as any).id),
                url,
                reason: `Upload selhal: ${upErr.message}`,
              });
              continue;
            }
            publicUrl = admin.storage.from(TARGET_BUCKET).getPublicUrl(targetPath).data.publicUrl;
          }
          migrated.set(path, publicUrl);
        }

        if (publicUrl.startsWith("DRY_RUN:")) {
          stats.urls++;
          report.urlsMigrated++;
          changed = true;
          continue;
        }

        json = json.split(url).join(publicUrl);
        stats.urls++;
        report.urlsMigrated++;
        changed = true;
      }

      if (changed && !dryRun) {
        const { error: upErr } = await admin
          .from(table)
          .update({ [column]: JSON.parse(json) })
          .eq("id", (row as any).id);
        if (upErr) {
          report.unresolved.push({
            table,
            id: String((row as any).id),
            url: "-",
            reason: `Zápis selhal: ${upErr.message}`,
          });
          continue;
        }
      }
      if (changed) {
        stats.rowsUpdated++;
        report.rowsUpdated++;
      }
    }
  }

  console.log("migrate-slide-images report", JSON.stringify(report));
  return new Response(JSON.stringify(report, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
