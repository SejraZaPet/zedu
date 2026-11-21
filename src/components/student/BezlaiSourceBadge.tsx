import { BookOpenCheck, ShieldQuestion, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BEZLAI_GENERAL_SOURCE_LABEL, BEZLAI_VERIFICATION_GUIDE } from "@/lib/bezlai-verification";

export interface BezlaiResponseSource {
  title: string;
  kind: string;
  href?: string;
}

interface BezlaiSourceBadgeProps {
  grounded: boolean;
  sources: BezlaiResponseSource[];
  onGuide: () => void;
  onTeacher?: () => void;
}

/** Stav dodává server podle skutečně vložených úryvků, nikdy podle textu odpovědi. */
export default function BezlaiSourceBadge({ grounded, sources, onGuide, onTeacher }: BezlaiSourceBadgeProps) {
  if (grounded && sources.length > 0) {
    return (
      <div role="note" className="bezlai-source-badge bezlai-source-badge--grounded mt-1 max-w-full rounded-xl border px-3 py-2 text-xs">
        <div className="flex items-start gap-2">
          <BookOpenCheck className="bezlai-source-badge__icon mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <span className="font-semibold">Z tvých materiálů:</span>
            <ul className="mt-1 space-y-1">
              {sources.map((source, index) => (
                <li key={`${source.title}-${index}`} className="break-words">
                  {source.href ? (
                    <Link to={source.href} className="inline-flex items-start gap-1 font-medium underline underline-offset-2">
                      <span>{source.title}</span><span className="sr-only"> – otevřít zdroj</span>
                    </Link>
                  ) : <span>{source.title}</span>}
                  <span className="text-muted-foreground"> ({source.kind})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="note" className="bezlai-source-badge bezlai-source-badge--general mt-1 max-w-full rounded-xl border px-3 py-2 text-xs">
      <div className="flex items-start gap-2">
        <TriangleAlert className="bezlai-source-badge__icon mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">{BEZLAI_GENERAL_SOURCE_LABEL}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-11 gap-2 bg-card" onClick={onGuide}>
          <BookOpenCheck className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.title}
        </Button>
        {onTeacher && (
          <Button type="button" variant="outline" size="sm" className="min-h-11 gap-2 bg-card" onClick={onTeacher}>
            <ShieldQuestion className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.teacherLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
