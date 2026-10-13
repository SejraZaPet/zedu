import { AlertTriangle, Check } from "lucide-react";
import type { ActivityProgressEntry } from "@/lib/lesson-activity-progress";
import { formatActivityScore } from "@/lib/lesson-activity-progress";

interface Props {
  entries: ActivityProgressEntry[];
  /** Žákovská varianta: u chybějící aktivity tlačítko „Otevřít“. */
  openHref?: (activityIndex: number) => string;
  /** Učitelská varianta: chybějící povinné zvýrazní výstrahou. */
  teacher?: boolean;
}

/** Seznam aktivit lekce s nejlepším výsledkem — jen zobrazení. */
export default function LessonActivityChecklist({ entries, openHref, teacher }: Props) {
  if (entries.length === 0) return null;
  const missing = entries.filter(({ best }) => !best);
  const missingWarning =
    teacher && missing.length > 0
      ? missing.length === 1
        ? `Chybí povinná aktivita: ${missing[0].activity.title}`
        : `Chybí povinné aktivity: ${missing.map(({ activity }) => activity.title).join(", ")}`
      : null;
  return (
    <div className="space-y-1.5">
      {missingWarning && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-label="Chybí povinná aktivita"
          />
          <span>{missingWarning}</span>
        </p>
      )}
      <ul className="space-y-1.5">
        {entries.map(({ activity, best }) => (
          <li key={activity.index} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {best ? (
              <span className="flex items-center gap-1.5 text-foreground">
                <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{activity.title}</span>
                <span className="text-muted-foreground">· {formatActivityScore(best)}</span>
                <span className="sr-only">hotovo</span>
              </span>
            ) : teacher ? (
              <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{activity.title}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{activity.title}</span>
            )}
            {!best && openHref && (
              <a
                href={openHref(activity.index)}
                className="inline-flex min-h-[36px] items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                Otevřít
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
