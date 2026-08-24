import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Pencil, Trash2, Save, X, ThumbsUp, ThumbsDown, BookPlus, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatLog {
  id: string;
  session_id: string;
  question: string;
  answer: string;
  feedback: string | null;
  created_at: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  updated_at: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function WebsiteAssistantManager() {
  const { user } = useAuth();
  const [tab, setTab] = useState("logs");
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ question: string; answer: string; is_active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [logRes, faqRes] = await Promise.all([
      supabase
        .from("website_chat_logs")
        .select("id, session_id, question, answer, feedback, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("website_assistant_faq")
        .select("id, question, answer, is_active, updated_at")
        .order("updated_at", { ascending: false }),
    ]);
    if (logRes.error) toast({ title: "Log se nepodařilo načíst", description: logRes.error.message, variant: "destructive" });
    if (faqRes.error) toast({ title: "Znalostní bázi se nepodařilo načíst", description: faqRes.error.message, variant: "destructive" });
    setLogs(logRes.data ?? []);
    setFaqs(faqRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = (question = "") => {
    setEditingId("new");
    setForm({ question, answer: "", is_active: true });
    setTab("faq");
  };

  const startEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({ question: item.question, answer: item.answer, is_active: item.is_active });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const save = async () => {
    if (!form) return;
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: "Vyplňte otázku i odpověď", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      is_active: form.is_active,
    };
    const { error } =
      editingId === "new"
        ? await supabase.from("website_assistant_faq").insert({ ...payload, created_by: user?.id ?? null })
        : await supabase.from("website_assistant_faq").update(payload).eq("id", editingId!);
    setSaving(false);
    if (error) {
      toast({ title: "Uložení se nepodařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo" });
    cancelEdit();
    load();
  };

  const toggleActive = async (item: FaqItem) => {
    const { error } = await supabase
      .from("website_assistant_faq")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) {
      toast({ title: "Změna se nepodařila", description: error.message, variant: "destructive" });
      return;
    }
    setFaqs((prev) => prev.map((f) => (f.id === item.id ? { ...f, is_active: !f.is_active } : f)));
  };

  const remove = async (item: FaqItem) => {
    if (!window.confirm("Smazat tento záznam ze znalostní báze?")) return;
    const { error } = await supabase.from("website_assistant_faq").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Smazání se nepodařilo", description: error.message, variant: "destructive" });
      return;
    }
    setFaqs((prev) => prev.filter((f) => f.id !== item.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Bezlai web
          </h2>
          <p className="text-sm text-muted-foreground">
            Konverzace návštěvníků veřejného webu a doplňkové znalosti, které asistent použije přednostně.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Obnovit"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="logs">Log konverzací</TabsTrigger>
          <TabsTrigger value="faq">Znalostní báze</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-3 pt-4">
          {!loading && logs.length === 0 && (
            <p className="text-sm text-muted-foreground">Zatím žádné konverzace.</p>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "rounded-xl border p-3 space-y-2",
                log.feedback === "down" && "border-destructive bg-destructive/5",
                log.feedback === "up" && "border-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{fmtDate(log.created_at)}</span>
                {log.feedback === "down" ? (
                  <Badge variant="destructive" className="gap-1">
                    <ThumbsDown className="w-3 h-3" /> Nespokojen
                  </Badge>
                ) : log.feedback === "up" ? (
                  <Badge className="gap-1">
                    <ThumbsUp className="w-3 h-3" /> Spokojen
                  </Badge>
                ) : (
                  <Badge variant="secondary">Bez reakce</Badge>
                )}
              </div>
              <p className="text-sm font-medium">{log.question}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.answer}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => startNew(log.question)}>
                <BookPlus className="w-4 h-4" />
                Přidat do znalostní báze
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="faq" className="space-y-3 pt-4">
          {editingId === null && (
            <Button size="sm" className="gap-2" onClick={() => startNew()}>
              <Plus className="w-4 h-4" />
              Nový záznam
            </Button>
          )}

          {form && (
            <div className="rounded-xl border p-4 space-y-3 bg-card">
              <div className="space-y-1">
                <Label htmlFor="faq-q">Otázka</Label>
                <Input id="faq-q" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="faq-a">Odpověď</Label>
                <Textarea
                  id="faq-a"
                  rows={4}
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  placeholder="Doplňte odpověď, kterou má asistent používat."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="faq-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label htmlFor="faq-active">Aktivní</Label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-2" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Uložit
                </Button>
                <Button size="sm" variant="ghost" className="gap-2" onClick={cancelEdit}>
                  <X className="w-4 h-4" />
                  Zrušit
                </Button>
              </div>
            </div>
          )}

          {!loading && faqs.length === 0 && !form && (
            <p className="text-sm text-muted-foreground">Znalostní báze je prázdná.</p>
          )}

          {faqs.map((item) => (
            <div key={item.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{item.question}</p>
                <Badge variant={item.is_active ? "default" : "secondary"}>
                  {item.is_active ? "Aktivní" : "Neaktivní"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.answer}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => startEdit(item)}>
                  <Pencil className="w-4 h-4" />
                  Upravit
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleActive(item)}>
                  {item.is_active ? "Deaktivovat" : "Aktivovat"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-2 text-destructive" onClick={() => remove(item)}>
                  <Trash2 className="w-4 h-4" />
                  Smazat
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
