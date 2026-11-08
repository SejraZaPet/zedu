import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";
import type { WorksheetSpec } from "@/lib/worksheet-spec";
import StudentWorksheetPrintButtons from "@/components/worksheet/StudentWorksheetPrintButtons";
import type { MaterialWorksheet } from "@/lib/assignment-content";

/** Read-only material preview. Never passes an attempt, own work, or submit callback. */
export default function MaterialWorksheetsCard({ worksheets, qrPath }: { worksheets: MaterialWorksheet[]; qrPath?: string }) {
  const [selected, setSelected] = useState<MaterialWorksheet | null>(null);
  const [spec, setSpec] = useState<WorksheetSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const open = async (worksheet: MaterialWorksheet) => {
    setSelected(worksheet); setSpec(null); setError(false); setBusy(true);
    try {
      const { data, error: readError } = await supabase.from("worksheets").select("spec").eq("id", worksheet.id).maybeSingle();
      const result = data?.spec as unknown as WorksheetSpec | undefined;
      if (readError || !result?.version) setError(true);
      else setSpec(result);
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  if (!worksheets.length) return null;
  return <>
    <Card className="mb-4"><CardContent className="p-4 space-y-2">
      <h2 className="text-sm font-medium">Pracovní listy k otevření</h2>
      <ol className="space-y-2">{worksheets.map((w, i) => <li key={w.id} className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 flex-1 break-words text-sm">{i + 1}. {w.title}</span>
        <Button variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => open(w)} aria-label={`Otevřít list ${w.title}`}><FileText className="mr-2 h-4 w-4" />Otevřít list</Button>
        <StudentWorksheetPrintButtons worksheetId={w.id} qrPath={qrPath} title={w.title} />
      </li>)}</ol>
    </CardContent></Card>
    <Dialog open={!!selected} onOpenChange={(value) => { if (!value) setSelected(null); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="break-words pr-6">{selected?.title}</DialogTitle></DialogHeader>
        {spec && selected && <div className="flex flex-wrap gap-2"><StudentWorksheetPrintButtons worksheetId={selected.id} spec={spec} qrPath={qrPath} title={selected.title} /></div>}
        {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-label="Načítání listu" /> : error ? <div role="alert" className="space-y-3"><p>Pracovní list není dostupný. Zkus to znovu nebo se zeptej učitele.</p><Button variant="outline" className="min-h-11" onClick={() => { if (selected) void open(selected); }}>Zkusit znovu</Button></div> : spec && <iframe title={`Pracovní list ${selected?.title ?? ""}`} sandbox="" className="h-[65dvh] min-h-80 w-full border-0" srcDoc={renderWorksheetVariantHtml({ ...spec, answerKeys: {}, renderConfig: { ...spec.renderConfig, includeAnswerKey: false } }, spec.variants[0]?.variantId ?? "A", { teacherVersion: false }).replace("</head>", "<style>@media screen and (max-width: 794px) { .ws-page { width: 100%; margin: 0; padding: 16px 12px; } .ws-title-block { width: auto; } .ws-title { overflow-wrap: anywhere; font-size: 18pt; letter-spacing: 0; } .ws-header { table-layout: fixed; width: 100%; } }</style></head>")} />}
      </DialogContent>
    </Dialog>
  </>;
}