import { Button } from "@/components/ui/button";
import type { LessonActivityProgress } from "@/lib/lesson-activity-progress";
import { formatActivityPercent, formatActivityScore } from "@/lib/lesson-activity-progress";

export function LessonSuccessSummary({ progress }: { progress: LessonActivityProgress }) {
  if (progress.total === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="lesson-success-title">
      <h2 id="lesson-success-title" className="font-heading text-lg font-semibold text-foreground">Úspěšnost lekce</h2>
      <p className="mt-1 text-sm text-foreground">
        Povinné aktivity: {progress.done} z {progress.total} hotovo
        {progress.successPct !== null && <> · úspěšnost {progress.successPct} %</>}
      </p>
      {progress.done === 0 && <p className="mt-2 text-sm text-muted-foreground">Zatím nic hotovo</p>}
      <ul className="mt-3 space-y-1.5">
        {progress.required.map(({ activity, best }) => {
          const percent = best ? formatActivityPercent(best) : null;
          return (
            <li key={activity.index} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{activity.title}</span>
              <span className={best ? "font-medium text-foreground" : "text-muted-foreground"}>
                {best ? `${formatActivityScore(best)}${percent ? ` · ${percent}` : ""}` : "Chybí"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LessonCompletionControl({
  teacher,
  allRequiredDone,
  completedCount,
  requiredCount,
  onComplete,
}: {
  teacher: boolean;
  allRequiredDone: boolean;
  completedCount: number;
  requiredCount: number;
  onComplete: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={teacher ? undefined : onComplete}
        disabled={teacher || !allRequiredDone}
        variant="hero"
        className="gap-2"
      >
        ✓ Označit lekci jako dokončenou
      </Button>
      {teacher ? (
        <p className="text-sm text-muted-foreground">Tlačítko je jen pro žáky</p>
      ) : !allRequiredDone ? (
        <p className="text-center text-sm text-muted-foreground">
          Nejdřív dokonči povinné aktivity ({completedCount}/{requiredCount} hotovo)
        </p>
      ) : null}
    </div>
  );
}