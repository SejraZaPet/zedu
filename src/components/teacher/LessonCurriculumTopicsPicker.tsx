import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { BookMarked, Check, ChevronsUpDown, Loader2, X } from "lucide-react";

interface Props {
  lessonId: string;
  /** Optional: ID of the teacher_textbook containing this lesson. If omitted, resolved from lesson row. */
  textbookId?: string;
}

interface Topic {
  id: string;
  title: string;
}

/**
 * Multi-select autocomplete for tagging a lesson with ŠVP topics.
 * Loads topics from the teacher's curriculum plan matching the lesson's textbook subject,
 * and persists selections to lesson_curriculum_coverage.
 */
export default function LessonCurriculumTopicsPicker({ lessonId, textbookId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user || !lessonId) return;
      setLoading(true);
      try {
        // 1) Resolve subject of the lesson's textbook.
        let tbId = textbookId;
        if (!tbId) {
          const { data: lessonRow } = await supabase
            .from("teacher_textbook_lessons")
            .select("textbook_id")
            .eq("id", lessonId)
            .maybeSingle();
          tbId = (lessonRow as { textbook_id: string } | null)?.textbook_id ?? undefined;
        }
        if (!tbId) {
          if (!cancelled) {
            setTopics([]);
            setSelectedIds(new Set());
            setSubject(null);
          }
          return;
        }
        const { data: tb } = await supabase
          .from("teacher_textbooks")
          .select("subject")
          .eq("id", tbId)
          .maybeSingle();
        const subj = (tb as { subject: string } | null)?.subject ?? null;
        if (cancelled) return;
        setSubject(subj);
        if (!subj) {
          setTopics([]);
          setSelectedIds(new Set());
          return;
        }

        // 2) Find teacher's curriculum plan for this subject
        const { data: plan } = await supabase
          .from("teacher_curriculum_plans")
          .select("id")
          .eq("teacher_id", user.id)
          .eq("subject", subj)
          .maybeSingle();
        const planId = (plan as { id: string } | null)?.id ?? null;

        // 3) Topics for that plan (may be empty if no ŠVP yet)
        let topicRows: Topic[] = [];
        if (planId) {
          const { data: t } = await supabase
            .from("curriculum_topics")
            .select("id, title, sort_order")
            .eq("curriculum_plan_id", planId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });
          topicRows = ((t as { id: string; title: string }[] | null) ?? []).map((r) => ({
            id: r.id,
            title: r.title,
          }));
        }

        // 4) Existing coverage for this lesson
        const { data: cov } = await supabase
          .from("lesson_curriculum_coverage")
          .select("curriculum_topic_id")
          .eq("lesson_id", lessonId);
        const covIds = new Set(
          ((cov as { curriculum_topic_id: string }[] | null) ?? []).map((r) => r.curriculum_topic_id),
        );

        if (cancelled) return;
        setTopics(topicRows);
        setSelectedIds(covIds);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, textbookId, lessonId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => t.title.toLowerCase().includes(q));
  }, [topics, query]);

  const selectedTopics = useMemo(
    () => topics.filter((t) => selectedIds.has(t.id)),
    [topics, selectedIds],
  );

  const toggle = async (topicId: string) => {
    setSaving(topicId);
    try {
      if (selectedIds.has(topicId)) {
        const { error } = await supabase
          .from("lesson_curriculum_coverage")
          .delete()
          .eq("lesson_id", lessonId)
          .eq("curriculum_topic_id", topicId);
        if (error) throw error;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      } else {
        const { error } = await supabase.from("lesson_curriculum_coverage").insert({
          lesson_id: lessonId,
          curriculum_topic_id: topicId,
        });
        if (error) throw error;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(topicId);
          return next;
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <BookMarked className="w-4 h-4 text-primary" />
        Témata ŠVP
        {subject && <span className="text-xs text-muted-foreground font-normal">({subject})</span>}
      </Label>

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Načítání témat…
        </div>
      ) : !subject ? (
        <p className="text-xs text-muted-foreground">
          Nelze určit předmět učebnice.
        </p>
      ) : topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Pro předmět <span className="font-medium">{subject}</span> zatím nemáte v ŠVP žádná
          rozpoznaná témata. Doplňte je na stránce <span className="font-medium">Školní vzdělávací plán</span>.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {selectedTopics.length === 0 ? (
              <span className="text-xs text-muted-foreground">Žádné téma zatím nevybráno.</span>
            ) : (
              selectedTopics.map((t) => (
                <Badge
                  key={t.id}
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 py-0.5"
                >
                  <span className="max-w-[220px] truncate">{t.title}</span>
                  <button
                    type="button"
                    className="hover:text-destructive rounded-sm"
                    onClick={() => toggle(t.id)}
                    aria-label={`Odebrat téma ${t.title}`}
                    disabled={saving === t.id}
                  >
                    {saving === t.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                </Badge>
              ))
            )}
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between h-8 text-xs"
                role="combobox"
                aria-expanded={open}
              >
                <span className="text-muted-foreground">Přidat / upravit témata ŠVP…</span>
                <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat téma…"
                className="h-8 text-sm mb-2"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    Žádné odpovídající téma.
                  </p>
                ) : (
                  filtered.map((t) => {
                    const isSelected = selectedIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        disabled={saving === t.id}
                        className="w-full flex items-center gap-2 text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {saving === t.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isSelected ? (
                            <Check className="w-3 h-3" />
                          ) : null}
                        </span>
                        <span className="flex-1 truncate">{t.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
