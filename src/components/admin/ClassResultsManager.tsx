import { Fragment, useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, ArrowLeft, Users, Activity, BookOpen, Clock, ChevronRight, ChevronDown, Check } from "lucide-react";

interface ClassOverview {
  id: string;
  name: string;
  school: string;
  field_of_study: string;
  year: number | null;
  student_count: number;
  active_students: number;
  avg_success: number;
  total_lessons: number;
  total_activities: number;
  last_activity: string | null;
  /** "group" = skupina předmětu (subject_groups), jinak třída */
  kind?: "class" | "group";
  /** Pro skupiny: klíče předmětu (název, slug, předmět učebnice) pro filtr lekcí */
  subject_keys?: string[];
}

interface StudentDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  activity_count: number;
  lesson_count: number;
  avg_success: number;
  last_activity: string | null;
}

interface ActivityRow {
  user_id: string;
  lesson_id: string | null;
  activity_index: number;
  activity_type: string;
  score: number;
  max_score: number;
  completed_at: string | null;
}

interface CompletionRow {
  user_id: string;
  lesson_id: string | null;
  completed_at: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
/** Porovnávací klíč předmětu: bez diakritiky, mezery/podtržítka sjednocené. */
const subjKey = (s: string | null | undefined) =>
  norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const ClassResultsManager = () => {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOverview[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassOverview | null>(null);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lessonActs, setLessonActs] = useState<ActivityRow[]>([]);
  const [lessonComps, setLessonComps] = useState<CompletionRow[]>([]);
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [openStudentKey, setOpenStudentKey] = useState<string | null>(null);

  /** Úroveň přístupu: elevated = admin / školní admin, homeroom = třídní učitel */
  const isElevated = role === "admin" || role === "school_admin";
  const [homeroomClassIds, setHomeroomClassIds] = useState<Set<string>>(new Set());
  /** class_id -> předměty, ke kterým je učitel v té třídě připojený (podle rozvrhu) */
  const [mySubjectsByClass, setMySubjectsByClass] = useState<Map<string, Set<string>>>(new Map());

  const hasFullAccess = (classId: string) => isElevated || homeroomClassIds.has(classId);

  const fetchAccess = async () => {
    if (!user) return;
    const [{ data: homeroomRows }, { data: mySlots }] = await Promise.all([
      supabase.from("class_teachers").select("class_id").eq("user_id", user.id).eq("role", "homeroom"),
      supabase.from("class_schedule_slots").select("class_id, subject_label").eq("created_by", user.id),
    ]);
    setHomeroomClassIds(new Set((homeroomRows ?? []).map((r: any) => r.class_id)));
    const map = new Map<string, Set<string>>();
    (mySlots ?? []).forEach((s: any) => {
      if (!s.class_id) return;
      if (!map.has(s.class_id)) map.set(s.class_id, new Set());
      if (s.subject_label) map.get(s.class_id)!.add(norm(s.subject_label));
    });
    setMySubjectsByClass(map);
  };


  const fetchOverview = async () => {
    setLoading(true);

    // Get non-archived classes
    const { data: classesData, error } = await supabase
      .from("classes")
      .select("id, name, school, field_of_study, year")
      .eq("archived", false)
      .order("name");

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get all class members
    const { data: members } = await supabase.from("class_members").select("class_id, user_id");

    // Skupiny předmětů (učitel vidí své, admin / školní admin všechny přes RLS)
    let groupsQuery = supabase
      .from("subject_groups")
      .select("id, name, school_year, textbook_id, subjects(name)")
      .eq("archived", false)
      .order("name");
    if (!isElevated && user) groupsQuery = groupsQuery.eq("created_by", user.id);
    const { data: groupsData } = await groupsQuery;
    const groupIds = ((groupsData as any[]) ?? []).map((g) => g.id);
    const { data: groupMembers } = groupIds.length
      ? await supabase.from("subject_group_members").select("group_id, student_id").in("group_id", groupIds)
      : ({ data: [] } as any);
    const groupTbIds = Array.from(new Set(((groupsData as any[]) ?? []).map((g) => g.textbook_id).filter(Boolean)));
    const { data: groupTbs } = groupTbIds.length
      ? await supabase.from("teacher_textbooks").select("id, subject").in("id", groupTbIds)
      : ({ data: [] } as any);
    const tbSubj = new Map<string, string>(((groupTbs as any[]) ?? []).map((t) => [t.id, t.subject]));

    // Get all activity results
    const { data: activityResults } = await supabase
      .from("student_activity_results")
      .select("user_id, score, max_score, completed_at");

    // Get all lesson completions
    const { data: lessonCompletions } = await supabase
      .from("student_lesson_completions")
      .select("user_id, completed_at");

    // Build maps
    const classMembersMap = new Map<string, Set<string>>();
    members?.forEach((m: any) => {
      if (!classMembersMap.has(m.class_id)) classMembersMap.set(m.class_id, new Set());
      classMembersMap.get(m.class_id)!.add(m.user_id);
    });
    ((groupMembers as any[]) ?? []).forEach((m: any) => {
      if (!classMembersMap.has(m.group_id)) classMembersMap.set(m.group_id, new Set());
      classMembersMap.get(m.group_id)!.add(m.student_id);
    });

    const userActivities = new Map<string, { count: number; totalScore: number; totalMax: number; lastAt: string | null }>();
    activityResults?.forEach((r: any) => {
      const entry = userActivities.get(r.user_id) || { count: 0, totalScore: 0, totalMax: 0, lastAt: null };
      entry.count++;
      entry.totalScore += r.score;
      entry.totalMax += r.max_score;
      if (!entry.lastAt || r.completed_at > entry.lastAt) entry.lastAt = r.completed_at;
      userActivities.set(r.user_id, entry);
    });

    const userLessons = new Map<string, { count: number; lastAt: string | null }>();
    lessonCompletions?.forEach((l: any) => {
      const entry = userLessons.get(l.user_id) || { count: 0, lastAt: null };
      entry.count++;
      if (!entry.lastAt || l.completed_at > entry.lastAt) entry.lastAt = l.completed_at;
      userLessons.set(l.user_id, entry);
    });

    const groupRows = ((groupsData as any[]) ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      school: "",
      field_of_study: [g.subjects?.name, g.school_year].filter(Boolean).join(" · "),
      year: null,
      kind: "group" as const,
      subject_keys: [g.subjects?.name, g.textbook_id ? tbSubj.get(g.textbook_id) : null]
        .filter(Boolean)
        .map((x: string) => subjKey(x)),
    }));
    const allUnits = [...(classesData ?? []).map((c: any) => ({ ...c, kind: "class" as const })), ...groupRows];

