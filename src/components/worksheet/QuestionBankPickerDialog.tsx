import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Library } from "lucide-react";

export type QuestionBankType = "mcq" | "true_false" | "short_answer";

export interface QuestionBankItem {
  id: string;
  subject: string | null;
  curriculum_topic_id: string | null;
  question_type: QuestionBankType;
  question_text: string;
  choices: string[] | null;
  correct_index: number | null;
  correct_answer: string | null;
  is_true: boolean | null;
}

const TYPE_LABELS: Record<QuestionBankType, string> = {
  mcq: "Výběr z možností",
  true_false: "Pravda / Nepravda",
  short_answer: "Krátká odpověď",
};

export default function QuestionBankPickerDialog({
  open,
  onOpenChange,
  worksheetSubject,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  worksheetSubject?: string | null;
  onInsert: (items: QuestionBankItem[]) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [topics, setTopics] = useState<{ id: string; title: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("__ws");
  const [topicFilter, setTopicFilter] = useState<string>("__all");
  const [typeFilter, setTypeFilter] = useState<string>("__all");

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      setSelected(new Set());
      const { data: bank } = await supabase
        .from("question_bank_items")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      const rows = (bank as QuestionBankItem[] | null) ?? [];
      setItems(rows);

      const topicIds = Array.from(
        new Set(rows.map((r) => r.curriculum_topic_id).filter((v): v is string => !!v)),
      );
      if (topicIds.length > 0) {
        const { data: t } = await supabase
          .from("curriculum_topics")
          .select("id, title")
          .in("id", topicIds);
        setTopics(((t as { id: string; title: string }[] | null) ?? []));
      } else {
        setTopics([]);
      }
      setSubjectFilter(worksheetSubject ? "__ws" : "__all");
      setTopicFilter("__all");
      setTypeFilter("__all");
      setSearch("");
      setLoading(false);
    })();
  }, [open, user, worksheetSubject]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.subject) set.add(it.subject);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
  }, [items]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((it) => {
      if (subjectFilter === "__ws" && worksheetSubject) {
        if ((it.subject ?? "").toLowerCase() !== worksheetSubject.toLowerCase()) return false;
      } else if (subjectFilter !== "__all" && subjectFilter !== "__ws") {
        if ((it.subject ?? "") !== subjectFilter) return false;
      }
      if (topicFilter !== "__all") {
        if (topicFilter === "__none") {
          if (it.curriculum_topic_id) return false;
        } else if (it.curriculum_topic_id !== topicFilter) return false;
      }
      if (typeFilter !== "__all" && it.question_type !== typeFilter) return false;
      if (s && !it.question_text.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [items, search, subjectFilter, topicFilter, typeFilter, worksheetSubject]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const insert = () => {
    const chosen = items.filter((it) => selected.has(it.id));
    onInsert(chosen);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-5 h-5 text-primary" />
            Vybrat z banky otázek
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <Label className="text-xs mb-1 block">Předmět</Label>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {worksheetSubject && (
                  <SelectItem value="__ws">Tento list ({worksheetSubject})</SelectItem>
                )}
                <SelectItem value="__all">Všechny</SelectItem>
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
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Všechna</SelectItem>
                <SelectItem value="__none">Bez tématu</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Typ</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Všechny</SelectItem>
                <SelectItem value="mcq">Výběr z možností</SelectItem>
                <SelectItem value="true_false">Pravda / Nepravda</SelectItem>
                <SelectItem value="short_answer">Krátká odpověď</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Hledat</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Text otázky…"
              className="h-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[380px] border border-border rounded-md">
          {loading ? (
            <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Žádné otázky odpovídající filtru.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((it) => {
                const checked = selected.has(it.id);
                const topic = topics.find((t) => t.id === it.curriculum_topic_id);
                return (
                  <li key={it.id}>
                    <label
                      className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                        checked ? "bg-muted/40" : ""
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(it.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1">
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
                        <div className="text-sm">{it.question_text}</div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="items-center">
          <div className="mr-auto text-xs text-muted-foreground">
            Vybráno: {selected.size}
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button disabled={selected.size === 0} onClick={insert}>
            Vložit do listu ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
