import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  ArrowLeft,
  BookOpen,
  MapPin,
  Users,
  Calendar as CalendarIcon,
  ClipboardList,
  TrendingUp,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { expandScheduleSlots, formatTime } from "@/lib/calendar-utils";
import { colorForSubject } from "@/lib/teacher-schedule-store";

interface ClassRow {
  id: string;
  name: string;
  school: string;
  field_of_study: string;
  year: number | null;
}

interface ScheduleSlot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  valid_from: string | null;
  valid_to: string | null;
  subject_label: string;
  room: string | null;
  color: string | null;
  abbreviation: string | null;
  textbook_id: string | null;
  textbook_type: string | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  created_at: string;
  class_id: string | null;
}

interface AttemptRow {
  id: string;
  assignment_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
}

const decodeSubject = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

type AttemptState = "not_submitted" | "submitted" | "graded";

const stateMeta: Record<AttemptState, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  not_submitted: { label: "Neodevzdáno", variant: "outline" },
  submitted: { label: "Odevzdáno", variant: "secondary" },
  graded: { label: "Ohodnoceno", variant: "default" },
};

export default function StudentSubjectClass() {
  const { subjectId = "", classId = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const subjectLabel = useMemo(() => decodeSubject(subjectId), [subjectId]);

  const [klass, setKlass] = useState<ClassRow | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      // Verify membership
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      const [classRes, slotsRes, assignRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, school, field_of_study, year")
          .eq("id", classId)
          .maybeSingle(),
        supabase
          .from("class_schedule_slots" as any)
          .select("*")
          .eq("class_id", classId),
        supabase
          .from("assignments")
          .select("id, title, description, status, deadline, created_at, class_id")
          .eq("class_id", classId)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      setKlass((classRes.data as ClassRow) ?? null);
      const allSlots = ((slotsRes.data as any[]) ?? []) as ScheduleSlot[];
      const filtered = allSlots.filter(
        (s) =>
          (s.subject_label || "").trim().toLowerCase() ===
          subjectLabel.trim().toLowerCase(),
      );
      setSlots(filtered);

      const _assignments = (assignRes.data as AssignmentRow[]) ?? [];
      setAssignments(_assignments);

      if (_assignments.length) {
        const { data: aData } = await supabase
          .from("assignment_attempts")
          .select("id, assignment_id, status, score, max_score, submitted_at")
          .eq("student_id", user.id)
          .in(
            "assignment_id",
            _assignments.map((a) => a.id),
          );
        if (!cancelled) setAttempts((aData as AttemptRow[]) ?? []);
      } else {
        setAttempts([]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate, classId, subjectLabel]);

  const subjectColor = slots[0]?.color || colorForSubject(subjectLabel);
  const abbr =
    slots[0]?.abbreviation || subjectLabel.slice(0, 3).toUpperCase();
  const room = slots[0]?.room || "";
  const linkedTextbookId = useMemo(() => {
    const fromSlot = slots.find((s) => s.textbook_id);
    return fromSlot?.textbook_id ?? null;
  }, [slots]);

  // Past + upcoming occurrences (±60 days)
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 60);
  const future = new Date(now);
  future.setDate(future.getDate() + 60);

  const occurrences = useMemo(() => {
    const events = expandScheduleSlots(slots as any, past, future);
    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [slots]);

  const pastLessons = occurrences.filter((e) => e.end < now).slice(-15).reverse();
  const upcomingLessons = occurrences.filter((e) => e.start >= now).slice(0, 15);

  // Compute student's own results
  const attemptByAssignment = useMemo(() => {
    const m = new Map<string, AttemptRow>();
    for (const a of attempts) {
      const ex = m.get(a.assignment_id);
      // Prefer submitted/graded over in_progress
      if (!ex || (ex.status === "in_progress" && a.status !== "in_progress")) {
        m.set(a.assignment_id, a);
      }
    }
    return m;
  }, [attempts]);

  function attemptState(a: AssignmentRow): AttemptState {
    const att = attemptByAssignment.get(a.id);
    if (!att || att.status === "in_progress") return "not_submitted";
    if (att.status === "submitted" && att.score == null) return "submitted";
    if (att.score != null) return "graded";
    return "submitted";
  }

  const myStats = useMemo(() => {
    let total = 0;
    let max = 0;
    let submitted = 0;
    let graded = 0;
    for (const a of assignments) {
      const att = attemptByAssignment.get(a.id);
      if (!att) continue;
      if (att.status === "submitted") {
        submitted += 1;
        if (att.score != null && att.max_score) {
          total += att.score;
          max += att.max_score;
          graded += 1;
        }
      }
    }
    return {
      submitted,
      graded,
      total,
      max,
      pct: max > 0 ? Math.round((total / max) * 100) : null,
    };
  }, [assignments, attemptByAssignment]);

  function openTextbook() {
    if (linkedTextbookId) navigate(`/student/ucebnice/${linkedTextbookId}`);
    else navigate("/student/ucebnice");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main
          className="flex-1 container mx-auto px-4 py-12 max-w-6xl"
          style={{ paddingTop: "calc(70px + 3rem)" }}
        >
          <div className="text-center text-muted-foreground py-20">Načítání…</div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!klass) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main
          className="flex-1 container mx-auto px-4 py-12 max-w-6xl"
          style={{ paddingTop: "calc(70px + 3rem)" }}
        >
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Tato třída pro tebe není dostupná.
            </p>
            <Button className="mt-4" onClick={() => navigate("/student")}>
              Zpět na přehled
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-8 max-w-6xl"
        style={{ paddingTop: "calc(70px + 2rem)" }}
      >
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zpět
        </Button>

        {/* Header */}
        <Card
          className="overflow-hidden mb-6 border-l-8"
          style={{ borderLeftColor: subjectColor }}
        >
          <div className="p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-lg text-white text-xl font-bold shrink-0"
              style={{ backgroundColor: subjectColor }}
            >
              {abbr}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl md:text-3xl font-bold truncate">
                {subjectLabel}
              </h1>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {klass.name}
                  {klass.year ? ` · ${klass.year}. ročník` : ""}
                </span>
                {room && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {room}
                  </span>
                )}
              </div>
            </div>
            {linkedTextbookId && (
              <Button variant="outline" onClick={openTextbook}>
                <BookOpen className="h-4 w-4 mr-2" />
                Otevřít učebnici
              </Button>
            )}
          </div>
        </Card>

        <Tabs defaultValue="past" className="w-full">
          <TabsList>
            <TabsTrigger value="past">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Proběhnuté
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Nadcházející
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <ClipboardList className="h-4 w-4 mr-2" />
              Úkoly ({assignments.length})
            </TabsTrigger>
            <TabsTrigger value="results">
              <TrendingUp className="h-4 w-4 mr-2" />
              Výsledky
            </TabsTrigger>
          </TabsList>

          {/* PAST */}
          <TabsContent value="past" className="mt-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Co jste probrali
            </h2>
            {pastLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Zatím žádné proběhnuté hodiny.
              </p>
            ) : (
              <div className="space-y-2">
                {pastLessons.map((e) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {format(e.start, "EEE d. M.", { locale: cs })} ·{" "}
                          {formatTime(e.start)}
                        </div>
                        {e.room && (
                          <div className="text-xs text-muted-foreground truncate">
                            {e.room}
                          </div>
                        )}
                      </div>
                      {linkedTextbookId && (
                        <Button size="sm" variant="ghost" onClick={openTextbook}>
                          <BookOpen className="h-3.5 w-3.5 mr-1" />
                          Materiál
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* UPCOMING */}
          <TabsContent value="upcoming" className="mt-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Co tě čeká
            </h2>
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Žádné nadcházející hodiny.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingLessons.map((e) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {format(e.start, "EEE d. M.", { locale: cs })} ·{" "}
                          {formatTime(e.start)} – {formatTime(e.end)}
                        </div>
                        {e.room && (
                          <div className="text-xs text-muted-foreground truncate">
                            {e.room}
                          </div>
                        )}
                      </div>
                      {linkedTextbookId && (
                        <Button size="sm" variant="ghost" onClick={openTextbook}>
                          <BookOpen className="h-3.5 w-3.5 mr-1" />
                          Příprava
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ASSIGNMENTS */}
          <TabsContent value="assignments" className="mt-4">
            {assignments.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Pro tuto třídu zatím nemáš žádné úkoly.
              </Card>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => {
                  const state = attemptState(a);
                  const meta = stateMeta[state];
                  const att = attemptByAssignment.get(a.id);
                  const overdue =
                    a.deadline && new Date(a.deadline) < now && state === "not_submitted";
                  return (
                    <Card key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{a.title}</h3>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                            {overdue && (
                              <Badge variant="destructive">Po termínu</Badge>
                            )}
                          </div>
                          {a.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {a.description}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                            {a.deadline && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Termín{" "}
                                {format(new Date(a.deadline), "d. M. yyyy HH:mm", {
                                  locale: cs,
                                })}
                              </span>
                            )}
                            {state === "graded" &&
                              att &&
                              att.max_score != null && (
                                <span>
                                  Hodnocení: {att.score}/{att.max_score} b
                                </span>
                              )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/student/ulohy/${a.id}`)}
                        >
                          {state === "not_submitted" ? "Otevřít" : "Detail"}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* RESULTS */}
          <TabsContent value="results" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Tvůj průměr</div>
                <div className="text-3xl font-bold mt-1">
                  {myStats.pct !== null ? `${myStats.pct} %` : "—"}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Odevzdáno</div>
                <div className="text-3xl font-bold mt-1 tabular-nums">
                  {myStats.submitted}
                  <span className="text-base text-muted-foreground font-normal">
                    {" "}
                    / {assignments.length}
                  </span>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground">Body</div>
                <div className="text-3xl font-bold mt-1 tabular-nums">
                  {myStats.total}
                  {myStats.max > 0 && (
                    <span className="text-base text-muted-foreground font-normal">
                      {" "}
                      / {myStats.max}
                    </span>
                  )}
                </div>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 text-sm font-medium">
                Tvoje výsledky v jednotlivých úkolech
              </div>
              {assignments.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Žádné úkoly.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {assignments.map((a) => {
                    const att = attemptByAssignment.get(a.id);
                    const state = attemptState(a);
                    const meta = stateMeta[state];
                    return (
                      <div
                        key={a.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="text-sm truncate min-w-0">{a.title}</div>
                        <div className="flex items-center gap-3 text-sm shrink-0">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <span className="font-medium tabular-nums w-20 text-right">
                            {att && att.score != null && att.max_score != null
                              ? `${att.score}/${att.max_score} b`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}
