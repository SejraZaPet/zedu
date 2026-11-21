import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { BookOpen, Clock, Eye, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import AssignmentDescription from "@/components/assignments/AssignmentDescription";
import AssignmentMaterialsList from "@/components/assignments/AssignmentMaterialsList";
import { parseMaterials } from "@/lib/assignment-materials";
import { assignmentDescriptionToText } from "@/lib/assignment-description";
import { assignmentWorksheets } from "@/lib/assignment-content";
import { resolveLinkedLesson, type LinkedLessonInfo } from "@/lib/linked-lesson";

export interface PreviewAssignment {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  materials?: unknown;
  worksheet_id?: string | null;
  lesson_id?: string | null;
  lesson_source?: string | null;
  settings?: unknown;
}

/** Krátký začátek popisu pro zavřený stav. */
export const PREVIEW_EXCERPT_CHARS = 160;
export function previewExcerpt(description?: string | null): { text: string; truncated: boolean } {
  const text = description ? assignmentDescriptionToText(description).trim() : "";
  if (text.length <= PREVIEW_EXCERPT_CHARS) return { text, truncated: false };
  return { text: `${text.slice(0, PREVIEW_EXCERPT_CHARS).trimEnd()}…`, truncated: true };
}

interface Props {
  assignment: PreviewAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Žákovský pohled na zadání – jen čtení. Nevytváří pokus, nic neukládá;
 * načítá pouze název propojené lekce a podepsané adresy materiálů.
 */
export default function AssignmentStudentPreview({ assignment, open, onOpenChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [lesson, setLesson] = useState<LinkedLessonInfo | null>(null);
  const materials = useMemo(() => parseMaterials(assignment?.materials), [assignment?.materials]);
  const worksheets = useMemo(() => (assignment ? assignmentWorksheets(assignment) : []), [assignment]);
  const excerpt = previewExcerpt(assignment?.description);
  const hasMore = excerpt.truncated || materials.length > 0;

  useEffect(() => { if (open) setExpanded(false); }, [open, assignment?.id]);
  useEffect(() => {
    let alive = true;
    setLesson(null);
    if (open && assignment?.lesson_id) {
      resolveLinkedLesson(assignment.lesson_id, assignment.lesson_source ?? null)
        .then((info) => { if (alive) setLesson(info); })
        .catch(() => undefined);
    }
    return () => { alive = false; };
  }, [open, assignment?.lesson_id, assignment?.lesson_source]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-full overflow-y-auto sm:max-w-lg">
        {assignment && (
          <>
            <SheetHeader className="text-left">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Eye className="h-3.5 w-3.5" aria-hidden />Náhled zadání – takto ho uvidí žák
              </p>
              <SheetTitle className="break-words">{assignment.title}</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {assignment.deadline
                  ? `Termín: ${format(new Date(assignment.deadline), "d. M. yyyy HH:mm", { locale: cs })}`
                  : "Bez termínu"}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {expanded ? (
                assignment.description && (
                  <AssignmentDescription description={assignment.description} className="rounded-md border border-border bg-muted/30 p-3" />
                )
              ) : (
                excerpt.text && <p className="break-words text-sm text-foreground">{excerpt.text}</p>
              )}

              {(lesson || worksheets.length > 0) && (
                <ul className="space-y-2" aria-label="Propojený obsah">
                  {lesson && (
                    <li>
                      <Button asChild variant="outline" size="sm" className="min-h-11 w-full justify-start">
                        <Link to={lesson.url} target="_blank" rel="noopener"><BookOpen className="mr-2 h-4 w-4" aria-hidden />Lekce: {lesson.title}</Link>
                      </Button>
                    </li>
                  )}
                  {worksheets.map((worksheet) => (
                    <li key={worksheet.id}>
                      <Button asChild variant="outline" size="sm" className="min-h-11 w-full justify-start">
                        <Link to={`/ucitel/pracovni-listy/${worksheet.id}`} target="_blank" rel="noopener"><FileText className="mr-2 h-4 w-4" aria-hidden />Pracovní list: {worksheet.title}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {expanded && <AssignmentMaterialsList materials={materials} />}
              {!expanded && materials.length > 0 && (
                <p className="text-xs text-muted-foreground">Materiály k úkolu: {materials.length}</p>
              )}

              {hasMore && (
                <Button type="button" variant="secondary" className="min-h-11 w-full" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                  {expanded ? "Zobrazit méně" : "Zobrazit celé zadání"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Náhled nic neodevzdává ani neukládá.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
