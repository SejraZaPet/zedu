import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { parsePptxFileToSlides } from "@/lib/pptx-import";
import { importRichPptx } from "@/lib/pptx-rich-import";
import { importPdfPresentation, PDF_IMPORT_MAX_PAGES, type PdfImportMode } from "@/lib/pdf-presentation-import";
import type { PresentationImportSummary } from "@/lib/presentation-import-types";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";

const ACCEPT = ".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_BYTES = 60 * 1024 * 1024;
interface Props { open: boolean; onOpenChange: (v: boolean) => void; onImported: (slides: any[]) => void; themeId?: string; userId?: string }

const ImportPptxToPresentationDialog = ({ open, onOpenChange, onImported, themeId, userId }: Props) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null); const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: "" });
  const [mode, setMode] = useState<PdfImportMode>("images"); const [summary, setSummary] = useState<PresentationImportSummary | null>(null);
  const isPdf = !!file && (/\.pdf$/i.test(file.name) || file.type === "application/pdf");
  const close = (v: boolean) => { if (processing) return; if (!v) { setFile(null); setSummary(null); setProgress({ current: 0, total: 0, message: "" }); } onOpenChange(v); };
  const choose = (next: File | null) => { setFile(next); setSummary(null); setProgress({ current: 0, total: 0, message: "" }); };

  const handleImport = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) { toast({ title: "Soubor je příliš velký", description: "PPTX i PDF mohou mít maximálně 60 MB.", variant: "destructive" }); return; }
    setProcessing(true); setSummary(null); setProgress({ current: 0, total: 0, message: isPdf ? "Otevírám PDF…" : "Čtu prezentaci a motiv…" });
    try {
      if (isPdf) {
        const result = await importPdfPresentation(file, { mode, userId: userId, onProgress: setProgress });
        onImported(result.slides); setSummary(result.summary);
      } else {
        try {
          const result = await importRichPptx(file, { themeId, userId: userId, onProgress: setProgress });
          onImported(result.slides); setSummary(result.summary);
        } catch (richError: any) {
          console.warn("Věrný PPTX import selhal, používám původní textový parser", richError);
          setProgress({ current: 0, total: 0, message: "Věrný import se nepodařil, zkouším bezpečný textový import…" });
          const slides = await parsePptxFileToSlides(file, themeId); onImported(slides);
          setSummary({ slideCount: slides.length, textElements: slides.reduce((n, s) => n + (s.blocks?.length || 0), 0), shapes: 0, images: 0, notes: 0, fallbackUsed: true, warnings: [`Věrný import se nepodařil (${richError?.message || "neznámá chyba"}). Použit původní textový import; rozvržení a obrázky je potřeba zkontrolovat.`] });
        }
      }
      toast({ title: "Import hotový", description: "Slidy byly přidány na konec prezentace. Zkontrolujte souhrn importu." });
    } catch (e: any) { toast({ title: "Import se nepodařil", description: e?.message ?? String(e), variant: "destructive" }); }
    finally { setProcessing(false); }
  };

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" /> Import .pptx / PDF</DialogTitle><DialogDescription>Slidy se přidají na konec rozdělané prezentace. Stávající obsah zůstane zachovaný.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div><Label className="text-xs" htmlFor="pptx-import-file">PowerPoint nebo PDF (max. 60 MB)</Label><Input id="pptx-import-file" type="file" accept={ACCEPT} className="mt-1" disabled={processing} onChange={(e) => choose(e.target.files?.[0] ?? null)} /><p className="mt-1 text-xs text-muted-foreground">PPTX zůstane upravitelný. PDF může mít nejvýše {PDF_IMPORT_MAX_PAGES} stran. Animace se nepřenášejí.</p></div>
        {isPdf && <fieldset className="space-y-2 rounded-xl border border-deck-line p-3"><legend className="px-1 text-sm font-semibold">Co vytvořit z PDF</legend><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="pdf-mode" checked={mode === "images"} onChange={() => setMode("images")} /> Jen obrázky stránek – nejvěrnější</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="pdf-mode" checked={mode === "images-text"} onChange={() => setMode("images-text")} /> Obrázky + upravitelný text z textové vrstvy</label></fieldset>}
        {processing && <div className="space-y-2" aria-live="polite"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress.message || "Zpracovávám…"}</p>{progress.total > 0 && <Progress value={progress.current / progress.total * 100} aria-label="Postup importu" />}</div>}
        {summary && <section className="space-y-2 rounded-xl border border-deck-line bg-deck-soft p-4" aria-label="Souhrn importu"><h3 className="flex items-center gap-2 font-semibold text-deck-violet-deep"><CheckCircle2 className="h-4 w-4" />Importováno {summary.slideCount} slidů</h3><p className="text-sm">Textové prvky: {summary.textElements} · Tvary: {summary.shapes} · Obrázky: {summary.images} · Slidy s poznámkami: {summary.notes}</p>{summary.editableTextLayers !== undefined && <p className="text-sm">Upravitelných textů z PDF: {summary.editableTextLayers}</p>}{summary.fallbackUsed && <p className="text-sm font-semibold">Byla použita záložní textová cesta.</p>}{summary.warnings.length > 0 && <div className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><ul className="list-disc pl-4">{summary.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}</section>}
      </div>
      <DialogFooter><Button variant="ghost" onClick={() => close(false)} disabled={processing}>Zavřít</Button><Button onClick={handleImport} disabled={!file || processing || !!summary} className="gap-1.5">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Importovat snímky</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};
export default ImportPptxToPresentationDialog;
