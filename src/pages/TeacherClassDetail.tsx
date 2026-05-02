import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Pencil,
  Archive,
  ArchiveRestore,
  Users,
  BookOpen,
  Clock,
  FileText,
  BarChart3,
  ClipboardList,
  Bell,
  Plus,
  PlayCircle,
  CalendarPlus,
  Copy,
  ChevronRight,
} from "lucide-react";

interface ClassRow {
  id: string;
  name: string;
  description: string;
  school: string;
  field_of_study: string;
  year: number | null;
  archived: boolean;
  access_code: string | null;
  access_code_active: boolean;
}

interface MemberRow {
  user_id: string;
  first_name: string;
  last_name: string;
  student_code: string | null;
  status: string;
}

interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_label: string | null;
  abbreviation: string | null;
  color: string | null;
  room: string | null;
}

interface TextbookItem {
  id: string;
  title: string;
  subject: string | null;
  textbook_type: string;
}

interface AssignmentRow {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  worksheet_id: string | null;
  created_at: string;
}

interface BroadcastRow {
  id: string;
  title: string;
  content: string;
  sent_at: string | null;
  created_at: string;
  status: string;
}

const DAYS = ["Po", "Út", "St", "Čt", "Pá"];

const TeacherClassDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [textbooks, setTextbooks] = useState<TextbookItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);

  const fetchAll = async () => {
    if (!id) return;
    setLoading(true);

    const [{ data: classData }, { data: cmData }, { data: slotData }, { data: ctData }, { data: aData }, { data: bData }] =
      await Promise.all([
        supabase.from("classes").select("*").eq("id", id).maybeSingle(),
        supabase.from("class_members").select("user_id").eq("class_id", id),
        supabase.from("class_schedule_slots").select("*").eq("class_id", id),
        supabase.from("class_textbooks").select("textbook_id, textbook_type").eq("class_id", id),
        supabase.from("assignments").select("id,title,status,deadline,worksheet_id,created_at").eq("class_id", id).order("created_at", { ascending: false }),
        supabase
          .from("notification_broadcasts")
          .select("id,title,content,sent_at,created_at,status,receiver_ids,receiver_type")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    if (!classData) {
      setLoading(false);
      toast({ title: "Třída nenalezena", variant: "destructive" });
      return;
    }
    setCls(classData as ClassRow);

    const userIds = (cmData ?? []).map((r: any) => r.user_id);
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, student_code, status")
        .in("id", userIds);
      setMembers(
        (profs ?? []).map((p: any) => ({
          user_id: p.id,
          first_name: p.first_name ?? "",
          last_name: p.last_name ?? "",
          student_code: p.student_code,
          status: p.status,
        })),
      );
    } else {
      setMembers([]);
    }

    setSchedule((slotData as any[]) ?? []);

    // textbooks
    const teacherIds = (ctData ?? []).filter((r: any) => r.textbook_type === "teacher").map((r: any) => r.textbook_id);
    const globalIds = (ctData ?? []).filter((r: any) => r.textbook_type !== "teacher").map((r: any) => r.textbook_id);
    const tbList: TextbookItem[] = [];
    if (teacherIds.length > 0) {
      const { data } = await supabase.from("teacher_textbooks").select("id,title,subject").in("id", teacherIds);
      data?.forEach((t: any) => tbList.push({ id: t.id, title: t.title, subject: t.subject, textbook_type: "teacher" }));
    }
    if (globalIds.length > 0) {
      const { data } = await supabase.from("textbooks").select("id,title,subject_slug").in("id", globalIds);
      data?.forEach((t: any) => tbList.push({ id: t.id, title: t.title, subject: t.subject_slug, textbook_type: "global" }));
    }
    setTextbooks(tbList);

    setAssignments((aData as any[]) ?? []);

    // broadcasts targeting this class
    const filtered = ((bData as any[]) ?? []).filter((b: any) =>
      Array.isArray(b.receiver_ids) && b.receiver_ids.includes(id),
    );
    setBroadcasts(filtered);

    // average score
    const aIds = ((aData as any[]) ?? []).map((a: any) => a.id);
    if (aIds.length > 0) {
      const { data: atts } = await supabase
        .from("assignment_attempts")
        .select("score, max_score, status")
        .in("assignment_id", aIds);
      const subs = (atts ?? []).filter((a: any) => a.status === "submitted" && a.max_score);
      setSubmittedCount(subs.length);
      if (subs.length > 0) {
        const pct = subs.reduce((s: number, a: any) => s + (a.score / a.max_score) * 100, 0) / subs.length;
        setAvgScore(Math.round(pct));
      } else {
        setAvgScore(null);
      }
    } else {
      setAvgScore(null);
      setSubmittedCount(0);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleArchive = async () => {
    if (!cls) return;
    const { error } = await supabase.from("classes").update({ archived: !cls.archived }).eq("id", cls.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: cls.archived ? "Obnoveno" : "Archivováno" });
    fetchAll();
  };

  const scheduleByDay = useMemo(() => {
    const map: Record<number, ScheduleSlot[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const s of schedule) {
      if (s.day_of_week >= 1 && s.day_of_week <= 5) map[s.day_of_week].push(s);
    }
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [schedule]);

  const worksheetAssignments = assignments.filter((a) => a.worksheet_id);
  const homeworkAssignments = assignments.filter((a) => !a.worksheet_id);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <div className="text-muted-foreground">Načítání…</div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <Button variant="ghost" onClick={() => navigate("/ucitel/tridy")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na seznam tříd
          </Button>
          <div className="mt-6 text-muted-foreground">Třída nebyla nalezena.</div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl space-y-6" style={{ paddingTop: "calc(70px + 2rem)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/tridy")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na třídy
        </Button>

        {/* Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{cls.name}</h1>
                  {cls.archived && <Badge variant="secondary">Archivováno</Badge>}
                </div>
                {cls.description && <p className="text-sm text-muted-foreground">{cls.description}</p>}
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {cls.school && <Badge variant="outline">{cls.school}</Badge>}
                  {cls.field_of_study && <Badge variant="outline">{cls.field_of_study}</Badge>}
                  {cls.year && <Badge variant="outline">{cls.year}. ročník</Badge>}
                  <Badge variant="outline">
                    <Users className="w-3 h-3 mr-1" />
                    {members.length} žáků
                  </Badge>
                  {cls.access_code && cls.access_code_active && (
                    <Badge
                      variant="outline"
                      className="cursor-pointer font-mono"
                      onClick={() => {
                        navigator.clipboard.writeText(cls.access_code!);
                        toast({ title: "Zkopírováno" });
                      }}
                    >
                      Kód: {cls.access_code} <Copy className="w-3 h-3 ml-1" />
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => navigate("/ucitel/tridy")}>
                  <Pencil className="w-4 h-4 mr-1" /> Editovat
                </Button>
                <Button variant="outline" size="sm" onClick={toggleArchive}>
                  {cls.archived ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
                  {cls.archived ? "Obnovit" : "Archivovat"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button variant="hero" className="h-auto py-4" onClick={() => navigate("/ucitel/ulohy")}>
            <ClipboardList className="w-4 h-4 mr-2" /> Zadat úkol
          </Button>
          <Button variant="hero" className="h-auto py-4" onClick={() => navigate("/ucitel/plany-hodin")}>
            <PlayCircle className="w-4 h-4 mr-2" /> Spustit živou prezentaci
          </Button>
          <Button variant="hero" className="h-auto py-4" onClick={() => navigate("/ucitel/rozvrh")}>
            <CalendarPlus className="w-4 h-4 mr-2" /> Přidat hodinu do rozvrhu
          </Button>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Žáci */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Žáci ({members.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/tridy")}>
                <Plus className="w-4 h-4 mr-1" /> Přidat
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 max-h-72 overflow-auto">
              {members.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádní žáci.</p>}
              {members.slice(0, 12).map((m) => (
                <div key={m.user_id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span>
                    {m.first_name} {m.last_name}
                  </span>
                  <div className="flex items-center gap-2">
                    {m.student_code && (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{m.student_code}</code>
                    )}
                    {m.status === "pending" && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                        čeká
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {members.length > 12 && (
                <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate("/ucitel/tridy")}>
                  Zobrazit všechny <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Předměty / učebnice */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Předměty ({textbooks.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/ucebnice")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 max-h-72 overflow-auto">
              {textbooks.length === 0 && <p className="text-sm text-muted-foreground">Žádné propojené učebnice.</p>}
              {textbooks.map((t) => {
                const slot = schedule.find((s) => (s.subject_label ?? "").toLowerCase() === (t.subject ?? "").toLowerCase());
                return (
                  <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {slot?.color && (
                        <span className="w-3 h-3 rounded" style={{ background: slot.color }} />
                      )}
                      {slot?.abbreviation && (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {slot.abbreviation}
                        </Badge>
                      )}
                      <span>{t.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.textbook_type === "teacher" ? "Vlastní" : "Globální"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Rozvrh */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Týdenní rozvrh
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/rozvrh")}>
                Detail <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {schedule.length === 0 ? (
                <p className="text-sm text-muted-foreground">Rozvrh není nastaven.</p>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {DAYS.map((d, i) => (
                    <div key={d} className="space-y-1">
                      <div className="text-xs font-semibold text-center text-muted-foreground">{d}</div>
                      {scheduleByDay[i + 1].length === 0 && (
                        <div className="text-[10px] text-center text-muted-foreground/50">–</div>
                      )}
                      {scheduleByDay[i + 1].map((s) => (
                        <div
                          key={s.id}
                          className="rounded p-1.5 text-[11px] border border-border"
                          style={{ background: s.color ? `${s.color}20` : undefined, borderLeft: s.color ? `3px solid ${s.color}` : undefined }}
                        >
                          <div className="font-semibold truncate">{s.abbreviation || s.subject_label}</div>
                          <div className="text-muted-foreground">{s.start_time.slice(0, 5)}</div>
                          {s.room && <div className="text-muted-foreground truncate">{s.room}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pracovní listy */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Pracovní listy ({worksheetAssignments.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/pracovni-listy")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 max-h-56 overflow-auto">
              {worksheetAssignments.length === 0 && (
                <p className="text-sm text-muted-foreground">Žádné zadané pracovní listy.</p>
              )}
              {worksheetAssignments.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="truncate">{a.title || "(bez názvu)"}</span>
                  {a.deadline && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      do {new Date(a.deadline).toLocaleDateString("cs-CZ")}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Výsledky */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Výsledky
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/vysledky")}>
                Detail <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-bold">{avgScore !== null ? `${avgScore}%` : "–"}</div>
                <div className="text-xs text-muted-foreground">Průměrné skóre</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded border border-border p-2">
                  <div className="font-semibold">{submittedCount}</div>
                  <div className="text-xs text-muted-foreground">Odevzdaných</div>
                </div>
                <div className="rounded border border-border p-2">
                  <div className="font-semibold">{assignments.length}</div>
                  <div className="text-xs text-muted-foreground">Aktivit</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Domácí úkoly */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Domácí úkoly ({homeworkAssignments.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/ulohy")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 max-h-56 overflow-auto">
              {homeworkAssignments.length === 0 && (
                <p className="text-sm text-muted-foreground">Žádné zadané úkoly.</p>
              )}
              {homeworkAssignments.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{a.title || "(bez názvu)"}</span>
                    <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                  </div>
                  {a.deadline && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(a.deadline).toLocaleDateString("cs-CZ")}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notifikace */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notifikace ({broadcasts.length})
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/notifikace")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 max-h-56 overflow-auto">
              {broadcasts.length === 0 && (
                <p className="text-sm text-muted-foreground">Žádné zprávy poslané této třídě.</p>
              )}
              {broadcasts.slice(0, 8).map((b) => (
                <div key={b.id} className="text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{b.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(b.sent_at || b.created_at).toLocaleDateString("cs-CZ")}
                    </span>
                  </div>
                  {b.content && <p className="text-xs text-muted-foreground line-clamp-1">{b.content}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherClassDetail;
