import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Loader2, BarChart3, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickGameDialog } from "@/components/game/QuickGameDialog";
import { fetchAssignmentStudentIds, fetchLessonSuccessPct, weakSpotGameTopic } from "@/lib/assignment-difficulty";

interface Props {
  topicId: string;
  topicTitle: string;
}

interface Row {
  assignmentId: string;
  title: string;
  className: string;
  date: string;
  pct: number | null;
  sampleCount: number;
}

const barColor = (pct: number) =>
  pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-destructive";

/**
 * Slabá místa jednoho tématu ŠVP napříč všemi úkoly a třídami,
 * které se k němu váží přes napárované lekce.
 */
const CurriculumTopicWeakSpots = ({ topicId, topicTitle }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [gameTopic, setGameTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: cov } = await supabase
          .from("lesson_curriculum_coverage")
          .select("lesson_id")
          .eq("curriculum_topic_id", topicId);
        const lessonIds = Array.from(
          new Set(((cov as any[]) || []).map((r) => r.lesson_id).filter(Boolean)),
        );
        if (lessonIds.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const { data } = await supabase
          .from("assignments")
          .select("id, title, created_at, class_id, group_id, lesson_id, classes(name)")
          .in("lesson_id", lessonIds)
          .order("created_at", { ascending: true });

        const out: Row[] = [];
        for (const a of ((data as any[]) || [])) {
          const studentIds = await fetchAssignmentStudentIds(a);
          const { pct, sampleCount } = await fetchLessonSuccessPct({
            lessonId: a.lesson_id,
            studentIds,
          });
          out.push({
            assignmentId: a.id,
            title: a.title ?? "Úloha",
            className: a.classes?.name ?? (a.group_id ? "Skupina" : "—"),
            date: a.created_at,
            pct,
            sampleCount,
          });
        }
        if (!cancelled) setRows(out);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded, topicId]);

  const withData = rows.filter((r) => r.pct !== null);
  const overall =
    withData.length > 0
      ? Math.round(withData.reduce((s, r) => s + (r.pct as number), 0) / withData.length)
      : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted/50"
          aria-label={`Slabá místa napříč třídami pro téma ${topicTitle}`}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <BarChart3 className="h-3.5 w-3.5" />
          Slabá místa napříč třídami
          {overall !== null && <span className="font-semibold">· {overall} %</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1.5">
        {loading ? (
          <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Počítám úspěšnost…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            K tomuto tématu zatím nejsou zadané úkoly s propojenou lekcí.
          </p>
        ) : (
          <div className="space-y-2 px-1">
            {overall !== null && (
              <p className="text-xs">
                Souhrnná úspěšnost: <strong>{overall} %</strong>{" "}
                <span className="text-muted-foreground">({withData.length} úkolů s daty)</span>
              </p>
            )}
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.assignmentId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate">
                      {r.className} · {r.title}
                      <span className="text-muted-foreground">
                        {" "}
                        · {new Date(r.date).toLocaleDateString("cs-CZ")}
                      </span>
                    </span>
                    {r.pct === null ? (
                      <span className="shrink-0 text-muted-foreground">Bez dat</span>
                    ) : (
                      <span className="shrink-0 font-medium">
                        {r.pct}% <span className="text-muted-foreground">({r.sampleCount})</span>
                      </span>
                    )}
                  </div>
                  {r.pct !== null && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${barColor(r.pct)}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  )}
                  {r.pct !== null && r.pct < 50 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-1.5 text-[11px]"
                      onClick={() => setGameTopic(weakSpotGameTopic(`${topicTitle} – ${r.title}`, r.pct))}
                    >
                      <Gamepad2 className="h-3 w-3" /> Vytvořit hru na tohle
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
      <QuickGameDialog
        open={gameTopic !== null}
        onOpenChange={(o) => !o && setGameTopic(null)}
        onSaved={() => setGameTopic(null)}
        initialTopic={gameTopic ?? undefined}
        initialType="mcq"
      />
    </Collapsible>
  );
};

export default CurriculumTopicWeakSpots;
