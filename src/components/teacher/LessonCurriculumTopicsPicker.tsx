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
import { loadTopicsForSubject, type SubjectTopic } from "@/lib/curriculum-topics";

interface Props {
  /** Lekce učebnice (vazba přes lesson_curriculum_coverage). */
  lessonId?: string;
  /** Optional: ID of the teacher_textbook containing this lesson. If omitted, resolved from lesson row. */
  textbookId?: string;
  /** Plán hodiny (vazba přes lesson_plan_curriculum_coverage). */
  lessonPlanId?: string;
  /** Předmět – pokud není zadán, dohledá se z učebnice lekce. */
  subject?: string;
}

/**
 * Multi-select autocomplete for tagging a lesson (or a lesson plan) with ŠVP topics.
 * Nabízí témata ze VŠECH ŠVP učitele k danému předmětu a u každého uvádí,
 * ze kterého ŠVP pochází.
 */
export default function LessonCurriculumTopicsPicker({
  lessonId,
  textbookId,
  lessonPlanId,
  subject: subjectProp,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [topics, setTopics] = useState<SubjectTopic[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const targetId = lessonPlanId ?? lessonId ?? null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user || !targetId) return;
      setLoading(true);
      setLoadError(null);
      try {
        // 1) Resolve subject.
        let subj: string | null = subjectProp?.trim() || null;
        if (!subj && lessonId) {
          let tbId = textbookId;
          if (!tbId) {
            const { data: lessonRow } = await supabase
              .from("teacher_textbook_lessons")
              .select("textbook_id")
              .eq("id", lessonId)
              .maybeSingle();
            tbId = (lessonRow as { textbook_id: string } | null)?.textbook_id ?? undefined;
          }
          if (tbId) {
            const { data: tb } = await supabase
              .from("teacher_textbooks")
              .select("subject")
              .eq("id", tbId)
              .maybeSingle();
            subj = (tb as { subject: string } | null)?.subject ?? null;
          }
        }
        if (cancelled) return;
        setSubject(subj);
        if (!subj) {
          setTopics([]);
          setPlanCount(0);
          setSelectedIds(new Set());
          return;
        }

        // 2) Témata ze všech ŠVP učitele k předmětu
        const res = await loadTopicsForSubject(user.id, subj);

        // 3) Existing coverage for this target
        let cov: { curriculum_topic_id: string }[] | null = null;
        if (lessonPlanId) {
          const r = await supabase
            .from("lesson_plan_curriculum_coverage")
            .select("curriculum_topic_id")
            .eq("lesson_plan_id", targetId);
          if (r.error) throw r.error;
          cov = r.data;
        } else {
          const r = await supabase
            .from("lesson_curriculum_coverage")
            .select("curriculum_topic_id")
            .eq("lesson_id", targetId);
          if (r.error) throw r.error;
          cov = r.data;
        }
        const covIds = new Set(
          ((cov as { curriculum_topic_id: string }[] | null) ?? []).map((r) => r.curriculum_topic_id),
        );

        if (cancelled) return;
        setTopics(res.topics);
        setPlanCount(res.planCount);
        setSelectedIds(covIds);
      } catch (e: unknown) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, textbookId, lessonId, lessonPlanId, subjectProp, targetId, table, fkCol]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) => t.title.toLowerCase().includes(q) || t.planTitle.toLowerCase().includes(q),
    );
  }, [topics, query]);

  const selectedTopics = useMemo(
    () => topics.filter((t) => selectedIds.has(t.id)),
    [topics, selectedIds],
  );

  const showPlanTitle = planCount > 1;

  const toggle = async (topicId: string) => {
    if (!targetId) return;
    setSaving(topicId);
    try {
      if (selectedIds.has(topicId)) {
        const { error } = lessonPlanId
          ? await supabase
              .from("lesson_plan_curriculum_coverage")
              .delete()
              .eq("lesson_plan_id", targetId)
              .eq("curriculum_topic_id", topicId)
          : await supabase
              .from("lesson_curriculum_coverage")
              .delete()
              .eq("lesson_id", targetId)
              .eq("curriculum_topic_id", topicId);
        if (error) throw error;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      } else {
        const { error } = lessonPlanId
          ? await supabase
              .from("lesson_plan_curriculum_coverage")
              .insert({ lesson_plan_id: targetId, curriculum_topic_id: topicId })
          : await supabase
              .from("lesson_curriculum_coverage")
              .insert({ lesson_id: targetId, curriculum_topic_id: topicId });
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
      ) : loadError ? (
        <p className="text-xs text-destructive">Témata ŠVP se nepodařilo načíst: {loadError}</p>
      ) : !subject ? (
        <p className="text-xs text-muted-foreground">
          {lessonPlanId ? "Nejprve vyberte předmět plánu." : "Nelze určit předmět učebnice."}
        </p>
      ) : topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Zatím nemáte témata ŠVP pro předmět <span className="font-medium">{subject}</span>.{" "}
          <a href="/ucitel/svp" className="underline text-primary hover:opacity-80">
            Doplnit v ŠVP
          </a>
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
                  title={showPlanTitle ? `${t.title} · ${t.planTitle}` : t.title}
                >
                  <span className="max-w-[220px] truncate">
                    {t.title}
                    {showPlanTitle && (
                      <span className="text-muted-foreground"> · {t.planTitle}</span>
                    )}
                  </span>
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
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{t.title}</span>
                          {showPlanTitle && (
                            <span className="block text-[11px] text-muted-foreground truncate">
                              ŠVP: {t.planTitle}
                            </span>
                          )}
                        </span>
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
