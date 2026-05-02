import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSubjects } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

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
  const { data: subjects } = useSubjects(true);

  const [mode, setMode] = useState<"existing" | "custom">("existing");
  const [subjectId, setSubjectId] = useState<string>("");
  const [customSubject, setCustomSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grades, setGrades] = useState<{ grade_number: number; label: string }[]>([
    { grade_number: 1, label: "1. ročník" },
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("existing");
      setSubjectId(subjects?.[0]?.id ?? "");
      setCustomSubject("");
      setTitle("");
      setDescription("");
      setGrades([{ grade_number: 1, label: "1. ročník" }]);
    }
  }, [open, subjects]);

  const addGradeRow = () => {
    setGrades((prev) => {
      const next = prev.length > 0 ? Math.max(...prev.map((g) => g.grade_number)) + 1 : 1;
      return [...prev, { grade_number: next, label: `${next}. ročník` }];
    });
  };

  const updateGradeRow = (idx: number, patch: Partial<{ grade_number: number; label: string }>) => {
    setGrades((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  };

  const removeGradeRow = (idx: number) => {
    setGrades((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Chyba", description: "Nejste přihlášen/a.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      let subjectSlug = "";
      let subjectLabel = "";

      if (mode === "existing") {
        const sel = subjects?.find((s) => s.id === subjectId);
        if (!sel) {
          toast({ title: "Chyba", description: "Vyberte předmět.", variant: "destructive" });
          setCreating(false);
          return;
        }
        subjectSlug = sel.slug;
        subjectLabel = sel.label;

        const { data: existing } = await supabase
          .from("teacher_textbooks")
          .select("id")
          .eq("teacher_id", session.user.id)
          .eq("subject", subjectSlug)
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
      } else {
        const label = customSubject.trim();
        if (!label) {
          toast({ title: "Chyba", description: "Zadejte název vlastního předmětu.", variant: "destructive" });
          setCreating(false);
          return;
        }
        if (grades.length === 0) {
          toast({ title: "Chyba", description: "Přidejte alespoň jeden ročník.", variant: "destructive" });
          setCreating(false);
          return;
        }
        subjectLabel = label;
        subjectSlug = slugify(label);

        const { data: existingSubj } = await supabase
          .from("textbook_subjects")
          .select("id")
          .eq("slug", subjectSlug)
          .maybeSingle();

        if (existingSubj) {
          toast({
            title: "Předmět existuje",
            description: "Předmět s tímto názvem již existuje. Vyberte ho ze seznamu.",
            variant: "destructive",
          });
          setCreating(false);
          return;
        }

        const { data: createdSubj, error: subjErr } = await supabase
          .from("textbook_subjects")
          .insert({
            slug: subjectSlug,
            label: subjectLabel,
            abbreviation: "",
            description: "",
            color: "#6EC6D9",
            active: true,
            sort_order: subjects?.length ?? 0,
          })
          .select("id")
          .single();
        if (subjErr) throw subjErr;

        await supabase.from("textbook_grades").insert(
          grades.map((g, i) => ({
            subject_id: createdSubj.id,
            grade_number: g.grade_number,
            label: g.label.trim() || `${g.grade_number}. ročník`,
            sort_order: i,
          })),
        );
      }

      const { error: tbErr } = await supabase.from("teacher_textbooks").insert({
        title: title.trim() || subjectLabel,
        description: description.trim() || `Učebnice předmětu ${subjectLabel}`,
        subject: subjectSlug,
        teacher_id: session.user.id,
        access_code: generateAccessCode(),
      } as any);
      if (tbErr) throw tbErr;

      toast({ title: "Učebnice vytvořena" });
      queryClient.invalidateQueries({ queryKey: ["textbook-subjects"] });
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
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")} className="flex-1" type="button">
              Vybrat předmět
            </Button>
            <Button size="sm" variant={mode === "custom" ? "default" : "outline"} onClick={() => setMode("custom")} className="flex-1" type="button">
              Vlastní předmět
            </Button>
          </div>

          {mode === "existing" ? (
            <div>
              <Label>Předmět *</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Vyberte předmět…" />
                </SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjectId && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {subjects?.find((s) => s.id === subjectId)?.grades.map((g) => (
                    <Badge key={g.id} variant="secondary" className="text-[10px]">{g.label}</Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label>Název vlastního předmětu *</Label>
                <Input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} className="mt-1" placeholder="např. Robotika" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Ročníky *</Label>
                  <Button size="sm" variant="ghost" type="button" onClick={addGradeRow} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" /> Přidat
                  </Button>
                </div>
                <div className="space-y-2">
                  {grades.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="number" min={1} max={20} value={g.grade_number}
                        onChange={(e) => updateGradeRow(i, { grade_number: parseInt(e.target.value, 10) || 1 })}
                        className="w-20" />
                      <Input value={g.label} onChange={(e) => updateGradeRow(i, { label: e.target.value })}
                        placeholder={`${g.grade_number}. ročník`} className="flex-1" />
                      <Button size="icon" variant="ghost" type="button" onClick={() => removeGradeRow(i)}
                        className="h-9 w-9 shrink-0" disabled={grades.length <= 1}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

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
            <Button onClick={handleCreate}
              disabled={creating || (mode === "existing" && !subjectId) || (mode === "custom" && !customSubject.trim())}
              className="flex-1" type="button">
              {creating ? "Vytvářím…" : "Vytvořit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTextbookDialog;
