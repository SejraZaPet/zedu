import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Loader2, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import {
  QUICK_TYPES, buildMcq, buildTrueFalse, buildMatching,
  type QuickType, type McqItem, type TfItem, type PairItem,
} from "@/lib/quick-game";

const NONE = "__none__";
const emptyMcq = (): McqItem => ({ question: "", answers: ["", "", "", ""], correctIndex: 0 });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

export const QuickGameDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { subjects } = useTeacherSubjects();
  const [type, setType] = useState<QuickType | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(NONE);
  const [mcq, setMcq] = useState<McqItem[]>([emptyMcq()]);
  const [tf, setTf] = useState<TfItem[]>([{ text: "", isTrue: true }]);
  const [pairs, setPairs] = useState<PairItem[]>([{ left: "", right: "" }, { left: "", right: "" }]);
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("");
  const [count, setCount] = useState(8);
  const [aiUsed, setAiUsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("manual");

  const reset = () => {
    setType(null); setTitle(""); setSubject(NONE); setMcq([emptyMcq()]);
    setTf([{ text: "", isTrue: true }]); setPairs([{ left: "", right: "" }, { left: "", right: "" }]);
    setTopic(""); setGrade(""); setAiUsed(false); setTab("manual");
  };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const generate = async () => {
    if (topic.trim().length < 3) { toast.error("Napište, o čem má hra být."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson-quiz", {
        body: { topic: topic.trim(), format: type, count, grade: grade.trim() || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (type === "mcq") setMcq(data.questions);
      if (type === "true_false") setTf(data.statements);
      if (type === "matching") setPairs(data.pairs);
      if (!title.trim()) setTitle(topic.trim().slice(0, 80));
      setAiUsed(true);
      setTab("manual");
      toast.success("Obsah vytvořen AI – zkontrolujte ho a případně upravte.");
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se vygenerovat otázky.");
    } finally {
      setLoading(false);
    }
  };

  const buildSlides = (): any[] => {
    if (type === "mcq") {
      return mcq
        .filter((q) => q.question.trim() && q.answers.filter((a) => a.trim()).length >= 2)
        .map((q) => {
          // Index správné odpovědi po vynechání prázdných polí
          const kept = q.answers.map((a, i) => ({ a: a.trim(), i })).filter((x) => x.a);
          const ci = Math.max(0, kept.findIndex((x) => x.i === q.correctIndex));
          return buildMcq({ ...q, answers: kept.map((x) => x.a), correctIndex: ci }, aiUsed);
        });
    }
    if (type === "true_false") {
      const items = tf.filter((s) => s.text.trim());
      return items.length ? [buildTrueFalse(items, title.trim() || "Pravda, nebo nepravda?", aiUsed)] : [];
    }
    if (type === "matching") {
      const ok = pairs.filter((p) => p.left.trim() && p.right.trim());
      return ok.length >= 2 ? [buildMatching(ok, title.trim() || "Přiřaďte k sobě", aiUsed)] : [];
    }
    return [];
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Doplňte název hry."); return; }
    const slides = buildSlides();
    if (!slides.length) {
      toast.error(type === "matching" ? "Vyplňte aspoň 2 dvojice." : "Vyplňte aspoň jednu otázku s odpověďmi.");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Nejste přihlášeni.");
      const { error } = await supabase.from("teacher_game_templates" as any).insert({
        teacher_id: session.user.id,
        title: title.trim(),
        activity_data: slides,
        default_game_mode: "standard",
        default_team_mode: "none",
        subject: subject === NONE ? null : subject,
      } as any);
      if (error) throw error;
      toast.success("Rychlá hra uložena do knihovny.");
      onSaved();
      close(false);
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit hru.");
    } finally {
      setSaving(false);
    }
  };

  const typeDef = QUICK_TYPES.find((q) => q.id === type);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rychlá hra{typeDef ? ` – ${typeDef.label}` : ""}</DialogTitle>
          <DialogDescription>
            {type ? "Napište otázky sami, nebo je nechte vytvořit AI z krátkého zadání." : "Vyberte typ hry."}
          </DialogDescription>
        </DialogHeader>

        {!type ? (
          <div className="grid sm:grid-cols-3 gap-3">
            {QUICK_TYPES.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setType(q.id)}
                className="text-left rounded-xl border-2 border-border p-4 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <div className="text-3xl mb-2" aria-hidden>{q.emoji}</div>
                <div className="font-semibold text-foreground">{q.label}</div>
                <p className="text-xs text-muted-foreground mt-1">{q.hint}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => setType(null)}>
              <ArrowLeft className="w-4 h-4" /> Změnit typ
            </Button>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qg-title">Název hry</Label>
                <Input id="qg-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Hygiena – opakování" />
              </div>
              <div className="space-y-1.5">
                <Label>Předmět (nepovinné)</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Bez předmětu</SelectItem>
                    {subjects.map((s: any) => (
                      <SelectItem key={s.id ?? s.name} value={s.name ?? s.label}>{s.name ?? s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="manual">Napsat ručně</TabsTrigger>
                <TabsTrigger value="ai" className="gap-1"><Sparkles className="w-3.5 h-3.5" /> Vytvořit s AI</TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qg-topic">O čem má hra být</Label>
                  <Textarea id="qg-topic" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder="např. Hygiena ve společném stravování – mytí rukou, skladování potravin, BOZP" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="qg-grade">Ročník / úroveň (nepovinné)</Label>
                    <Input id="qg-grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="např. 1. ročník SOŠ" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qg-count">Počet {type === "matching" ? "dvojic" : "otázek"}</Label>
                    <Input id="qg-count" type="number" min={3} max={type === "matching" ? 8 : 12} value={count}
                      onChange={(e) => setCount(Number(e.target.value) || 8)} />
                  </div>
                </div>
                <Button onClick={generate} disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? "Vytvářím…" : "Vygenerovat"}
                </Button>
                <p className="text-xs text-muted-foreground">Výsledek se objeví v záložce „Napsat ručně“, kde ho můžete upravit.</p>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 pt-3">
                {aiUsed && (
                  <p className="text-xs rounded-md bg-primary/10 text-primary px-3 py-2">
                    Vytvořeno AI – před spuštěním obsah zkontrolujte.
                  </p>
                )}

                {type === "mcq" && mcq.map((q, qi) => (
                  <div key={qi} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input aria-label={`Otázka ${qi + 1}`} value={q.question} placeholder={`Otázka ${qi + 1}`}
                        onChange={(e) => setMcq(mcq.map((x, j) => j === qi ? { ...x, question: e.target.value } : x))} />
                      <Button size="icon" variant="ghost" className="text-destructive shrink-0" aria-label="Smazat otázku"
                        onClick={() => setMcq(mcq.filter((_, j) => j !== qi))} disabled={mcq.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {q.answers.map((a, ai) => (
                        <div key={ai} className="flex items-center gap-1.5">
                          <button type="button"
                            aria-label={`Označit odpověď ${ai + 1} jako správnou`}
                            aria-pressed={q.correctIndex === ai}
                            onClick={() => setMcq(mcq.map((x, j) => j === qi ? { ...x, correctIndex: ai } : x))}
                            className={cn("h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center",
                              q.correctIndex === ai ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                            {q.correctIndex === ai && <Check className="w-4 h-4" />}
                          </button>
                          <Input aria-label={`Odpověď ${ai + 1}`} value={a} placeholder={`Odpověď ${ai + 1}`}
                            onChange={(e) => setMcq(mcq.map((x, j) => j === qi
                              ? { ...x, answers: x.answers.map((y, k) => k === ai ? e.target.value : y) } : x))} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {type === "true_false" && tf.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input aria-label={`Tvrzení ${i + 1}`} value={s.text} placeholder={`Tvrzení ${i + 1}`}
                      onChange={(e) => setTf(tf.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                    <Button size="sm" variant={s.isTrue ? "default" : "outline"} className="shrink-0 w-24"
                      onClick={() => setTf(tf.map((x, j) => j === i ? { ...x, isTrue: !x.isTrue } : x))}>
                      {s.isTrue ? "Pravda" : "Nepravda"}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive shrink-0" aria-label="Smazat tvrzení"
                      onClick={() => setTf(tf.filter((_, j) => j !== i))} disabled={tf.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {type === "matching" && pairs.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input aria-label={`Pojem ${i + 1}`} value={p.left} placeholder="Pojem"
                      onChange={(e) => setPairs(pairs.map((x, j) => j === i ? { ...x, left: e.target.value } : x))} />
                    <span className="text-muted-foreground" aria-hidden>→</span>
                    <Input aria-label={`Vysvětlení ${i + 1}`} value={p.right} placeholder="Vysvětlení"
                      onChange={(e) => setPairs(pairs.map((x, j) => j === i ? { ...x, right: e.target.value } : x))} />
                    <Button size="icon" variant="ghost" className="text-destructive shrink-0" aria-label="Smazat dvojici"
                      onClick={() => setPairs(pairs.filter((_, j) => j !== i))} disabled={pairs.length <= 2}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" className="gap-1"
                  disabled={type === "matching" && pairs.length >= 8}
                  onClick={() => {
                    if (type === "mcq") setMcq([...mcq, emptyMcq()]);
                    if (type === "true_false") setTf([...tf, { text: "", isTrue: true }]);
                    if (type === "matching") setPairs([...pairs, { left: "", right: "" }]);
                  }}>
                  <Plus className="w-4 h-4" /> Přidat {type === "matching" ? "dvojici" : type === "true_false" ? "tvrzení" : "otázku"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>Zrušit</Button>
          {type && (
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Uložit do knihovny
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
