import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ClipboardList, ArrowRight } from "lucide-react";
import { format, startOfDay, endOfDay, addDays, differenceInCalendarDays, isSameDay } from "date-fns";
import { cs } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { expandScheduleSlots, formatTime, type CalendarEvent } from "@/lib/calendar-utils";

interface Props {
  role: "student" | "teacher";
}

interface UpcomingAssignment {
  id: string;
  title: string;
  deadline: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const relativeDeadline = (deadline: Date, now: Date): string => {
  const days = differenceInCalendarDays(deadline, now);
  if (days <= 0) return "dnes";
  if (days === 1) return "zítra";
  if (days < 7) return `za ${days} ${days < 5 ? "dny" : "dní"}`;
  return `v ${format(deadline, "EEEE", { locale: cs })}`;
};

const deadlineColorClass = (deadline: Date, now: Date): string => {
  const days = differenceInCalendarDays(deadline, now);
  if (days <= 0) return "text-destructive font-medium";
  if (days === 1) return "font-medium";
  return "text-muted-foreground";
};

const TodayWidget = ({ role }: Props) => {
  const navigate = useNavigate();
  const [todayLessons, setTodayLessons] = useState<CalendarEvent[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<UpcomingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const calendarPath = role === "student" ? "/student/kalendar" : "/ucitel/kalendar";
  const assignmentsPath = role === "student" ? "/student/ulohy" : "/ucitel/ulohy";

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const today = new Date();
      const from = startOfDay(today);
      const to = endOfDay(today);

      const slotsRes = await supabase
        .from("class_schedule_slots" as any)
        .select("*, classes(name)");

      const slots = (slotsRes.data ?? []) as any[];
      const lessons = expandScheduleSlots(slots, from, to).sort(
        (a, b) => a.start.getTime() - b.start.getTime(),
      );

      const fromIso = new Date().toISOString();
      const toIso = addDays(today, 7).toISOString();

      let assignmentsQuery = supabase
        .from("assignments")
        .select("id, title, deadline, teacher_id, status")
        .not("deadline", "is", null)
        .gte("deadline", fromIso)
        .lte("deadline", toIso)
        .order("deadline", { ascending: true });

      if (role === "student") {
        assignmentsQuery = assignmentsQuery.eq("status", "published");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) assignmentsQuery = assignmentsQuery.eq("teacher_id", user.id);
      }

      const assignmentsRes = await assignmentsQuery;
      const assignments = (assignmentsRes.data ?? []) as UpcomingAssignment[];

      if (!mounted) return;
      setTodayLessons(lessons);
      setUpcomingAssignments(assignments);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [role]);

  const todayLabel = capitalize(format(now, "EEEE, d. MMMM", { locale: cs }));

  const lessonStatus = (ev: CalendarEvent): "past" | "current" | "future" => {
    if (now >= ev.start && now <= ev.end) return "current";
    if (now > ev.end) return "past";
    return "future";
  };

  const handleAssignmentClick = (id: string) => {
    if (role === "student") navigate(`/student/ulohy/${id}`);
    else navigate("/ucitel/ulohy");
  };

  const visibleAssignments = upcomingAssignments.slice(0, 5);
  const hasMoreAssignments = upcomingAssignments.length > 5;

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8">
      {/* Sekce 1: Dnes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Dnes</h2>
          </div>
          <span className="text-sm text-muted-foreground">{todayLabel}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : todayLessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {role === "student"
              ? "Dnes nemáš žádnou hodinu."
              : "Dnes nemáš žádnou hodinu v rozvrhu."}
          </p>
        ) : (
          <ul className="space-y-1">
            {todayLessons.map((ev) => {
              const status = lessonStatus(ev);
              const isCurrent = status === "current";
              const isPast = status === "past";
              return (
                <li
                  key={ev.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    isCurrent ? "bg-primary/10 font-medium" : ""
                  } ${isPast ? "opacity-60" : ""}`}
                >
                  <span className="font-mono text-xs w-24 shrink-0 text-muted-foreground">
                    {formatTime(ev.start)} – {formatTime(ev.end)}
                  </span>
                  <span className="flex-1 truncate">{ev.title}</span>
                  {ev.room && (
                    <span className="text-xs text-muted-foreground shrink-0">{ev.room}</span>
                  )}
                  {isCurrent && (
                    <Badge className="bg-primary text-primary-foreground shrink-0">
                      právě probíhá
                    </Badge>
                  )}
                  {isPast && (
                    <span className="text-xs text-muted-foreground shrink-0">proběhlo</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end mt-3">
          <button
            onClick={() => navigate(calendarPath)}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Zobrazit celý kalendář <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sekce 2: Nejbližší úkoly */}
      <div className="border-t border-border my-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Nejbližší úkoly</h2>
          </div>
          <span className="text-sm text-muted-foreground">následujících 7 dní</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : visibleAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {role === "student"
              ? "V příštích 7 dnech tě nečekají žádné úkoly."
              : "V příštích 7 dnech nemáš žádné termíny zadaných úkolů."}
          </p>
        ) : (
          <ul className="space-y-1">
            {visibleAssignments.map((a) => {
              const deadline = new Date(a.deadline);
              const days = differenceInCalendarDays(deadline, now);
              const colorClass = deadlineColorClass(deadline, now);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => handleAssignmentClick(a.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="shrink-0">
                      {days <= 0 ? "🔴" : days === 1 ? "🟠" : "⚪"}
                    </span>
                    <span className="flex-1 truncate">{a.title}</span>
                    <span
                      className={`text-xs shrink-0 ${colorClass}`}
                      style={days === 1 ? { color: "#ea580c" } : undefined}
                    >
                      {relativeDeadline(deadline, now)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMoreAssignments && (
          <div className="flex justify-end mt-3">
            <button
              onClick={() => navigate(assignmentsPath)}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Zobrazit všechny ({upcomingAssignments.length}){" "}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayWidget;
