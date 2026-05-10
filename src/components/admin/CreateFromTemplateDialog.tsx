import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubjects } from "@/hooks/useSubjects";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ArrowLeft, BookOpen } from "lucide-react";
import { createTextbookFromTemplate, type TextbookTemplate } from "@/lib/textbook-templates";

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

const CreateFromTemplateDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: subjects } = useSubjects(true);

  const [step, setStep] = useState<"pick" | "form">("pick");
  const [templates, setTemplates] = useState<TextbookTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TextbookTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [grade, setGrade] = useState<number>(1);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setSelected(null);
    setTitle("");
    setSubjectId(subjects?.[0]?.id ?? "");
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("textbook_templates")
        .select("*")
        .order("is_public", { ascending: false })
        .order("created_at", { ascending: false });
      setTemplates((data ?? []) as any);
      setLoading(false);
    })();
  }, [open, subjects]);

  const handlePick = (tpl: TextbookTemplate) => {
    setSelected(tpl);
    setTitle(tpl.name);
    setStep("form");
  };

  const handleCreate = async () => {
    if (!selected) return;
    const subj = subjects?.find((s) => s.id === subjectId);
    if (!subj) {
      toast({ title: "Chyba", description: "Vyberte předmět.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const newId = await createTextbookFromTemplate({
        template: selected.structure_json,
        title: title.trim() || selected.name,
        description: selected.description,
        subjectSlug: subj.slug,
        startGrade: grade,
        accessCode: generateAccessCode(),
      });
      toast({ title: "Učebnice vytvořena ze šablony" });
      onOpenChange(false);
      onCreated?.();
      navigate(`/ucitel/ucebnice/${newId}`);
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message ?? "Nepodařilo se vytvořit.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const subjectGrades = subjects?.find((s) => s.id === subjectId)?.grades ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {step === "pick" ? "Vyberte šablonu" : "Nastavení učebnice"}
          </DialogTitle>
        </DialogHeader>

        {step === "pick" ? (
          loading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Zatím nejsou k dispozici žádné šablony.</p>
          ) : (
            <div className="grid gap-3 mt-2">
              {templates.map((tpl) => {
                const chapters = tpl.structure_json?.chapters ?? [];
                const lessonCount = chapters.reduce((s, c) => s + (c.lessons?.length ?? 0), 0);
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handlePick(tpl)}
                    className="text-left border border-border rounded-lg p-4 hover:border-primary hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold">{tpl.name}</h3>
                          {tpl.is_public && <Badge variant="secondary" className="text-[10px]">Veřejná</Badge>}
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="outline" className="text-[10px]">{chapters.length} kapitol</Badge>
                          <Badge variant="outline" className="text-[10px]">{lessonCount} lekcí</Badge>
                        </div>
                        {chapters.length > 0 && (
                          <ul className="text-xs text-muted-foreground mt-2 space-y-0.5">
                            {chapters.slice(0, 3).map((c, i) => (
                              <li key={i}>• {c.title} ({c.lessons?.length ?? 0})</li>
                            ))}
                            {chapters.length > 3 && <li>… a {chapters.length - 3} dalších</li>}
                          </ul>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-4 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("pick")} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Zpět na šablony
            </Button>

            <div className="border border-border rounded-lg p-3 bg-muted/30">
              <p className="text-sm font-medium">{selected?.name}</p>
              {selected?.description && <p className="text-xs text-muted-foreground mt-0.5">{selected.description}</p>}
            </div>

            <div>
              <Label>Název učebnice</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label>Předmět *</Label>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setGrade(subjects?.find(s => s.id === v)?.grades[0]?.grade_number ?? 1); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Vyberte předmět…" /></SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {subjectGrades.length > 0 && (
              <div>
                <Label>Ročník (pro vytvořené kapitoly)</Label>
                <Select value={String(grade)} onValueChange={(v) => setGrade(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {subjectGrades.map((g) => (
                      <SelectItem key={g.grade_number} value={String(g.grade_number)}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Zrušit</Button>
              <Button onClick={handleCreate} disabled={creating || !subjectId} className="flex-1">
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Vytvořit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateFromTemplateDialog;
