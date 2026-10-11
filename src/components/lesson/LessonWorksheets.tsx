import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardList, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import StudentWorksheetPrintButtons from "@/components/worksheet/StudentWorksheetPrintButtons";
import InsertWorksheetButton from "@/components/notebook/InsertWorksheetButton";
import {
  assignmentForWorksheet, formatDeadline, pickLessonWorksheets,
  type LessonWorksheetAssignment, type LessonWorksheetRow,
} from "@/lib/lesson-worksheets";

/** Blok „Pracovní listy k lekci“ pro žáky (jen zobrazení; přístup hlídá RLS). */
export default function LessonWorksheets({ lessonId }: { lessonId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["lesson-worksheets", lessonId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("worksheets" as any)
        .select("id, title, status, show_in_lesson, scheduled_publish_at, source_lesson_id")
        .eq("source_lesson_id", lessonId)
        .eq("show_in_lesson", true)
        .eq("status", "published");
      if (error) return { worksheets: [], assignments: [] };
      const worksheets = pickLessonWorksheets((rows ?? []) as unknown as LessonWorksheetRow[], lessonId);
      let assignments: LessonWorksheetAssignment[] = [];
      if (worksheets.length) {
        const { data: a } = await supabase
          .from("assignments")
          .select("id, worksheet_id, deadline, status")
          .in("worksheet_id", worksheets.map((w) => w.id))
          .eq("status", "published");
        assignments = (a ?? []) as LessonWorksheetAssignment[];
      }
      return { worksheets, assignments };
    },
  });

  const worksheets = data?.worksheets ?? [];
  if (!worksheets.length) return null;

  return (
    <Card className="p-4 space-y-3" aria-labelledby="lesson-worksheets-title">
      <h2 id="lesson-worksheets-title" className="font-heading text-lg font-semibold flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" /> Pracovní listy k lekci
      </h2>
      <ul className="space-y-2">
        {worksheets.map((w) => {
          const a = assignmentForWorksheet(w.id, data?.assignments ?? []);
          return (
            <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
              <span className="font-medium mr-auto">{w.title}</span>
              {a && <Badge variant="secondary">Úkol: termín {formatDeadline(a.deadline)}</Badge>}
              <Button
                size="sm"
                onClick={() => navigate(a ? `/student/ulohy/${a.id}` : `/student/pracovni-list/${w.id}`)}
              >
                <PenLine className="h-3.5 w-3.5 mr-1" /> {a ? "Otevřít úkol" : "Vyplnit digitálně"}
              </Button>
              <InsertWorksheetButton worksheetId={w.id} assignmentId={a?.id ?? null} variant="outline" />
              <StudentWorksheetPrintButtons worksheetId={w.id} compact />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
