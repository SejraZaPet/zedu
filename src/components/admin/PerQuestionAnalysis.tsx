import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronDown, AlertTriangle, Info } from "lucide-react";

interface Props {
  assignmentId: string;
}

const MIN_SUBMISSIONS = 8;

type Item = any;

interface ChoiceBreakdown {
  label: string;
  count: number;
  pct: number;
  isCorrect: boolean;
}

interface QuestionStat {
  index: number;
  question: string;
  type: string;
  totalAnswered: number;
  correctCount: number;
  correctPct: number;
  hasCorrectKey: boolean;
  choices?: ChoiceBreakdown[];
}

const truncate = (s: string, n = 160) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const normalize = (s: string) => s.trim().toLowerCase();

const PerQuestionAnalysis = ({ assignmentId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [asgRes, attRes] = await Promise.all([
        supabase.from("assignments" as any).select("activity_data").eq("id", assignmentId).maybeSingle(),
        supabase
          .from("assignment_attempts" as any)
          .select("student_id, status, answers, score, max_score")
          .eq("assignment_id", assignmentId)
          .eq("status", "submitted"),
      ]);
      if (cancelled) return;
      const rawItems = (asgRes.data as any)?.activity_data;
      setItems(Array.isArray(rawItems) ? rawItems : []);
      setAttempts((attRes.data as any[]) || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  // Best submitted attempt per student (avoids double-counting multiple attempts)
  const bestByStudent = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of attempts) {
      const cur = map.get(a.student_id);
      if (!cur) map.set(a.student_id, a);
      else {
        const curPct = cur.max_score ? (cur.score ?? 0) / cur.max_score : 0;
        const newPct = a.max_score ? (a.score ?? 0) / a.max_score : 0;
        if (newPct > curPct) map.set(a.student_id, a);
      }
    }
    return [...map.values()];
  }, [attempts]);

  const submissionCount = bestByStudent.length;

  const stats: QuestionStat[] = useMemo(() => {
    if (!items.length) return [];
    return items.map((item: any, idx: number) => {
      const qText = truncate(String(item?.question || item?.title || item?.prompt || `Otázka ${idx + 1}`));
      const type = String(item?.type || "unknown");

      let correctCount = 0;
      let totalAnswered = 0;
      const choiceCounts: Record<number, number> = {};

      for (const at of bestByStudent) {
        const ans = (at.answers as any)?.[idx];
        if (ans === undefined || ans === null || ans === "") continue;
        totalAnswered += 1;

        if (type === "mcq") {
          const i = typeof ans === "number" ? ans : Number(ans);
          if (!Number.isNaN(i)) choiceCounts[i] = (choiceCounts[i] || 0) + 1;
          if (i === item.correctIndex) correctCount += 1;
        } else if (type === "true_false") {
          const b = Boolean(ans);
          const key = b ? 1 : 0;
          choiceCounts[key] = (choiceCounts[key] || 0) + 1;
          if (b === Boolean(item.isTrue)) correctCount += 1;
        } else if (type === "short_answer") {
          if (typeof ans === "string" && typeof item.correctAnswer === "string") {
            if (normalize(ans) === normalize(item.correctAnswer)) correctCount += 1;
          }
        }
      }

      let choices: ChoiceBreakdown[] | undefined;
      if (type === "mcq" && Array.isArray(item.choices)) {
        choices = item.choices.map((label: string, i: number) => {
          const count = choiceCounts[i] || 0;
          return {
            label: String(label),
            count,
            pct: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
            isCorrect: i === item.correctIndex,
          };
        });
      } else if (type === "true_false") {
        choices = [
          { label: "Pravda", isCorrect: Boolean(item.isTrue) === true, count: choiceCounts[1] || 0, pct: 0 },
          { label: "Nepravda", isCorrect: Boolean(item.isTrue) === false, count: choiceCounts[0] || 0, pct: 0 },
        ].map((c) => ({ ...c, pct: totalAnswered > 0 ? Math.round((c.count / totalAnswered) * 100) : 0 }));
      }

      const hasCorrectKey =
        (type === "mcq" && typeof item.correctIndex === "number") ||
        (type === "true_false" && typeof item.isTrue === "boolean") ||
        (type === "short_answer" && typeof item.correctAnswer === "string");

      const correctPct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

      return {
        index: idx,
        question: qText,
        type,
        totalAnswered,
        correctCount,
        correctPct,
        hasCorrectKey,
        choices,
      };
    });
  }, [items, bestByStudent]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Tento úkol nemá strukturované otázky pro agregovanou analýzu.
      </div>
    );
  }

  if (submissionCount < MIN_SUBMISSIONS) {
    return (
      <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex gap-3 items-start">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Pohled je dostupný až od {MIN_SUBMISSIONS} odevzdaných pokusů</p>
            <p className="text-muted-foreground">
              Ochrana soukromí jednotlivých žáků u malých skupin. Zatím odevzdalo {submissionCount}{" "}
              {submissionCount === 1 ? "žák" : submissionCount < 5 ? "žáci" : "žáků"}.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Agregováno z {submissionCount} odevzdaných pokusů (nejlepší pokus na žáka).
      </p>
      {stats.map((s) => {
        const highError = s.hasCorrectKey && s.correctPct < 40 && s.totalAnswered > 0;
        const isOpen = openIdx === s.index;
        return (
          <Card key={s.index}>
            <Collapsible open={isOpen} onOpenChange={(o) => setOpenIdx(o ? s.index : null)}>
              <CollapsibleTrigger asChild>
                <button className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">#{s.index + 1}</span>
                      <span className="font-medium text-sm truncate">{s.question}</span>
                    </div>
                    {s.hasCorrectKey ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-destructive/20 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                s.correctPct >= 70 ? "bg-emerald-500" : s.correctPct >= 40 ? "bg-amber-500" : "bg-destructive"
                              }`}
                              style={{ width: `${s.correctPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium shrink-0 w-14 text-right">
                            {s.correctPct}% správně
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {s.correctCount} z {s.totalAnswered} správně
                        </p>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Volná odpověď — bez automatického vyhodnocení
                      </Badge>
                    )}
                    {highError && s.correctPct < 40 && (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          Hodně žáků chybovalo — stojí za zvážení, jestli otázka nebyla nejasně formulovaná.
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4 space-y-2 border-t border-border">
                  {s.choices && s.choices.length > 0 ? (
                    <div className="space-y-2 pt-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rozpad odpovědí</p>
                      {s.choices.map((c, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {c.isCorrect && (
                                <Badge variant="outline" className="text-[9px] border-emerald-500 text-emerald-600 dark:text-emerald-400 px-1 py-0">
                                  správně
                                </Badge>
                              )}
                              <span className="truncate">{c.label}</span>
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {c.pct}% ({c.count})
                            </span>
                          </div>
                          <Progress
                            value={c.pct}
                            className={`h-1.5 ${c.isCorrect ? "" : "opacity-70"}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : s.type === "short_answer" ? (
                    <p className="text-xs text-muted-foreground pt-3">
                      U otevřených odpovědí zobrazujeme jen podíl správně/špatně — volný text nelze bez AI smysluplně kategorizovat.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground pt-3">
                      Podrobný rozpad pro tento typ otázky není k dispozici.
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};

export default PerQuestionAnalysis;
