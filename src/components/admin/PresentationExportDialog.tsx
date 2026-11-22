import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { exportPresentationToPptx } from "@/lib/presentation-pptx-export";
import { FileDown, FileText, Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; slides: any[]; title: string; onExportPdf: () => Promise<void> }

export default function PresentationExportDialog({ open, onOpenChange, slides, title, onExportPdf }: Props) {
  const [busy, setBusy] = useState<"pptx" | "pdf" | "print" | null>(null); const { toast } = useToast();
  const run = async (kind: "pptx" | "pdf" | "print") => {
    setBusy(kind);
    try {
      if (kind === "pptx") await exportPresentationToPptx(slides, title); else await onExportPdf();
      if (kind === "print") toast({ title: "PDF pro tisk je stažené", description: "Otevřete jej a zvolte Tisk v prohlížeči nebo čtečce PDF." });
    } catch (error: any) { toast({ title: "Export se nepodařil", description: error?.message || String(error), variant: "destructive" }); }
    finally { setBusy(null); }
  };
  return <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Export / Tisk</DialogTitle><DialogDescription>Vyberte formát celé prezentace. Poznámky řečníka zůstanou v PPTX v notes, ne na slidu pro žáky.</DialogDescription></DialogHeader><div className="grid gap-3">
    <Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" disabled={!!busy} onClick={() => run("pptx")}>{busy === "pptx" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}<span className="text-left"><strong className="block">PowerPoint (.pptx)</strong><span className="text-xs text-muted-foreground">Upravitelné texty, tvary, obrázky, aktivity a poznámky</span></span></Button>
    <Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" disabled={!!busy} onClick={() => run("pdf")}>{busy === "pdf" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}<span className="text-left"><strong className="block">PDF</strong><span className="text-xs text-muted-foreground">Věrné vykreslení stejného plátna jako v editoru</span></span></Button>
    <Button variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4" disabled={!!busy} onClick={() => run("print")}>{busy === "print" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}<span className="text-left"><strong className="block">Tisk přes PDF</strong><span className="text-xs text-muted-foreground">Stáhne PDF připravené k vytištění</span></span></Button>
  </div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>Zavřít</Button></DialogFooter></DialogContent></Dialog>;
}
