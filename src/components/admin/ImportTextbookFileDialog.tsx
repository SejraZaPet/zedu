import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { extractTextFromFile } from "@/lib/file-import-processor";

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

  const reset = () => {
    setFile(null);
    setDrafts([]);
    setProcessing(false);
    setSaving(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleProcess = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ title: "Soubor je příliš velký", description: "Maximálně 15 MB.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("import-textbook-file", {
        body: { fileBase64, filename: file.name, mimeType: file.type, mode: singleLesson ? "single" : "split" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const lessons = ((data as any).lessons ?? []) as { title: string; blocks: Block[] }[];
      const totalBlocks = lessons.reduce((sum, l) => sum + (l.blocks?.length ?? 0), 0);
      setDrafts(lessons.map((l, i) => ({
        id: `draft-${i}-${Date.now()}`,
        title: l.title,
        blocks: l.blocks,
        include: true,
      })));
      toast({
        title: "Import dokončen",
        description: singleLesson
          ? `Vytvořeno ${totalBlocks} bloků v 1 lekci. Můžete je upravit před uložením.`
          : `${lessons.length} návrhů lekcí, celkem ${totalBlocks} bloků.`,
      });
    } catch (err: any) {
      toast({ title: "Import selhal", description: err.message ?? "Neznámá chyba", variant: "destructive" });
    } finally {
      setProcessing(false);
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
      let nextOrder = existing && existing.length > 0 ? ((existing[0] as any).sort_order ?? 0) + 1 : 0;

      const payload = toImport.map((d) => ({
        title: d.title.trim().slice(0, 200),
        topic_id: topicId,
        sort_order: nextOrder++,
        blocks: d.blocks as any,
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
            Nahrajte PDF, DOCX nebo PPTX. AI rozdělí obsah na lekce, které si můžete před uložením upravit.
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
                Podporované formáty: PDF, DOCX, PPTX. Maximálně 15 MB.
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
                    : "Každá stránka/sekce se vytvoří jako samostatná lekce."}
                </p>
              </div>
              <Switch
                id="single-lesson-toggle"
                checked={singleLesson}
                onCheckedChange={setSingleLesson}
                disabled={processing}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)} disabled={processing}>
                Zrušit
              </Button>
              <Button onClick={handleProcess} disabled={!file || processing}>
                {processing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI analyzuje dokument…</>
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
                {drafts.map((d, i) => (
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
