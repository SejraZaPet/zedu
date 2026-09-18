import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { fetchAssignmentStudentIds, fetchLessonSuccessPct } from "@/lib/assignment-difficulty";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  /** Index aktivity v lekci – trend se počítá právě pro ni. */
  activityIndex: number;
  activityTitle: string;
}

interface TrendPoint {
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
 * Vývoj úspěšnosti STEJNÉ aktivity lekce napříč úkoly v čase
 * (řazeno podle data zadání úkolu).
 */
const AssignmentDifficultyTrend = ({
  open,
  onOpenChange,
  lessonId,
  activityIndex,
  activityTitle,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<TrendPoint[]>([]);

  useEffect(() => {
    if (!open || !lessonId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("assignments")
        .select("id, title, created_at, class_id, group_id, classes(name)")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });

      const rows = (data as any[]) || [];
      const out: TrendPoint[] = [];
      for (const a of rows) {
        const studentIds = await fetchAssignmentStudentIds(a);
        const { pct, sampleCount } = await fetchLessonSuccessPct({
          lessonId,
          studentIds,
          activityIndex,
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
      if (!cancelled) {
        setPoints(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lessonId, activityIndex]);

  const withData = points.filter((p) => p.pct !== null);
  const first = withData[0]?.pct ?? null;
  const last = withData[withData.length - 1]?.pct ?? null;
  const delta = first !== null && last !== null && withData.length > 1 ? last - first : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trend úspěšnosti v čase</DialogTitle>
          <DialogDescription className="truncate">{activityTitle}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : points.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tato lekce není zadaná v žádné úloze.</p>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {points.map((p) => (
                <li key={p.assignmentId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">
                      {new Date(p.date).toLocaleDateString("cs-CZ")} · {p.className}
                      <span className="text-muted-foreground"> · {p.title}</span>
                    </span>
                    {p.pct === null ? (
                      <span className="shrink-0 text-muted-foreground">Bez odpovědí</span>
                    ) : (
                      <span className="shrink-0 font-medium">
                        {p.pct}% <span className="text-muted-foreground">({p.sampleCount})</span>
                      </span>
                    )}
                  </div>
                  {p.pct !== null && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${barColor(p.pct)}`} style={{ width: `${p.pct}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {delta !== null && (
              <p className="text-xs text-muted-foreground">
                Od prvního po poslední zadání {delta >= 0 ? "zlepšení" : "zhoršení"} o{" "}
                <strong>{Math.abs(delta)} procentních bodů</strong>.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentDifficultyTrend;