    const enriched: ClassOverview[] = allUnits.map((c: any) => {
      const memberIds = classMembersMap.get(c.id) || new Set<string>();
      let totalScore = 0, totalMax = 0, totalActivities = 0, totalLessons = 0;
      let activeStudents = 0;
      let lastActivity: string | null = null;

      memberIds.forEach((uid) => {
        const act = userActivities.get(uid);
        const les = userLessons.get(uid);
        if (act || les) activeStudents++;
        if (act) {
          totalActivities += act.count;
          totalScore += act.totalScore;
          totalMax += act.totalMax;
          if (!lastActivity || (act.lastAt && act.lastAt > lastActivity)) lastActivity = act.lastAt;
        }
        if (les) {
          totalLessons += les.count;
          if (!lastActivity || (les.lastAt && les.lastAt > lastActivity)) lastActivity = les.lastAt;
        }
      });

      return {
        ...c,
        student_count: memberIds.size,
        active_students: activeStudents,
        avg_success: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
        total_lessons: totalLessons,
        total_activities: totalActivities,
        last_activity: lastActivity,
      };
    });

    setClasses(enriched);
    setLoading(false);
  };

  const fetchClassDetail = async (unit: ClassOverview) => {
    const classId = unit.id;
    const isGroup = unit.kind === "group";
    setDetailLoading(true);

    // Členové: u skupiny subject_group_members, u třídy class_members
    const memberIds: string[] = isGroup
      ? (((await supabase.from("subject_group_members").select("student_id").eq("group_id", classId)).data as any[]) ?? [])
          .map((m) => m.student_id)
          .filter(Boolean)
      : (((await supabase.from("class_members").select("user_id").eq("class_id", classId)).data as any[]) ?? [])
          .map((m) => m.user_id)
          .filter(Boolean);
    if (memberIds.length === 0) {
      setStudents([]);
      setLessonActs([]);
      setLessonComps([]);
      setLessonTitles({});
      setDetailLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", memberIds);

    const { data: allActivityResults } = await supabase
      .from("student_activity_results")
      .select("user_id, lesson_id, activity_index, activity_type, score, max_score, completed_at")
      .in("user_id", memberIds);

    const { data: allLessonCompletions } = await supabase
      .from("student_lesson_completions")
      .select("user_id, lesson_id, completed_at")
      .in("user_id", memberIds);

    const lessonIds = Array.from(new Set([
      ...(allActivityResults ?? []).map((r: any) => r.lesson_id),
      ...(allLessonCompletions ?? []).map((l: any) => l.lesson_id),
    ].filter(Boolean))) as string[];

    let titles: Record<string, string> = {};
    const slugKeyToLabel = new Map<string, string>();
    /** lesson_id -> surový slug předmětu (pro skupiny) */
    const lessonSubjectRaw = new Map<string, string>();
    /** lesson_id -> název předmětu učebnice (best-effort podle názvu) */
    const lessonSubject = new Map<string, string>();
    if (lessonIds.length > 0) {
      const [teacherRes, textbookRes] = await Promise.all([
        supabase.from("teacher_textbook_lessons").select("id, title, textbook_id").in("id", lessonIds),
        supabase.from("textbook_lessons").select("id, title, topic_id").in("id", lessonIds),
      ]);
      (teacherRes.data ?? []).forEach((l: any) => { titles[l.id] = l.title; });
      (textbookRes.data ?? []).forEach((l: any) => { titles[l.id] = l.title; });

      // Předmět u učitelských učebnic
      const tbIds = Array.from(new Set((teacherRes.data ?? []).map((l: any) => l.textbook_id).filter(Boolean)));
      const topicIds = Array.from(new Set((textbookRes.data ?? []).map((l: any) => l.topic_id).filter(Boolean)));
      const [tbRes, topicRes, subjRes] = await Promise.all([
        tbIds.length ? supabase.from("teacher_textbooks").select("id, subject").in("id", tbIds) : Promise.resolve({ data: [] } as any),
        topicIds.length ? supabase.from("textbook_topics").select("id, subject").in("id", topicIds) : Promise.resolve({ data: [] } as any),
        supabase.from("textbook_subjects").select("slug, label"),
      ]);
      const slugToLabel = new Map<string, string>();
      (subjRes.data ?? []).forEach((s: any) => slugToLabel.set(norm(s.slug), norm(s.label)));
      (subjRes.data ?? []).forEach((s: any) => slugKeyToLabel.set(subjKey(s.slug), s.label));
      const tbSubject = new Map<string, string>();
      (tbRes.data ?? []).forEach((t: any) => tbSubject.set(t.id, slugToLabel.get(norm(t.subject)) ?? norm(t.subject)));
      const topicSubject = new Map<string, string>();
      (topicRes.data ?? []).forEach((t: any) => topicSubject.set(t.id, slugToLabel.get(norm(t.subject)) ?? norm(t.subject)));

      (teacherRes.data ?? []).forEach((l: any) => {
        const s = tbSubject.get(l.textbook_id);
        if (s) lessonSubject.set(l.id, s);
        const raw = (tbRes.data ?? []).find((t: any) => t.id === l.textbook_id)?.subject;
        if (raw) lessonSubjectRaw.set(l.id, raw);
      });
      (textbookRes.data ?? []).forEach((l: any) => {
        const s = topicSubject.get(l.topic_id);
        if (s) lessonSubject.set(l.id, s);
        const raw = (topicRes.data ?? []).find((t: any) => t.id === l.topic_id)?.subject;
        if (raw) lessonSubjectRaw.set(l.id, raw);
      });
    }

    // Omezený přístup: jen lekce z učebnic předmětů, ke kterým je učitel v této třídě připojený
    // Skupina = jeden předmět: ukazujeme jen lekce toho předmětu (i adminovi),
    // jinak by se do výsledků skupiny míchaly lekce jiných předmětů.
    const groupKeys = new Set(unit.subject_keys ?? []);
    const limited = !isGroup && !hasFullAccess(classId);
    const mySubjects = mySubjectsByClass.get(classId) ?? new Set<string>();
    const lessonAllowed = (lessonId: string | null) => {
      if (isGroup) {
        if (!lessonId) return false;
        const raw = lessonSubjectRaw.get(lessonId);
        const label = raw ? slugKeyToLabel.get(subjKey(raw)) : undefined;
        return (!!raw && groupKeys.has(subjKey(raw))) || (!!label && groupKeys.has(subjKey(label)));
      }
      if (!limited) return true;
      if (!lessonId) return false;
      const s = lessonSubject.get(lessonId);
      return !!s && mySubjects.has(s);
    };

    const activityResults = (allActivityResults ?? []).filter((r: any) => lessonAllowed(r.lesson_id));
    const lessonCompletions = (allLessonCompletions ?? []).filter((l: any) => lessonAllowed(l.lesson_id));

    setLessonActs(activityResults as ActivityRow[]);
    setLessonComps(lessonCompletions as CompletionRow[]);
    setLessonTitles(titles);
    setOpenLessonId(null);
    setOpenStudentKey(null);



    const userActs = new Map<string, { count: number; totalScore: number; totalMax: number; lastAt: string | null }>();
    activityResults?.forEach((r: any) => {
      const e = userActs.get(r.user_id) || { count: 0, totalScore: 0, totalMax: 0, lastAt: null };
      e.count++;
      e.totalScore += r.score;
      e.totalMax += r.max_score;
      if (!e.lastAt || r.completed_at > e.lastAt) e.lastAt = r.completed_at;
      userActs.set(r.user_id, e);
    });

    const userLes = new Map<string, number>();
    lessonCompletions?.forEach((l: any) => {
      userLes.set(l.user_id, (userLes.get(l.user_id) || 0) + 1);
    });

    const studentDetails: StudentDetail[] = (profiles ?? []).map((p: any) => {
      const act = userActs.get(p.id);
      return {
        ...p,
        activity_count: act?.count || 0,
        lesson_count: userLes.get(p.id) || 0,
        avg_success: act && act.totalMax > 0 ? Math.round((act.totalScore / act.totalMax) * 100) : 0,
        last_activity: act?.lastAt || null,
      };
    });

    studentDetails.sort((a, b) => b.avg_success - a.avg_success);
    setStudents(studentDetails);
    setDetailLoading(false);
  };

  useEffect(() => { fetchOverview(); }, [user?.id, isElevated]);

  useEffect(() => { fetchAccess(); }, [user?.id]);

  useEffect(() => {
    if (selectedClass) fetchClassDetail(selectedClass);
  }, [selectedClass, homeroomClassIds, mySubjectsByClass, isElevated]);

  const filtered = useMemo(() => {
    if (!search) return classes;
    const s = search.toLowerCase();
    return classes.filter((c) => `${c.name} ${c.school} ${c.field_of_study}`.toLowerCase().includes(s));
  }, [classes, search]);

  const lessonSummaries = useMemo(() => {
    const map = new Map<string, {
      lesson_id: string;
      title: string;
      completedUsers: Map<string, string | null>;
      actsByUser: Map<string, ActivityRow[]>;
      indexes: Set<number>;
      totalScore: number;
      totalMax: number;
    }>();

    const ensure = (lessonId: string) => {
      if (!map.has(lessonId)) {
        map.set(lessonId, {
          lesson_id: lessonId,
          title: lessonTitles[lessonId] || "Neznámá lekce",
          completedUsers: new Map(),
          actsByUser: new Map(),
          indexes: new Set(),
          totalScore: 0,
          totalMax: 0,
        });
      }
      return map.get(lessonId)!;
    };

    lessonComps.forEach((c) => {
      if (!c.lesson_id) return;
      ensure(c.lesson_id).completedUsers.set(c.user_id, c.completed_at);
    });

    lessonActs.forEach((a) => {
      if (!a.lesson_id) return;
      const e = ensure(a.lesson_id);
      const arr = e.actsByUser.get(a.user_id) ?? [];
      arr.push(a);
      e.actsByUser.set(a.user_id, arr);
      e.indexes.add(a.activity_index);
      e.totalScore += a.score;
      e.totalMax += a.max_score;
    });

    return Array.from(map.values())
      .map((e) => ({
        ...e,
        avg_success: e.totalMax > 0 ? Math.round((e.totalScore / e.totalMax) * 100) : 0,
        activityCount: e.indexes.size,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "cs"));
  }, [lessonActs, lessonComps, lessonTitles]);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

  const successColor = (pct: number) =>
    pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : pct > 0 ? "text-red-400" : "text-muted-foreground";

  if (loading) return <div className="text-muted-foreground p-4">Načítání výsledků...</div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Hledat třídu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Třída</TableHead>
              <TableHead className="text-center">Studenti</TableHead>
              <TableHead className="text-center">Aktivní</TableHead>
              <TableHead className="text-center">Ø Úspěšnost</TableHead>
              <TableHead className="text-center">Lekce</TableHead>
              <TableHead className="text-center">Aktivity</TableHead>
              <TableHead>Poslední aktivita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedClass(c)}>
                <TableCell>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{c.name}</p>
                      {c.kind === "group" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">skupina</Badge>
                      )}
                      {c.kind !== "group" && !hasFullAccess(c.id) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">jen tvé předměty</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[c.school, c.field_of_study, c.year ? `${c.year}. ročník` : null].filter(Boolean).join(" · ") || "–"}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />{c.student_count}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-sm">{c.active_students}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${successColor(c.avg_success)}`}>
                    {c.avg_success > 0 ? `${c.avg_success} %` : "–"}
                  </span>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{c.total_lessons || "–"}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{c.total_activities || "–"}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.last_activity)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Žádné třídy s výsledky.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => setSelectedClass(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              Výsledky – {selectedClass?.name}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-muted-foreground text-sm py-4">Načítání...</p>
          ) : (
            <div className="flex flex-col gap-3 overflow-hidden">
              {/* Summary badges */}
              {selectedClass && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-4 h-4" /> {selectedClass.student_count} studentů
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Activity className="w-4 h-4" /> {selectedClass.total_activities} aktivit
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BookOpen className="w-4 h-4" /> {selectedClass.total_lessons} lekcí
                  </div>
                  <div className={`flex items-center gap-1.5 ${successColor(selectedClass.avg_success)}`}>
                    Ø {selectedClass.avg_success > 0 ? `${selectedClass.avg_success} %` : "–"}
                  </div>
                </div>
              )}

              <Tabs defaultValue="by-student" className="flex flex-col overflow-hidden">
                <TabsList>
                  <TabsTrigger value="by-student">Podle studenta</TabsTrigger>
                  <TabsTrigger value="by-lesson">Podle lekce</TabsTrigger>
                </TabsList>

                <TabsContent value="by-student" className="mt-3 overflow-hidden">
              {/* Students table */}
              <div className="overflow-y-auto border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-center">Úspěšnost</TableHead>
                      <TableHead className="text-center">Aktivity</TableHead>
                      <TableHead className="text-center">Lekce</TableHead>
                      <TableHead>Poslední aktivita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${successColor(s.avg_success)}`}>
                            {s.avg_success > 0 ? `${s.avg_success} %` : "–"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{s.activity_count || "–"}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{s.lesson_count || "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.last_activity)}</TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Žádní studenti v této třídě.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
                </TabsContent>

                <TabsContent value="by-lesson" className="mt-3 overflow-y-auto space-y-2">
                  {lessonSummaries.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Žádné výsledky lekcí pro tuto třídu.
                    </p>
                  )}
                  {lessonSummaries.map((l) => {
                    const total = selectedClass?.student_count ?? 0;
                    const isOpen = openLessonId === l.lesson_id;
                    return (
                      <div key={l.lesson_id} className="border border-border rounded-md">
                        <button
                          type="button"
                          className="w-full flex items-start gap-2 p-3 text-left hover:bg-muted/50 rounded-md"
                          onClick={() => { setOpenLessonId(isOpen ? null : l.lesson_id); setOpenStudentKey(null); }}
                        >
                          {isOpen
                            ? <ChevronDown className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                            : <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{l.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {l.completedUsers.size}/{total} dokončilo učebnici
                              {" · "}
                              {l.actsByUser.size}/{total} udělalo aktivity
                            </p>
                          </div>
                          <span className={`text-sm font-medium ${successColor(l.avg_success)}`}>
                            {l.avg_success > 0 ? `${l.avg_success} %` : "–"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead className="text-center">Dokončil učebnici</TableHead>
                                  <TableHead className="text-center">Aktivity</TableHead>
                                  <TableHead className="text-center">Úspěšnost</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {students.map((s) => {
                                  const acts = (l.actsByUser.get(s.id) ?? [])
                                    .slice()
                                    .sort((a, b) => a.activity_index - b.activity_index);
                                  const done = l.completedUsers.has(s.id);
                                  const doneAt = l.completedUsers.get(s.id) ?? null;
                                  const maxSum = acts.reduce((sum, a) => sum + a.max_score, 0);
                                  const scoreSum = acts.reduce((sum, a) => sum + a.score, 0);
                                  const pct = maxSum > 0 ? Math.round((scoreSum / maxSum) * 100) : 0;
                                  const key = `${l.lesson_id}-${s.id}`;
                                  const rowOpen = openStudentKey === key;
                                  return (
                                    <Fragment key={key}>
                                      <TableRow
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => setOpenStudentKey(rowOpen ? null : key)}
                                      >
                                        <TableCell>
                                          <p className="text-sm font-medium">{s.first_name} {s.last_name}</p>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {done ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-green-400 whitespace-nowrap">
                                              <Check className="w-3 h-3" /> {formatDate(doneAt)}
                                            </span>
                                          ) : (
                                            <span className="text-sm text-muted-foreground">–</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center text-sm text-muted-foreground">
                                          {acts.length}/{l.activityCount || 0}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <span className={`text-sm font-medium ${successColor(pct)}`}>
                                            {pct > 0 ? `${pct} %` : "–"}
                                          </span>
                                        </TableCell>
                                      </TableRow>
                                      {rowOpen && acts.length > 0 && (
                                        <TableRow key={`${key}-detail`}>
                                          <TableCell colSpan={4} className="bg-muted/30">
                                            <ul className="space-y-1">
                                              {acts.map((a) => (
                                                <li
                                                  key={`${key}-${a.activity_index}`}
                                                  className="flex flex-wrap items-center gap-2 text-xs"
                                                >
                                                  <Badge variant="secondary" className="text-xs">
                                                    <Clock className="w-3 h-3 mr-1" />{a.activity_type}
                                                  </Badge>
                                                  <span className="text-muted-foreground">
                                                    {a.score}/{a.max_score}
                                                  </span>
                                                  <span className="text-muted-foreground">
                                                    {formatDate(a.completed_at)}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </Fragment>
                                  );
                                })}
                                {students.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                                      Žádní studenti v této třídě.
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassResultsManager;
