import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { parsePptxFileToSlides } from "@/lib/pptx-import";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";

const ACCEPT =
  ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Vrací nové slidy, které se PŘIDAJÍ na konec prezentace. */
  onImported: (slides: any[]) => void;
  /** Téma prezentace, aby importované slidy vypadaly konzistentně. */
  themeId?: string;
}

const ImportPptxToPresentationDialog = ({ open, onOpenChange, onImported, themeId }: Props) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");

  const close = (v: boolean) => {
    if (!v) {
      setFile(null);
      setProcessing(false);
      setProgress("");
    }
    onOpenChange(v);
  };

  const handleImport = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ title: "Soubor je příliš velký", description: "Maximálně 25 MB.", variant: "destructive" });
      return;
    }

    setProcessing(true);
    setProgress("Čtu snímky prezentace…");
    try {
      const slides = await parsePptxFileToSlides(file, themeId);

      onImported(slides);
      toast({
        title: "Import hotový",
        description: `Importováno ${slides.length} snímků z PPTX (1 snímek = 1 slide).`,
      });
      close(false);
    } catch (e: any) {
      toast({
        title: "Import se nepodařil",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Importovat prezentaci (.pptx)
          </DialogTitle>
          <DialogDescription>
            Snímky se přidají na konec rozdělané prezentace, stávající obsah zůstane zachovaný.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Přenesou se texty, každý snímek prezentace vznikne jako jeden slide. Rozvržení, fonty
              a animace z PowerPointu nelze přenést. Obrázky zatím nepřenášíme.
            </p>
          </div>

          <div>
            <Label className="text-xs" htmlFor="pptx-import-file">Soubor .pptx (max 25 MB)</Label>
            <Input
              id="pptx-import-file"
              type="file"
              accept={ACCEPT}
              className="mt-1"
              disabled={processing}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {progress && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progress}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={processing}>Zrušit</Button>
          <Button onClick={handleImport} disabled={!file || processing} className="gap-1.5">
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Importovat snímky
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportPptxToPresentationDialog;
