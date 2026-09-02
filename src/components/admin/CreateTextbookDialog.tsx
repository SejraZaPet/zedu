import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SubjectPicker from "@/components/subjects/SubjectPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

const generateAccessCode = (length = 6): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < length; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return r;
};

const slugify = (label: string): string =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const CreateTextbookDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSubjectId(null);
      setSubjectName("");
      setTitle("");
      setDescription("");
    }
  }, [open]);

  const handleCreate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Chyba", description: "Nejste přihlášen/a.", variant: "destructive" });
      return;
    }
    if (!subjectName.trim()) {
      toast({ title: "Chyba", description: "Vyberte předmět.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const subjectLabel = subjectName.trim();
      const subjectSlug = slugify(subjectLabel);

      const { data: existing } = await supabase
        .from("teacher_textbooks")
        .select("id")
        .eq("teacher_id", session.user.id)
        .eq("subject", subjectSlug)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) {
        toast({
          title: "Učebnice již existuje",
          description: `Pro předmět „${subjectLabel}" už máte vytvořenou učebnici.`,
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      // Dual write: canonical subject_id + legacy text slug
      const { error: tbErr } = await supabase.from("teacher_textbooks").insert({
        title: title.trim() || subjectLabel,
        description: description.trim() || `Učebnice předmětu ${subjectLabel}`,
        subject: subjectSlug,
        subject_id: subjectId,
        teacher_id: session.user.id,
        access_code: generateAccessCode(),
      } as any);
      if (tbErr) throw tbErr;

      toast({ title: "Učebnice vytvořena" });
      queryClient.invalidateQueries({ queryKey: ["textbook-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects-catalog"] });
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message ?? "Nepodařilo se vytvořit učebnici.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nová učebnice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Předmět *</Label>
            <div className="mt-1">
              <SubjectPicker
                value={subjectId}
                textValue={subjectName}
                onChange={({ subjectId: id, name }) => {
                  setSubjectId(id);
                  setSubjectName(name);
                }}
                placeholder="Vyberte nebo založte předmět…"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nový předmět můžete založit rovnou zde — přidá se do katalogu předmětů.
            </p>
          </div>

          <div>
            <Label>Název učebnice</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1"
              placeholder="Pokud nevyplníte, použije se název předmětu" />
          </div>

          <div>
            <Label>Popis (nepovinné)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2}
              placeholder="Krátký popis učebnice…" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" type="button">
              Zrušit
            </Button>
            <Button onClick={handleCreate} disabled={creating || !subjectName.trim()} className="flex-1" type="button">
              {creating ? "Vytvářím…" : "Vytvořit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTextbookDialog;
