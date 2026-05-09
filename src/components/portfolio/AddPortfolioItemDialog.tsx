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
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPortfolioAttachment, PortfolioItemType } from "@/lib/portfolio";

interface Props {
  studentId: string;
  defaultType?: PortfolioItemType;
  triggerLabel?: string;
  onAdded?: () => void;
}

export default function AddPortfolioItemDialog({
  studentId, defaultType = "project", triggerLabel = "Přidat položku", onAdded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PortfolioItemType>(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setType(defaultType); setTitle(""); setDescription("");
    setSubject(""); setFile(null);
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Vyplň název"); return; }
    setBusy(true);
    try {
      let attachment_url: string | null = null;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error("Soubor je větší než 20 MB");
        attachment_url = await uploadPortfolioAttachment(studentId, file);
      }
      const { error } = await supabase.from("student_portfolio_items").insert({
        student_id: studentId,
        type,
        title: title.trim(),
        description: description.trim() || null,
        subject: subject.trim() || null,
        attachment_url,
        content_json: {},
      });
      if (error) throw error;
      toast.success("Položka přidána");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nová položka portfolia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as PortfolioItemType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
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
              <Label htmlFor="pf-file">Příloha</Label>
              <Input
                id="pf-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground mt-1">Max. 20 MB.</p>
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
