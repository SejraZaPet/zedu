import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPortfolioAttachment, PortfolioItemType } from "@/lib/portfolio";

interface Props {
  studentId: string;
  defaultType?: PortfolioItemType;
  triggerLabel?: string;
  onAdded?: () => void;
}

const MAX_SIZE = 20 * 1024 * 1024;

export default function AddPortfolioItemDialog({
  studentId, defaultType = "project", triggerLabel = "Přidat položku", onAdded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PortfolioItemType>(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setType(defaultType); setTitle(""); setDescription("");
    setSubject(""); setFiles([]);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.filter((f) => f.size > MAX_SIZE);
    if (tooBig.length) {
      toast.error(`Tyto soubory jsou větší než 20 MB: ${tooBig.map((f) => f.name).join(", ")}`);
    }
    const ok = picked.filter((f) => f.size <= MAX_SIZE);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...ok.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Vyplň název"); return; }
    setBusy(true);
    try {
      const uploaded: { file: File; path: string }[] = [];
      for (const f of files) {
        const path = await uploadPortfolioAttachment(studentId, f);
        uploaded.push({ file: f, path });
      }

      const { data: inserted, error } = await supabase
        .from("student_portfolio_items")
        .insert({
          student_id: studentId,
          type,
          title: title.trim(),
          description: description.trim() || null,
          subject: subject.trim() || null,
          attachment_url: uploaded[0]?.path ?? null,
          content_json: {},
        })
        .select("id")
        .single();
      if (error) throw error;

      if (uploaded.length > 0 && inserted?.id) {
        const { error: filesError } = await supabase
          .from("student_portfolio_files" as any)
          .insert(
            uploaded.map((u, i) => ({
              portfolio_item_id: inserted.id,
              file_name: u.file.name,
              file_url: u.path,
              file_type: u.file.type || "application/octet-stream",
              sort_order: i,
            })) as any,
          );
        if (filesError) throw filesError;
      }

      toast.success(
        uploaded.length > 1
          ? `Položka přidána s ${uploaded.length} soubory`
          : "Položka přidána",
      );
      reset();
      setOpen(false);
      onAdded?.();
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se přidat");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="w-4 h-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nová položka portfolia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as PortfolioItemType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="worksheet_result">Pracovní list</SelectItem>
                <SelectItem value="project">Projekt</SelectItem>
                <SelectItem value="reflection">Reflexe</SelectItem>
                <SelectItem value="upload">Nahraný soubor</SelectItem>
                <SelectItem value="achievement">Úspěch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pf-title">Název *</Label>
            <Input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="pf-subject">Předmět</Label>
            <Input id="pf-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="např. Matematika" />
          </div>
          <div>
            <Label htmlFor="pf-desc">Popis</Label>
            <Textarea id="pf-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {type !== "reflection" && (
            <div>
              <Label htmlFor="pf-file">Přílohy</Label>
              <Input
                id="pf-file"
                type="file"
                multiple
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Můžeš vybrat víc souborů nebo fotek, každá do 20 MB.
              </p>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        aria-label={`Odebrat ${f.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Ukládám…" : "Přidat"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
