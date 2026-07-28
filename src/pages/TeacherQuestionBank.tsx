import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Library,
  X,
  Loader2,
} from "lucide-react";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";

type QType = "mcq" | "true_false" | "short_answer";

interface BankItem {
  id: string;
  teacher_id: string;
  subject: string | null;
  curriculum_topic_id: string | null;
  question_type: QType;
  question_text: string;
  choices: string[] | null;
  correct_index: number | null;
  correct_answer: string | null;
  is_true: boolean | null;
  created_at: string;
}

interface TopicRow {
  id: string;
  title: string;
  curriculum_plan_id: string;
  subject?: string;
}

const TYPE_LABELS: Record<QType, string> = {
  mcq: "Výběr z možností",
  true_false: "Pravda / Nepravda",
  short_answer: "Krátká odpověď",
};

export default function TeacherQuestionBank() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subjects } = useTeacherSubjects();

  const [items, setItems] = useState<BankItem[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterSubject, setFilterSubject] = useState<string>("__all");
  const [filterTopic, setFilterTopic] = useState<string>("__all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankItem | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: bank }, { data: plans }] = await Promise.all([
      supabase
        .from("question_bank_items")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("teacher_curriculum_plans")
        .select("id, subject")
        .eq("teacher_id", user.id),
    ]);
    const planIds = ((plans as { id: string; subject: string }[] | null) ?? []).map((p) => p.id);
    const subjectByPlan = new Map<string, string>(
      ((plans as { id: string; subject: string }[] | null) ?? []).map((p) => [p.id, p.subject]),
    );
    let topicRows: TopicRow[] = [];
    if (planIds.length > 0) {
      const { data: t } = await supabase
        .from("curriculum_topics")
        .select("id, title, curriculum_plan_id")
        .in("curriculum_plan_id", planIds)
        .order("sort_order", { ascending: true });
      topicRows = ((t as TopicRow[] | null) ?? []).map((r) => ({
        ...r,
        subject: subjectByPlan.get(r.curriculum_plan_id),
      }));
    }
    setItems((bank as BankItem[] | null) ?? []);
    setTopics(topicRows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterSubject !== "__all" && (it.subject ?? "") !== filterSubject) return false;
      if (filterTopic !== "__all") {
        if (filterTopic === "__none") {
          if (it.curriculum_topic_id) return false;
        } else if (it.curriculum_topic_id !== filterTopic) return false;
      }
      return true;
    });
  }, [items, filterSubject, filterTopic]);

  const topicsForSubject = useMemo(() => {
    if (filterSubject === "__all") return topics;
    return topics.filter((t) => (t.subject ?? "").toLowerCase() === filterSubject.toLowerCase());
  }, [topics, filterSubject]);

  const remove = async (id: string) => {
    if (!confirm("Smazat otázku z banky?")) return;
    const { error } = await supabase.from("question_bank_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět
          </Button>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" />
            Banka otázek
          </h1>
          <div className="ml-auto">
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Nová otázka
            </Button>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
            <div className="min-w-[180px]">
              <Label className="text-xs mb-1 block">Předmět</Label>
              <Select
                value={filterSubject}
                onValueChange={(v) => {
                  setFilterSubject(v);
                  setFilterTopic("__all");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Všechny předměty</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.label} value={s.label}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px]">
              <Label className="text-xs mb-1 block">Téma ŠVP</Label>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Všechna témata</SelectItem>
                  <SelectItem value="__none">Bez tématu</SelectItem>
                  {topicsForSubject.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {filtered.length} z {items.length} otázek
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Zatím žádné otázky. Přidejte první ručně nebo je uložte z pracovního listu.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => {
              const topic = topics.find((t) => t.id === it.curriculum_topic_id);
              return (
                <Card key={it.id}>
                  <CardContent className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {TYPE_LABELS[it.question_type]}
                        </Badge>
                        {it.subject && (
                          <Badge variant="outline" className="text-[10px]">
                            {it.subject}
                          </Badge>
                        )}
                        {topic && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          >
                            ŠVP: {topic.title}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium mb-0.5">{it.question_text}</div>
                      {it.question_type === "mcq" && it.choices && (
                        <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {it.choices.map((c, i) => (
                            <li key={i} className={i === it.correct_index ? "text-emerald-600 font-medium" : ""}>
                              {i === it.correct_index ? "✓ " : "• "}
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                      {it.question_type === "true_false" && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Správně: <span className="font-medium">{it.is_true ? "Pravda" : "Nepravda"}</span>
                        </div>
                      )}
                      {it.question_type === "short_answer" && it.correct_answer && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Správně: <span className="font-medium">{it.correct_answer}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditing(it);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove(it.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <QuestionEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        subjects={subjects.map((s) => s.label)}
        topics={topics}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />

      <SiteFooter />
    </div>
  );
}

function QuestionEditorDialog({
  open,
  onOpenChange,
  editing,
  subjects,
  topics,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: BankItem | null;
  subjects: string[];
  topics: TopicRow[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [qType, setQType] = useState<QType>("mcq");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState<string>("__none");
  const [topicId, setTopicId] = useState<string>("__none");
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [isTrue, setIsTrue] = useState<boolean>(true);
  const [shortAnswer, setShortAnswer] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setQType(editing.question_type);
      setText(editing.question_text);
      setSubject(editing.subject ?? "__none");
      setTopicId(editing.curriculum_topic_id ?? "__none");
      setChoices(editing.choices ?? ["", "", "", ""]);
      setCorrectIndex(editing.correct_index ?? 0);
      setIsTrue(editing.is_true ?? true);
      setShortAnswer(editing.correct_answer ?? "");
    } else {
      setQType("mcq");
      setText("");
      setSubject("__none");
      setTopicId("__none");
      setChoices(["", "", "", ""]);
      setCorrectIndex(0);
      setIsTrue(true);
      setShortAnswer("");
    }
  }, [open, editing]);

  const topicsForSubject = useMemo(() => {
    if (subject === "__none") return topics;
    return topics.filter((t) => (t.subject ?? "").toLowerCase() === subject.toLowerCase());
  }, [topics, subject]);

  const save = async () => {
    if (!user) return;
    if (!text.trim()) {
      toast({ title: "Chybí text otázky", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      teacher_id: user.id,
      subject: subject === "__none" ? null : subject,
      curriculum_topic_id: topicId === "__none" ? null : topicId,
      question_type: qType,
      question_text: text.trim(),
      choices: null,
      correct_index: null,
      correct_answer: null,
      is_true: null,
    };
    if (qType === "mcq") {
      const cleaned = choices.map((c) => c.trim()).filter((c) => c.length > 0);
      if (cleaned.length < 2) {
        toast({ title: "MCQ musí mít min. 2 volby", variant: "destructive" });
        setSaving(false);
        return;
      }
      payload.choices = cleaned;
      payload.correct_index = Math.min(correctIndex, cleaned.length - 1);
    } else if (qType === "true_false") {
      payload.is_true = isTrue;
    } else if (qType === "short_answer") {
      payload.correct_answer = shortAnswer.trim() || null;
    }

    const q = editing
      ? supabase.from("question_bank_items").update(payload).eq("id", editing.id)
      : supabase.from("question_bank_items").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Upraveno" : "Přidáno do banky" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Upravit otázku" : "Nová otázka do banky"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Typ</Label>
              <Select value={qType} onValueChange={(v) => setQType(v as QType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Výběr z možností</SelectItem>
                  <SelectItem value="true_false">Pravda / Nepravda</SelectItem>
                  <SelectItem value="short_answer">Krátká odpověď</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Předmět</Label>
              <Select
                value={subject}
                onValueChange={(v) => {
                  setSubject(v);
                  setTopicId("__none");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Nevybráno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nevybráno</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Téma ŠVP</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Bez tématu</SelectItem>
                  {topicsForSubject.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Text otázky</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>

          {qType === "mcq" && (
            <div>
              <Label className="text-xs mb-1 block">Možnosti (zaškrtni správnou)</Label>
              <div className="space-y-2">
                {choices.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectIndex(i)}
                      className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs ${
                        i === correctIndex
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {i === correctIndex ? "✓" : String.fromCharCode(65 + i)}
                    </button>
                    <Input
                      value={c}
                      onChange={(e) => {
                        const next = [...choices];
                        next[i] = e.target.value;
                        setChoices(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        const next = choices.filter((_, idx) => idx !== i);
                        setChoices(next.length > 0 ? next : [""]);
                        if (correctIndex >= next.length) setCorrectIndex(Math.max(0, next.length - 1));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setChoices([...choices, ""])}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Přidat volbu
                </Button>
              </div>
            </div>
          )}

          {qType === "true_false" && (
            <div>
              <Label className="text-xs mb-1 block">Správná odpověď</Label>
              <Select value={String(isTrue)} onValueChange={(v) => setIsTrue(v === "true")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Pravda</SelectItem>
                  <SelectItem value="false">Nepravda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {qType === "short_answer" && (
            <div>
              <Label className="text-xs mb-1 block">Vzorová správná odpověď (volitelné)</Label>
              <Input value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {editing ? "Uložit změny" : "Přidat do banky"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
