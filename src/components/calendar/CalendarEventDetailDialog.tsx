import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, PlayCircle, MapPin, Users, Clock } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar-utils";
import { formatTime } from "@/lib/calendar-utils";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { useToast } from "@/hooks/use-toast";
import { getPhasePlan } from "@/lib/lesson-phase-plans";

interface Props {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Detail of a calendar event (lesson) with the three quick actions
 * required for the teacher calendar: open textbook, open lesson plan,
 * launch live presentation.
 */
export default function CalendarEventDetailDialog({ event, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subjects } = useTeacherSubjects();

  const matchedTextbookId = useMemo(() => {
    if (!event?.subject) return undefined;
    const key = event.subject.trim().toLowerCase();
    return subjects.find((s) => s.label.toLowerCase() === key)?.teacherTextbookId;
  }, [subjects, event?.subject]);

  if (!event) return null;

  const dateLabel = format(event.start, "EEEE d. MMMM yyyy", { locale: cs });
  const timeLabel = `${formatTime(event.start)} – ${formatTime(event.end)}`;

  function openTextbook() {
    if (matchedTextbookId) {
      navigate(`/ucitel/ucebnice/${matchedTextbookId}/lekce`);
    } else {
      toast({
        title: "Učebnice není propojena",
        description: "Pro tento předmět nemáš vlastní učebnici. Otevírám seznam učebnic.",
      });
      navigate("/ucitel/ucebnice");
    }
    onOpenChange(false);
  }

  function openLessonPlan() {
    const params = new URLSearchParams();
    if (event!.subject) params.set("subject", event!.subject);
    params.set("date", format(event!.start, "yyyy-MM-dd"));
    params.set("start", formatTime(event!.start));
    params.set("end", formatTime(event!.end));
    if (event!.classId) params.set("classId", event!.classId);
    navigate(`/ucitel/plany-hodin/novy?${params.toString()}`);
    onOpenChange(false);
  }

  function launchLesson() {
    if (matchedTextbookId) {
      navigate(`/ucitel/ucebnice/${matchedTextbookId}/lekce?launch=1`);
    } else {
      toast({
        title: "Vyber konkrétní lekci",
        description: "Pro spuštění prezentace zvol lekci v učebnici.",
      });
      navigate("/ucitel/ucebnice");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event.abbreviation && (
              <span
                className="inline-flex items-center justify-center text-xs font-semibold text-white rounded px-2 py-0.5"
                style={{ backgroundColor: event.color || "hsl(var(--primary))" }}
              >
                {event.abbreviation}
              </span>
            )}
            <span className="truncate">{event.title}</span>
          </DialogTitle>
          <DialogDescription>
            {dateLabel} · {timeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {event.className && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{event.className}</span>
            </div>
          )}
          {event.room && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{event.room}</span>
            </div>
          )}
        </div>

        {(() => {
          const plan = getPhasePlan(
            event.subject,
            format(event.start, "yyyy-MM-dd"),
            formatTime(event.start),
          );
          if (!plan || !plan.phases?.some((p) => p.timeMin > 0)) return null;
          const total = plan.phases.reduce((s, p) => s + (p.timeMin || 0), 0);
          return (
            <div className="mt-3 rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Harmonogram hodiny
                </span>
                <span className="text-muted-foreground tabular-nums">{total} min</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {plan.phases
                    .filter((p) => p.timeMin > 0)
                    .map((p) => (
                      <tr key={p.key} className="border-t border-border">
                        <td className="px-3 py-1.5">{p.title}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground w-20">
                          {p.timeMin} min
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        <div className="grid gap-2 mt-2">
          <Button variant="outline" onClick={openTextbook} className="justify-start">
            <BookOpen className="h-4 w-4 mr-2" />
            Otevřít učebnici
          </Button>
          <Button variant="outline" onClick={openLessonPlan} className="justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Plán hodiny
          </Button>
          <Button onClick={launchLesson} className="justify-start">
            <PlayCircle className="h-4 w-4 mr-2" />
            Spustit lekci
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
