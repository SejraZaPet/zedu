import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CONTENT_TYPE_LABEL,
  resolveContentMaterials,
  type LessonContentMaterial,
  type ResolvedContent,
} from "@/lib/lesson-content-materials";

const ICON = { worksheet: FileText, presentation: Presentation, lesson: BookOpen } as const;

interface Props {
  items: LessonContentMaterial[];
  role: "teacher" | "student";
  onRemove?: (id: string) => void;
}

/** Seznam materiálů z knihovny u hodiny. Dostupnost ověřuje pod oprávněním přihlášeného uživatele. */
export default function LessonContentList({ items, role, onRemove }: Props) {
  // Žák nemá prohlížeč prezentací – prezentace mu nezobrazujeme.
  const visible = role === "student" ? items.filter((m) => m.contentType !== "presentation") : items;
  const [resolved, setResolved] = useState<Record<string, ResolvedContent> | null>(null);
  const key = visible.map((m) => m.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (!visible.length) return;
    resolveContentMaterials(visible, role)
      .then((r) => { if (!cancelled) setResolved(r); })
      .catch(() => { if (!cancelled) setResolved({}); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, role]);

  if (!visible.length) return null;
  return (
    <ul className="space-y-2 min-w-0" aria-label="Materiály z knihovny">
      {visible.map((m) => {
        const Icon = ICON[m.contentType];
        const href = resolved?.[m.id]?.href ?? null;
        const loading = resolved === null;
        return (
          <li key={m.id} className="flex items-center gap-2 rounded-md border border-border p-2 min-w-0">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground">{CONTENT_TYPE_LABEL[m.contentType]}</div>
              {loading ? (
                <div className="text-sm break-words">{m.title}</div>
              ) : href ? (
                <Link to={href} className="text-sm font-medium text-primary underline-offset-2 hover:underline break-words inline-flex min-h-[44px] sm:min-h-0 items-center">
                  {m.title}
                </Link>
              ) : (
                <div className="text-sm text-muted-foreground break-words">
                  {role === "teacher" ? `${m.title} – ` : ""}Materiál už není dostupný
                </div>
              )}
            </div>
            {onRemove && (
              <Button type="button" size="icon" variant="ghost" className="h-11 w-11 sm:h-8 sm:w-8 shrink-0" onClick={() => onRemove(m.id)} aria-label={`Odebrat ${m.title}`}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
