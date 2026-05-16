import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";
import { Loader2, Upload, FileText, Trash2, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface TopicOption {
  id: string;
  title: string;
  gradeLabel?: string;
}

interface DraftLesson {
  id: string;
  title: string;
  blocks: Block[];
  include: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topics: TopicOption[];
  defaultTopicId?: string;
  onImported: () => void;
}

const ACCEPT = ".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_BYTES = 25 * 1024 * 1024;

const readFileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
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

const ImportTextbookFileDialog = ({
  open, onOpenChange, topics, defaultTopicId, onImported,
}: Props) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [drafts, setDrafts] = useState<DraftLesson[]>([]);
  const [topicId, setTopicId] = useState<string>(defaultTopicId ?? "");
  const [saving, setSaving] = useState(false);
  const [singleLesson, setSingleLesson] = useState(true);
  const [progress, setProgress] = useState<string>("");

  const reset = () => {
    setFile(null);
    setDrafts([]);
    setProcessing(false);
    setSaving(false);
    setProgress("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleProcess = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ title: "Soubor je příliš velký", description: "Maximálně 25 MB.", variant: "destructive" });
      return;
    }

    setProcessing(true);
    setProgress("Načítám soubor...");

    try {
      const base64 = await readFileAsBase64(file);

      setProgress("AI analyzuje dokument...");
      const { data, error } = await supabase.functions.invoke("process-file-content", {
        body: {
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          mode: singleLesson ? "single" : "split",
        },
      });

      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error: string }).error);
      }

      const response = (data ?? {}) as {
        lessons?: { title?: string; blocks?: Block[] }[];
        blocks?: Block[];
        blockCount?: number;
      };

      const lessons = Array.isArray(response.lessons)
        ? response.lessons
        : response.blocks
          ? [{ title: file.name.replace(/\.(pdf|pptx|docx)$/i, ""), blocks: response.blocks }]
          : [];

      const normalizedLessons = lessons
        .map((lesson, index) => ({
          id: `draft-${index}-${Date.now()}`,
          title: (lesson.title || file.name.replace(/\.(pdf|pptx|docx)$/i, "")).trim() || `Lekce ${index + 1}`,
          blocks: Array.isArray(lesson.blocks) ? lesson.blocks : [],
          include: true,
        }))
        .filter((lesson) => lesson.blocks.length > 0);

      if (normalizedLessons.length === 0) {
        throw new Error("AI nedokázala z dokumentu extrahovat žádné editovatelné bloky.");
      }

      const totalBlocks = normalizedLessons.reduce((sum, lesson) => sum + lesson.blocks.length, 0);
      setDrafts(normalizedLessons);
      toast({
        title: "Import dokončen",
        description: `Import dokončen: ${totalBlocks} bloků vytvořeno`,
      });
    } catch (err: any) {
      console.error("Import error:", err);
      toast({
        title: "Import selhal",
        description: err?.message || "Neznámá chyba",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setProgress("");
    }
  };

  const updateDraft = (id: string, patch: Partial<DraftLesson>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    const toImport = drafts.filter((d) => d.include && d.title.trim() && d.blocks.length > 0);
    if (toImport.length === 0) {
      toast({ title: "Není co uložit", description: "Vyberte alespoň jednu lekci.", variant: "destructive" });
      return;
    }
    if (!topicId) {
      toast({ title: "Vyberte téma", description: "Lekce musí být zařazené pod téma.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("textbook_lessons")
        .select("sort_order")
        .eq("topic_id", topicId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let nextOrder = existing && existing.length > 0 ? ((existing[0] as { sort_order?: number }).sort_order ?? 0) + 1 : 0;

      const payload = toImport.map((draft) => ({
        title: draft.title.trim().slice(0, 200),
        topic_id: topicId,
        sort_order: nextOrder++,
        blocks: draft.blocks as any,
        status: "draft",
      }));

      const { error } = await supabase.from("textbook_lessons").insert(payload);
      if (error) throw error;

      toast({ title: "Importováno", description: `Vytvořeno ${payload.length} lekcí.` });
      reset();
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      toast({ title: "Uložení selhalo", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Importovat soubor do učebnice
          </DialogTitle>
          <DialogDescription>
            Nahrajte PDF, DOCX nebo PPTX. AI přečte soubor a připraví editovatelné bloky, které si můžete před uložením upravit.
          </DialogDescription>
        </DialogHeader>

        {drafts.length === 0 ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={processing}
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-2">
                  {file.name} ({(file.size / 1024).toFixed(0)} kB)
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Podporované formáty: PDF, DOCX, PPTX. Maximálně 25 MB. Soubor se bezpečně odešle do backendu k AI analýze.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="single-lesson-toggle" className="text-sm">
                  Importovat jako jednu lekci
                </Label>
                <p className="text-xs text-muted-foreground">
                  {singleLesson
                    ? "Všechny stránky souboru se sloučí do jedné scrollovatelné lekce."
                    : "AI zkusí obsah rozdělit do více samostatných lekcí."}
                </p>
              </div>
              <Switch
                id="single-lesson-toggle"
                checked={singleLesson}
                onCheckedChange={setSingleLesson}
                disabled={processing}
              />
            </div>

            {processing && progress && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progress}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)} disabled={processing}>
                Zrušit
              </Button>
              <Button onClick={handleProcess} disabled={!file || processing}>
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI analyzuje dokument...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Zpracovat pomocí AI</>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Téma, do kterého importovat</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte téma" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.gradeLabel ? `${t.gradeLabel} – ${t.title}` : t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Návrhy lekcí ({drafts.filter((d) => d.include).length}/{drafts.length})
              </p>
              <Accordion type="multiple" className="border border-border rounded-lg">
                {drafts.map((d) => (
                  <AccordionItem key={d.id} value={d.id} className="px-3">
                    <div className="flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        checked={d.include}
                        onChange={(e) => updateDraft(d.id, { include: e.target.checked })}
                        className="w-4 h-4"
                        aria-label="Zahrnout lekci"
                      />
                      <Input
                        value={d.title}
                        onChange={(e) => updateDraft(d.id, { title: e.target.value })}
                        className="h-8 flex-1"
                        placeholder="Název lekce"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {d.blocks.length} bloků
                      </span>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                        title="Odstranit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <AccordionTrigger className="text-xs text-muted-foreground py-1">
                      Upravit obsah
                    </AccordionTrigger>
                    <AccordionContent>
                      <BlockEditor
                        blocks={d.blocks}
                        onChange={(blocks) => updateDraft(d.id, { blocks })}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={reset} disabled={saving}>
                Zpět
              </Button>
              <Button onClick={handleSave} disabled={saving || !topicId}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ukládám…</>
                ) : (
                  <>Uložit lekce</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportTextbookFileDialog;
