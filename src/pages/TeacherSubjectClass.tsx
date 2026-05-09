import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  ArrowLeft,
  BookOpen,
  PlayCircle,
  MapPin,
  Users,
  Calendar as CalendarIcon,
  FileText,
  ClipboardList,
  TrendingUp,
  Plus,
  CheckCircle2,
  Clock,
  Link2,
  Sparkles,
  Lock,
  Pencil,
  Star,
} from "lucide-react";
import LessonReflectionDialog from "@/components/lessons/LessonReflectionDialog";
import { fetchReflections, reflectionKey, type LessonReflection } from "@/lib/lesson-reflections";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { expandScheduleSlots, formatTime } from "@/lib/calendar-utils";

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

interface TeacherTextbookRow {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
}

interface LinkedSlot {
  subject?: string;
  classId?: string;
  className?: string;
  date?: string;
  time?: string;
}

interface LessonPlanRow {
  id: string;
  title: string;
  subject: string;
  created_at: string;
  updated_at: string;
  input_data: any;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  created_at: string;
}

interface AttemptRow {
  assignment_id: string;
  student_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
}

interface MemberRow {
  user_id: string;
  profiles?: { first_name: string; last_name: string } | null;
}

const decodeSubject = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export default function TeacherSubjectClass() {
  const { subjectId = "", classId = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { subjects } = useTeacherSubjects();

  const subjectLabel = useMemo(() => decodeSubject(subjectId), [subjectId]);

  const [klass, setKlass] = useState<ClassRow | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [plans, setPlans] = useState<LessonPlanRow[]>([]);
  const [planMethods, setPlanMethods] = useState<Record<string, { id: string; name: string }>>({});
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [teacherTextbooks, setTeacherTextbooks] = useState<TeacherTextbookRow[]>([]);
  const [linking, setLinking] = useState(false);
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState<string>("");
  const [assignPlanDate, setAssignPlanDate] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const [reflections, setReflections] = useState<Record<string, LessonReflection>>({});
  const [reflectionEvent, setReflectionEvent] = useState<{ date: string; subject: string; classId: string; label: string } | null>(null);
  const [reflectionVersion, setReflectionVersion] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const [classRes, slotsRes, plansRes, assignRes, membersRes] = await Promise.all([
        supabase.from("classes").select("id, name, school, field_of_study, year").eq("id", classId).maybeSingle(),
        supabase
          .from("class_schedule_slots" as any)
          .select("*")
          .eq("class_id", classId),
        supabase
          .from("lesson_plans")
          .select("id, title, subject, created_at, updated_at, input_data")
          .eq("teacher_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("assignments")
          .select("id, title, description, status, deadline, created_at")
          .eq("teacher_id", user.id)
          .eq("class_id", classId)
          .order("created_at", { ascending: false }),
        supabase
          .from("class_members")
          .select("user_id, profiles:profiles!class_members_user_id_fkey(first_name, last_name)")
          .eq("class_id", classId),
      ]);

      if (cancelled) return;

      setKlass((classRes.data as ClassRow) ?? null);
      const allSlots = ((slotsRes.data as any[]) ?? []) as ScheduleSlot[];
      // Filter slots to subject (case-insensitive label match)
      const filtered = allSlots.filter(
        (s) => (s.subject_label || "").trim().toLowerCase() === subjectLabel.trim().toLowerCase(),
      );
      setSlots(filtered);
      const _plans = (plansRes.data as LessonPlanRow[]) ?? [];
      setPlans(_plans);
      // Načíst přiřazené metody pro tyto plány
      const planIds = _plans.map((p) => p.id);
      if (planIds.length) {
        const { data: links } = await supabase
          .from("lesson_method_links")
          .select("lesson_plan_id, method_id, learning_methods(id, name)")
          .in("lesson_plan_id", planIds);
        const map: Record<string, { id: string; name: string }> = {};
        ((links as any[]) ?? []).forEach((l) => {
          const m = l.learning_methods;
          if (m) map[l.lesson_plan_id] = { id: m.id, name: m.name };
        });
        if (!cancelled) setPlanMethods(map);
      } else if (!cancelled) {
        setPlanMethods({});
      }
      const _assignments = (assignRes.data as AssignmentRow[]) ?? [];
      setAssignments(_assignments);

      // Members – try simple shape if join failed
      let _members = (membersRes.data as any[]) ?? [];
      if (!_members.length || (_members[0] && !_members[0].profiles)) {
        const { data: m2 } = await supabase
          .from("class_members")
          .select("user_id")
          .eq("class_id", classId);
        const ids = (m2 ?? []).map((r: any) => r.user_id);
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", ids);
          _members = (m2 ?? []).map((r: any) => ({
            user_id: r.user_id,
            profiles: (profs ?? []).find((p: any) => p.id === r.user_id) ?? null,
          }));
        }
      }
      setMembers(_members as MemberRow[]);

      // Load attempts for these assignments
      if (_assignments.length) {
        const { data: aData } = await supabase
          .from("assignment_attempts")
          .select("assignment_id, student_id, status, score, max_score")
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

  const matchedSubject = useMemo(
    () => subjects.find((s) => s.label.toLowerCase() === subjectLabel.toLowerCase()),
    [subjects, subjectLabel],
  );
  const linkedTextbookId = useMemo(() => {
    const fromSlot = slots.find(
      (s) => s.textbook_id && (s.textbook_type === "teacher" || !s.textbook_type),
    );
    return fromSlot?.textbook_id ?? null;
  }, [slots]);
  const subjectColor = matchedSubject?.color || slots[0]?.color || "hsl(var(--primary))";
  const abbr =
    matchedSubject?.abbreviation ||
    slots[0]?.abbreviation ||
    subjectLabel.slice(0, 3).toUpperCase();

  // Build past + upcoming lesson occurrences for next/previous 60 days
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

  useEffect(() => {
    if (!user || !classId) return;
    const dates = pastLessons.map((e) => format(e.start, "yyyy-MM-dd"));
    if (!dates.length) return;
    const fromDate = dates.reduce((a, b) => (a < b ? a : b));
    const toDate = dates.reduce((a, b) => (a > b ? a : b));
    let cancelled = false;
    (async () => {
      const rows = await fetchReflections({ teacherId: user.id, fromDate, toDate });
      if (cancelled) return;
      const map: Record<string, LessonReflection> = {};
      for (const r of rows) {
        if (!r.reflection_date) continue;
        const k = reflectionKey({ subject: r.subject, classId: r.class_id, date: r.reflection_date });
        map[k] = r;
      }
      setReflections(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, classId, pastLessons.length, reflectionVersion]);
  const upcomingLessons = occurrences.filter((e) => e.start >= now).slice(0, 15);

  const room = slots[0]?.room || "";

  // Plans relevant to this subject + class.
  // Match either by primary subject (legacy) or by linkedSlots.subject + classId.
  const subjectKey = subjectLabel.trim().toLowerCase();
  const relevantPlans = useMemo(() => {
    return plans.filter((p) => {
      const linked: LinkedSlot[] = p.input_data?.linkedSlots ?? [];
      const matchesLinked = linked.some(
        (s) =>
          (s.classId === classId || !s.classId) &&
          (s.subject || "").trim().toLowerCase() === subjectKey,
      );
      const matchesPrimary = (p.subject || "").trim().toLowerCase() === subjectKey;
      return matchesLinked || matchesPrimary;
    });
  }, [plans, classId, subjectKey]);

  /** Find a plan attached to a specific date (yyyy-MM-dd) for this class+subject. */
  function findPlanForDate(dateKey: string): LessonPlanRow | undefined {
    return relevantPlans.find((p) => {
      const linked: LinkedSlot[] = p.input_data?.linkedSlots ?? [];
      return linked.some(
        (s) =>
          s.date === dateKey &&
          (s.classId === classId || !s.classId) &&
          (!s.subject || s.subject.trim().toLowerCase() === subjectKey),
      );
    });
  }

  // Aggregations
  const studentScores = useMemo(() => {
    const map = new Map<string, { total: number; max: number; submitted: number; total_assigned: number }>();
    for (const m of members) {
      map.set(m.user_id, { total: 0, max: 0, submitted: 0, total_assigned: assignments.length });
    }
    for (const a of attempts) {
      if (a.status !== "submitted") continue;
      const e = map.get(a.student_id);
      if (!e) continue;
      e.total += a.score ?? 0;
      e.max += a.max_score ?? 0;
      e.submitted += 1;
    }
    return map;
  }, [members, attempts, assignments]);

  const classAvg = useMemo(() => {
    let total = 0;
    let max = 0;
    for (const v of studentScores.values()) {
      total += v.total;
      max += v.max;
    }
    return max > 0 ? Math.round((total / max) * 100) : null;
  }, [studentScores]);

  function openTextbook() {
    if (linkedTextbookId) {
      navigate(`/ucitel/ucebnice/${linkedTextbookId}`);
    } else {
      openLinkDialog();
    }
  }

  function launchLesson() {
    if (linkedTextbookId) {
      navigate(`/ucitel/ucebnice/${linkedTextbookId}/lekce?launch=1`);
    } else {
      toast({ title: "Nejdříve propoj učebnici" });
      openLinkDialog();
    }
  }

  async function openLinkDialog() {
    if (!user) return;
    setLinkOpen(true);
    if (teacherTextbooks.length === 0) {
      const { data, error } = await supabase
        .from("teacher_textbooks")
        .select("id, title, subject, description")
        .eq("teacher_id", user.id)
        .order("title", { ascending: true });
      if (error) {
        toast({
          title: "Nepodařilo se načíst učebnice",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      setTeacherTextbooks((data as TeacherTextbookRow[]) ?? []);
    }
  }

  async function linkTextbook(textbookId: string) {
    if (!slots.length) {
      toast({
        title: "Chybí hodina v rozvrhu",
        description: "Pro propojení učebnice musí mít předmět záznam v rozvrhu.",
        variant: "destructive",
      });
      return;
    }
    setLinking(true);
    const ids = slots.map((s) => s.id);
    const { error } = await supabase
      .from("class_schedule_slots" as any)
      .update({ textbook_id: textbookId, textbook_type: "teacher" })
      .in("id", ids);
    setLinking(false);
    if (error) {
      toast({ title: "Nepodařilo se propojit učebnici", description: error.message, variant: "destructive" });
      return;
    }
    setSlots((prev) =>
      prev.map((s) => ({ ...s, textbook_id: textbookId, textbook_type: "teacher" })),
    );
    setLinkOpen(false);
    toast({ title: "Učebnice propojena" });
  }

  function newAssignment() {
    navigate(`/ucitel/ulohy?classId=${classId}&subject=${encodeURIComponent(subjectLabel)}`);
  }

  function newLessonPlan(date?: Date) {
    const params = new URLSearchParams();
    params.set("subject", subjectLabel);
    params.set("classId", classId);
    if (date) params.set("date", format(date, "yyyy-MM-dd"));
    navigate(`/ucitel/plany-hodin/novy?${params.toString()}`);
  }

  function openAssignPlanDialog(date?: Date) {
    setAssignPlanId("");
    setAssignPlanDate(date ? format(date, "yyyy-MM-dd") : "");
    setAssignPlanOpen(true);
  }

  async function assignPlanToDate() {
    if (!assignPlanId || !assignPlanDate) {
      toast({ title: "Vyber plán a datum", variant: "destructive" });
      return;
    }
    const plan = plans.find((p) => p.id === assignPlanId);
    if (!plan) return;
    setAssigning(true);
    const occurrence = occurrences.find(
      (e) => format(e.start, "yyyy-MM-dd") === assignPlanDate,
    );
    const time = occurrence ? formatTime(occurrence.start) : undefined;
    const existing: LinkedSlot[] = plan.input_data?.linkedSlots ?? [];
    // Drop any prior link for the same date+class (re-assignment)
    const cleaned = existing.filter(
      (s) => !(s.date === assignPlanDate && (s.classId === classId || !s.classId)),
    );
    const next: LinkedSlot[] = [
      ...cleaned,
      {
        subject: subjectLabel,
        classId,
        className: klass?.name,
        date: assignPlanDate,
        time,
      },
    ];
    const newInput = { ...(plan.input_data || {}), linkedSlots: next };
    const { error } = await supabase
      .from("lesson_plans")
      .update({ input_data: newInput })
      .eq("id", plan.id);
    setAssigning(false);
    if (error) {
      toast({ title: "Nepodařilo se přiřadit plán", description: error.message, variant: "destructive" });
      return;
    }
    setPlans((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, input_data: newInput } : p)),
    );
    setAssignPlanOpen(false);
    toast({ title: "Plán přiřazen k termínu" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <div className="text-center text-muted-foreground py-20">Načítání…</div>
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
                {klass && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {klass.name}
                    {klass.year ? ` · ${klass.year}. ročník` : ""}
                  </span>
                )}
                {room && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {room}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {members.length} žáků
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {linkedTextbookId ? (
                <div className="flex items-center gap-1">
                  <Button variant="outline" onClick={openTextbook}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Otevřít učebnici
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Změnit propojenou učebnici"
                    onClick={openLinkDialog}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={openLinkDialog}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Přiřadit učebnici
                </Button>
              )}
              <Button onClick={launchLesson}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Spustit lekci
              </Button>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="stream" className="w-full">
          <TabsList>
            <TabsTrigger value="stream">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Průběh
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

          {/* STREAM */}
          <TabsContent value="stream" className="mt-4 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Past */}
              <section>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  Co jsme probrali
                </h2>
                {pastLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Zatím žádné proběhlé hodiny.</p>
                ) : (
                  <div className="space-y-2">
                    {pastLessons.map((e) => {
                      const dateStr = format(e.start, "EEE d. M.", { locale: cs });
                      const dateKey = format(e.start, "yyyy-MM-dd");
                      const planForDate = findPlanForDate(dateKey);
                      const refl = reflections[reflectionKey({ subject: subjectLabel, classId, date: dateKey })];
                      return (
                        <Card key={e.id} className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {dateStr} · {formatTime(e.start)}
                              </div>
                              {planForDate ? (
                                <div className="text-xs text-muted-foreground truncate">
                                  Plán: {planForDate.title}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  Bez plánu hodiny
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {planForDate && (
                                <Button size="sm" variant="ghost" onClick={() => navigate(`/ucitel/plany-hodin/${planForDate.id}`)}>
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  Otevřít
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={refl ? "ghost" : "outline"}
                                onClick={() => setReflectionEvent({ date: dateKey, subject: subjectLabel, classId, label: `${subjectLabel} · ${formatTime(e.start)}` })}
                              >
                                <Star className={`h-3.5 w-3.5 mr-1 ${refl ? "fill-yellow-400 text-yellow-400" : ""}`} />
                                {refl ? "Reflexe" : "Přidat reflexi"}
                              </Button>
                            </div>
                          </div>
                          {refl && (
                            <div className="mt-2 pt-2 border-t border-border space-y-1 text-xs">
                              {refl.rating ? (
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} className={`h-3 w-3 ${i < (refl.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                                  ))}
                                </div>
                              ) : null}
                              {refl.what_worked && (
                                <p className="text-muted-foreground"><span className="font-medium text-foreground">Fungovalo: </span>{refl.what_worked}</p>
                              )}
                              {refl.what_to_change && (
                                <p className="text-muted-foreground"><span className="font-medium text-foreground">Změnit: </span>{refl.what_to_change}</p>
                              )}
                              {refl.quick_notes && (
                                <p className="text-muted-foreground italic">{refl.quick_notes}</p>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Upcoming */}
              <section>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Co nás čeká
                  </h2>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAssignPlanDialog()}>
                      <Link2 className="h-3.5 w-3.5 mr-1" />
                      Přiřadit existující plán
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => newLessonPlan()}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Plán hodiny
                    </Button>
                  </div>
                </div>
                {upcomingLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Žádné nadcházející hodiny.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingLessons.map((e) => {
                      const dateKey = format(e.start, "yyyy-MM-dd");
                      const planForDate = findPlanForDate(dateKey);
                      return (
                        <Card key={e.id} className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {format(e.start, "EEE d. M.", { locale: cs })} · {formatTime(e.start)}
                              </div>
                              {planForDate ? (
                                <div className="text-xs text-muted-foreground truncate">
                                  Plán: {planForDate.title}
                                </div>
                              ) : e.room ? (
                                <div className="text-xs text-muted-foreground truncate">{e.room}</div>
                              ) : null}
                            </div>
                            {planForDate ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/ucitel/plany-hodin/${planForDate.id}`)}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Otevřít
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openAssignPlanDialog(e.start)}
                                >
                                  <Link2 className="h-3.5 w-3.5 mr-1" />
                                  Přiřadit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => newLessonPlan(e.start)}
                                >
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                  Nový
                                </Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          {/* ASSIGNMENTS */}
          <TabsContent value="assignments" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Zadané úkoly a testy</h2>
              <Button size="sm" onClick={newAssignment}>
                <Plus className="h-4 w-4 mr-1" />
                Nový úkol
              </Button>
            </div>
            {assignments.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Zatím nejsou zadané žádné úkoly pro tuto třídu.
              </Card>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => {
                  const subs = attempts.filter(
                    (t) => t.assignment_id === a.id && t.status === "submitted",
                  ).length;
                  return (
                    <Card key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{a.title}</h3>
                            <Badge variant={a.status === "published" ? "default" : "secondary"}>
                              {a.status === "published" ? "Publikováno" : a.status}
                            </Badge>
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
                                Termín {format(new Date(a.deadline), "d. M. yyyy HH:mm", { locale: cs })}
                              </span>
                            )}
                            <span>
                              Odevzdáno {subs}/{members.length}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/ucitel/ulohy`)}
                        >
                          Detail
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
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Průměr třídy</div>
                  <div className="text-3xl font-bold">
                    {classAvg !== null ? `${classAvg} %` : "—"}
                  </div>
                </div>
                <TrendingUp className="h-10 w-10 text-primary opacity-60" />
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 text-sm font-medium">
                Výsledky žáků
              </div>
              {members.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Ve třídě zatím nejsou žáci.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {members.map((m) => {
                    const sc = studentScores.get(m.user_id);
                    const pct = sc && sc.max > 0 ? Math.round((sc.total / sc.max) * 100) : null;
                    const name =
                      m.profiles
                        ? `${m.profiles.first_name} ${m.profiles.last_name}`.trim()
                        : "Žák";
                    return (
                      <div
                        key={m.user_id}
                        className="px-4 py-2.5 flex items-center justify-between"
                      >
                        <div className="text-sm">{name || "Žák"}</div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground tabular-nums">
                            {sc?.submitted ?? 0}/{assignments.length}
                          </span>
                          <span className="font-medium tabular-nums w-12 text-right">
                            {pct !== null ? `${pct} %` : "—"}
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
      {reflectionEvent && (
        <LessonReflectionDialog
          open={!!reflectionEvent}
          onOpenChange={(o) => { if (!o) setReflectionEvent(null); }}
          subject={reflectionEvent.subject}
          classId={reflectionEvent.classId}
          date={reflectionEvent.date}
          lessonLabel={reflectionEvent.label}
          onSaved={() => setReflectionVersion((v) => v + 1)}
        />
      )}
      <SiteFooter />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Propojit učebnici s předmětem</DialogTitle>
            <DialogDescription>
              Vyber jednu ze svých učebnic. Propojení se uloží do rozvrhu této třídy a předmětu „{subjectLabel}“.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {teacherTextbooks.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground text-center">
                Zatím nemáš žádné vlastní učebnice. Vytvoř ji v sekci Moje učebnice.
              </Card>
            ) : (
              teacherTextbooks.map((tb) => {
                const isCurrent = tb.id === linkedTextbookId;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    disabled={linking}
                    onClick={() => linkTextbook(tb.id)}
                    className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent transition disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{tb.title}</div>
                        {tb.subject && (
                          <div className="text-xs text-muted-foreground truncate">{tb.subject}</div>
                        )}
                      </div>
                      {isCurrent && <Badge variant="secondary">Propojená</Badge>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-2 rounded-lg border border-dashed border-border p-3 bg-muted/30 opacity-70">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-3.5 w-3.5" />
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Brzy: učebnice z tržiště
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Připravujeme možnost propojit ověřené učebnice z tržiště Zedu. Sleduj novinky.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>Zavřít</Button>
            <Button variant="outline" onClick={() => navigate("/ucitel/ucebnice")}>
              Spravovat učebnice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignPlanOpen} onOpenChange={setAssignPlanOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Přiřadit existující plán hodiny</DialogTitle>
            <DialogDescription>
              Vyberte plán a termín v rozvrhu třídy „{klass?.name}“ pro předmět „{subjectLabel}“.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="assign-plan-select">Plán hodiny</Label>
              {relevantPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pro tento předmět zatím nemáte žádné uložené plány.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setAssignPlanOpen(false);
                      newLessonPlan();
                    }}
                  >
                    Vytvořit nový
                  </button>
                </p>
              ) : (
                <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                  <SelectTrigger id="assign-plan-select">
                    <SelectValue placeholder="Vyberte plán" />
                  </SelectTrigger>
                  <SelectContent>
                    {relevantPlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title || "Bez názvu"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assign-plan-date">Termín z rozvrhu</Label>
              {upcomingLessons.length > 0 ? (
                <Select value={assignPlanDate} onValueChange={setAssignPlanDate}>
                  <SelectTrigger id="assign-plan-date">
                    <SelectValue placeholder="Vyberte termín" />
                  </SelectTrigger>
                  <SelectContent>
                    {upcomingLessons.map((e) => {
                      const key = format(e.start, "yyyy-MM-dd");
                      return (
                        <SelectItem key={e.id} value={key}>
                          {format(e.start, "EEE d. M. yyyy", { locale: cs })} · {formatTime(e.start)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="assign-plan-date"
                  type="date"
                  value={assignPlanDate}
                  onChange={(ev) => setAssignPlanDate(ev.target.value)}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignPlanOpen(false)}>Zrušit</Button>
            <Button onClick={assignPlanToDate} disabled={assigning || !assignPlanId || !assignPlanDate}>
              {assigning ? "Ukládám…" : "Přiřadit plán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
