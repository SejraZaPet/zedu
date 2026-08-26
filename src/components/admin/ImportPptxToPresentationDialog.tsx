import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Block } from "@/lib/textbook-config";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";

const ACCEPT =
  ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_BYTES = 25 * 1024 * 1024;

/** Typy bloků, které umí plátno prezentace bezpečně vykreslit. */
const SUPPORTED_BLOCK_TYPES = new Set([
  "heading", "paragraph", "bullet_list", "image", "quote", "callout", "table",
  "chart", "formula", "video", "audio", "divider",
]);

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      if (!base64) {
        reject(new Error("Soubor se nepodařilo převést do base64."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Nelze načíst soubor."));
    reader.readAsDataURL(file);
  });

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
    setProgress("Načítám soubor…");
    try {
      const base64 = await readFileAsBase64(file);
      setProgress("Analyzuji snímky prezentace…");
      const { data, error } = await supabase.functions.invoke("process-file-content", {
        body: {
          fileBase64: base64,
          fileName: file.name,
          mimeType:
            file.type ||
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          // "split" = rozděl obsah po snímcích (1 snímek = 1 slide)
          mode: "split",
        },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      const response = (data ?? {}) as {
        lessons?: { title?: string; blocks?: Block[] }[];
        blocks?: Block[];
        embeddedImagesBySlide?: { slideNumber: number; urls: string[] }[];
      };

      const baseTitle = file.name.replace(/\.pptx$/i, "");
      const rawUnits = Array.isArray(response.lessons) && response.lessons.length > 0
        ? response.lessons
        : Array.isArray(response.blocks) && response.blocks.length > 0
          ? [{ title: baseTitle, blocks: response.blocks }]
          : [];

      if (rawUnits.length === 0) {
        throw new Error("V souboru se nepodařilo najít žádný text ani obrázky.");
      }

      const imagesBySlide = new Map<number, string[]>();
      for (const entry of response.embeddedImagesBySlide ?? []) {
        if (!entry || typeof entry.slideNumber !== "number" || !Array.isArray(entry.urls)) continue;
        imagesBySlide.set(entry.slideNumber, entry.urls);
      }

      const slides = rawUnits.map((unit, idx) => {
        const heroImage = imagesBySlide.get(idx + 1)?.[0];
        const blocks: Block[] = (Array.isArray(unit.blocks) ? unit.blocks : [])
          .filter((b) => b && SUPPORTED_BLOCK_TYPES.has(String(b.type)) && b.type !== "divider")
          .map((b) => ({
            id: crypto.randomUUID(),
            type: b.type,
            visible: b.visible !== false,
            props: b.props && typeof b.props === "object" ? b.props : {},
          }) as Block);

        // Zbylé obrázky snímku doplň jako samostatné bloky.
        const extraImages = (imagesBySlide.get(idx + 1) ?? []).slice(1).map(
          (url) =>
            ({
              id: crypto.randomUUID(),
              type: "image",
              visible: true,
              props: { url, caption: "", width: "medium", alignment: "center" },
            }) as Block,
        );

        return {
          slideId: crypto.randomUUID(),
          type: "explain",
          projector: { headline: (unit.title || `Snímek ${idx + 1}`).trim(), body: "" },
          device: { instructions: "Sledujte projektor." },
          blocks: [...blocks, ...extraImages],
          layout: heroImage ? "img-right" : "full",
          ...(heroImage ? { heroImage } : {}),
          ...(themeId ? { themeId } : {}),
        };
      });

      onImported(slides);
      toast({
        title: "Import hotový",
        description: `Importováno ${slides.length} snímků z PPTX.`,
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
              Přenesou se texty a obrázky. Přesné rozvržení, fonty a animace z PowerPointu nelze
              přenést.
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
