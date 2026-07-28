import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Sparkles, Trash2, Check, X, Pencil } from "lucide-react";

interface CurriculumTopic {
  id: string;
  title: string;
  sort_order: number;
  coverage_count: number;
}

interface Props {
  planId: string;
  planContent: string | null;
  teacherId: string;
  subject: string;
}

export default function CurriculumTopicsSection({ planId, planContent, teacherId, subject }: Props) {
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Load topics
    const { data: t } = await supabase
      .from("curriculum_topics")
      .select("id, title, sort_order")
      .eq("curriculum_plan_id", planId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const topicRows = (t as { id: string; title: string; sort_order: number }[] | null) ?? [];
    const ids = topicRows.map((r) => r.id);

    // Load coverage counts for these topics — RLS ensures only owner's lessons visible
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: cov } = await supabase
        .from("lesson_curriculum_coverage")
        .select("curriculum_topic_id, lesson_id")
        .in("curriculum_topic_id", ids);
      // Count distinct lessons per topic
      const map: Record<string, Set<string>> = {};
      for (const row of (cov as { curriculum_topic_id: string; lesson_id: string }[] | null) ?? []) {
        if (!map[row.curriculum_topic_id]) map[row.curriculum_topic_id] = new Set();
        map[row.curriculum_topic_id].add(row.lesson_id);
      }
      counts = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.size]));
    }

    setTopics(topicRows.map((r) => ({ ...r, coverage_count: counts[r.id] ?? 0 })));
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = topics.length;
    const covered = topics.filter((t) => t.coverage_count > 0).length;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
    return { total, covered, pct };
  }, [topics]);

  const runAiRecognition = async () => {
    if (!planContent || !planContent.trim()) {
      toast({
        title: "Chybí text ŠVP",
        description: "AI rozpoznávání funguje jen u ŠVP s vyplněným textem.",
        variant: "destructive",
      });
      return;
    }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-curriculum-topics", {
        body: { curriculumText: planContent },
      });
      if (error) throw error;
      const list: string[] = Array.isArray(data?.topics) ? data.topics : [];
      if (list.length === 0) {
        toast({ title: "AI nerozpoznala žádná témata" });
        return;
      }
      // Dedupe against existing (case-insensitive)
      const existing = new Set(topics.map((t) => t.title.trim().toLowerCase()));
      const toInsert = list
        .map((s, i) => ({ title: s.trim(), idx: i }))
        .filter((r) => r.title && !existing.has(r.title.toLowerCase()));

      if (toInsert.length === 0) {
        toast({ title: "Všechna rozpoznaná témata už máte v seznamu." });
        return;
      }
      const startOrder = topics.length;
      const { error: insErr } = await supabase.from("curriculum_topics").insert(
        toInsert.map((r, i) => ({
          curriculum_plan_id: planId,
          title: r.title,
          sort_order: startOrder + i,
        })),
      );
      if (insErr) throw insErr;
      toast({
        title: `Přidáno ${toInsert.length} témat`,
        description: "Můžete je ještě upravit nebo smazat.",
      });
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Chyba AI rozpoznávání", description: msg, variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const addManual = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("curriculum_topics").insert({
        curriculum_plan_id: planId,
        title,
        sort_order: topics.length,
      });
      if (error) throw error;
      setNewTitle("");
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (t: CurriculumTopic) => {
    setEditingId(t.id);
    setEditTitle(t.title);
  };

  const saveEdit = async (id: string) => {
    const title = editTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    const { error } = await supabase
      .from("curriculum_topics")
      .update({ title })
      .eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    load();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Smazat toto téma? Zruší se i vazby na lekce.")) return;
    const { error } = await supabase.from("curriculum_topics").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-sm font-semibold">Témata ŠVP</h4>
        {planContent && planContent.trim() && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8"
            onClick={runAiRecognition}
            disabled={aiBusy}
          >
            {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Rozpoznat pomocí AI
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Načítání témat…
        </div>
      ) : (
        <>
          {topics.length > 0 && (
            <ul className="space-y-1.5">
              {topics.map((t) => {
                const covered = t.coverage_count > 0;
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-2 py-1.5"
                  >
                    {editingId === t.id ? (
                      <>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(t.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(t.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate">{t.title}</span>
                        {covered ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0"
                          >
                            Pokryto ({t.coverage_count})
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0"
                          >
                            Chybí
                          </Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEdit(t)}
                          aria-label="Upravit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteTopic(t.id)}
                          aria-label="Smazat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addManual();
              }}
              placeholder="Přidat téma ručně…"
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={addManual}
              disabled={adding || !newTitle.trim()}
            >
              <Plus className="w-3.5 h-3.5" /> Přidat
            </Button>
          </div>

          {topics.length > 0 && (
            <div className="rounded-md bg-muted/40 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pokrytí ŠVP lekcemi</span>
                <span className="font-semibold">
                  {stats.covered} / {stats.total} ({stats.pct} %)
                </span>
              </div>
              <Progress value={stats.pct} className="h-1.5" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
