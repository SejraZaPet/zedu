import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addWeeks,
  subWeeks,
  endOfISOWeek,
  format,
  startOfDay,
  endOfDay,
} from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import CalendarWeekGrid from "@/components/calendar/CalendarWeekGrid";
import CalendarEventDetailDialog from "@/components/calendar/CalendarEventDetailDialog";
import {
  type CalendarEvent,
  expandScheduleSlots,
  getWeekRange,
} from "@/lib/calendar-utils";
import { expandTeacherSchedule, loadSchedule } from "@/lib/teacher-schedule-store";
import LessonReflectionDialog from "@/components/lessons/LessonReflectionDialog";
import { fetchReflections, reflectionKey } from "@/lib/lesson-reflections";

const TeacherCalendar = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(
    () => getWeekRange(new Date()).start,
  );
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [reflectionEvent, setReflectionEvent] = useState<CalendarEvent | null>(null);
  /** Map of YYYY-MM-DD|subject|classId → present|missing */
  const [reflectionMap, setReflectionMap] = useState<Record<string, "missing" | "present">>({});
  const [reflectionVersion, setReflectionVersion] = useState(0);

  async function reloadReflections(evts: CalendarEvent[]) {
    if (!user) return;
    const lessonEvents = evts.filter(
      (e) => e.type === "lesson" && e.end < new Date() && e.subject && e.classId,
    );
    if (!lessonEvents.length) {
      setReflectionMap({});
      return;
    }
    const dates = lessonEvents.map((e) => format(e.start, "yyyy-MM-dd"));
    const fromDate = dates.reduce((a, b) => (a < b ? a : b));
    const toDate = dates.reduce((a, b) => (a > b ? a : b));
    const rows = await fetchReflections({ teacherId: user.id, fromDate, toDate });
    const present = new Set(
      rows
        .filter((r) => r.reflection_date)
        .map((r) =>
          reflectionKey({
            subject: r.subject,
            classId: r.class_id,
            date: r.reflection_date!,
          }),
        ),
    );
    const next: Record<string, "missing" | "present"> = {};
    for (const e of lessonEvents) {
      const k = reflectionKey({
        subject: e.subject,
        classId: e.classId,
        date: format(e.start, "yyyy-MM-dd"),
      });
      next[e.id] = present.has(k) ? "present" : "missing";
    }
    setReflectionMap(next);
  }

  const range = useMemo(() => {
    if (viewMode === "day") {
      return { from: startOfDay(selectedDay), to: endOfDay(selectedDay) };
    }
    return { from: weekStart, to: endOfISOWeek(weekStart) };
  }, [weekStart, viewMode, selectedDay]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { from, to } = range;
      const [slotsRes, assignmentsRes, todosRes] = await Promise.all([
        supabase
          .from("class_schedule_slots" as any)
          .select("*, classes(name)"),
        supabase
          .from("assignments")
          .select("id, title, deadline, class_id")
          .eq("teacher_id", user.id)
          .not("deadline", "is", null)
          .gte("deadline", from.toISOString())
          .lte("deadline", to.toISOString()),
        supabase
          .from("todos")
          .select("id, title, due_date, priority")
          .eq("user_id", user.id)
          .not("due_date", "is", null)
          .gte("due_date", format(from, "yyyy-MM-dd"))
          .lte("due_date", format(to, "yyyy-MM-dd"))
          .neq("status", "done"),
      ]);

      if (cancelled) return;

      const lessonEvents = expandScheduleSlots(
        ((slotsRes.data as any[]) ?? []) as any,
        from,
        to,
      );

      const personalEvents = expandTeacherSchedule(loadSchedule(), from, to);

      const assignmentEvents: CalendarEvent[] = ((assignmentsRes.data as any[]) ?? [])
        .map((a: any) => {
          const start = new Date(a.deadline);
          return {
            id: `assignment-${a.id}`,
            type: "assignment" as const,
            title: a.title,
            start,
            end: new Date(start.getTime() + 30 * 60000),
            assignmentId: a.id,
          };
        });

      const todoEvents: CalendarEvent[] = ((todosRes.data as any[]) ?? []).map(
        (t: any) => {
          const start = new Date(`${t.due_date}T09:00:00`);
          return {
            id: `todo-${t.id}`,
            type: "todo" as const,
            title: t.title,
            start,
            end: new Date(start.getTime() + 30 * 60000),
            todoId: t.id,
            priority: t.priority,
          };
        },
      );

      const merged = [...lessonEvents, ...personalEvents, ...assignmentEvents, ...todoEvents];
      setEvents(merged);
      setLoading(false);
      reloadReflections(merged);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate, range, reflectionVersion]);

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === "lesson") {
      if (event.classId && event.subject) {
        navigate(
          `/ucitel/predmet/${encodeURIComponent(event.subject)}/trida/${event.classId}`,
        );
      } else {
        setDetailEvent(event);
      }
    } else if (event.type === "assignment") navigate("/ucitel/ulohy");
    else navigate("/todo");
  };

  const rangeLabel =
    viewMode === "day"
      ? format(selectedDay, "d. MMMM yyyy", { locale: cs })
      : `${format(weekStart, "d. M.", { locale: cs })} – ${format(
          endOfISOWeek(weekStart),
          "d. M. yyyy",
          { locale: cs },
        )}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-6xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold">Můj kalendář</h1>
          <p className="text-muted-foreground mt-1">
            Rozvrh tříd a termíny zadaných úkolů
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              aria-label="Předchozí týden"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWeekStart(getWeekRange(new Date()).start);
                setSelectedDay(new Date());
              }}
            >
              Dnes
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              aria-label="Další týden"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground ml-2">
              {rangeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
            >
              Týden
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
            >
              Den
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Načítání…
          </div>
        ) : (
          <CalendarWeekGrid
            events={events}
            weekStart={weekStart}
            viewMode={viewMode}
            selectedDay={selectedDay}
            onEventClick={handleEventClick}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: "#dbeafe", border: "1px solid #93c5fd" }}
            />
            Hodina
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: "#fed7aa", border: "1px solid #fb923c" }}
            />
            Úkol (deadline)
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ backgroundColor: "#bbf7d0", border: "1px solid #4ade80" }}
            />
            Můj úkol
          </span>
        </div>
      </main>
      <CalendarEventDetailDialog
        event={detailEvent}
        open={!!detailEvent}
        onOpenChange={(o) => { if (!o) setDetailEvent(null); }}
      />
      <SiteFooter />
    </div>
  );
};

export default TeacherCalendar;
