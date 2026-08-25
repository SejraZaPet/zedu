import { BetaBadge } from "@/components/common/BetaBadge";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySchool, useSchoolColleagues, colleagueLabel } from "@/hooks/useMySchool";
import { usePdfExport } from "@/hooks/usePdfExport";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

type MeetingType =
  | "predmetova"
  | "pedagogicka"
  | "ctvrtletni"
  | "pololetni"
  | "trictvrtletni"
  | "zaverecna";

const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "predmetova", label: "Předmětová" },
  { value: "pedagogicka", label: "Pedagogická" },
  { value: "ctvrtletni", label: "Čtvrtletní" },
  { value: "pololetni", label: "Pololetní" },
  { value: "trictvrtletni", label: "Tříčtvrtletní" },
  { value: "zaverecna", label: "Závěrečná" },
];

const typeLabel = (t: string) =>
  MEETING_TYPES.find((m) => m.value === t)?.label || t;

interface Meeting {
  id: string;
  school_id: string;
  type: MeetingType;
  title: string;
  meeting_date: string;
  content: string | null;
  author_id: string;
  created_at: string;
}

interface Attendee {
  id: string;
  meeting_id: string;
  teacher_id: string;
  attended: boolean;
}

interface Ack {
  id: string;
  meeting_id: string;
  teacher_id: string;
  acknowledged_at: string;
}

interface MeetingTask {
  id: string;
  meeting_id: string;
  assigned_to: string;
  task: string;
  due_date: string | null;
  todo_id: string | null;
}

interface TaskDraft {
  task: string;
  due_date: string;
  assignees: string[];
}

type PoolMember = { id: string; first_name: string | null; last_name: string | null; email: string | null };

/** Multi-výběr adresátů úkolu se zkratkami (všichni / přítomní / nepřítomní). */
const AssigneePicker = ({
  pool,
  value,
  onChange,
  presentIds,
  userId,
}: {
  pool: PoolMember[];
  value: string[];
  onChange: (ids: string[]) => void;
  presentIds: string[];
  userId?: string;
}) => {
  const allIds = pool.map((t) => t.id);
  const present = allIds.filter((id) => presentIds.includes(id));
  const absent = allIds.filter((id) => !presentIds.includes(id));
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? Array.from(new Set([...value, id])) : value.filter((v) => v !== id));

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(allIds)}>
          Všichni učitelé školy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(present)}>
          Přítomní na poradě
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(absent)}>
          Nepřítomní
        </Button>
        {value.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Zrušit výběr
          </Button>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-border p-2">
        {pool.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ve škole nejsou žádní další učitelé.</p>
        ) : (
          pool.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={value.includes(t.id)}
                onCheckedChange={(c) => toggle(t.id, !!c)}
              />
              {t.id === userId ? "Já" : colleagueLabel(t)}
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Vybráno: {value.length} {value.length === 1 ? "učitel" : "učitelů"}
      </p>
    </div>
  );
};

const SchoolMeetings = () => {
  const { user, loading: authLoading, realRole } = useAuth();
  const { schoolId, hasSchool, loading: schoolLoading } = useMySchool();

  const { colleagues } = useSchoolColleagues(schoolId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { exportOne, loading: isExporting } = usePdfExport();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [filterType, setFilterType] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "pedagogicka" as MeetingType,
    title: "",
    meeting_date: new Date().toISOString().split("T")[0],
    content: "",
  });
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [draftTasks, setDraftTasks] = useState<TaskDraft[]>([]);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<{ assignees: string[]; task: string; due_date: string }>({
    assignees: [],
    task: "",
    due_date: "",
  });
  const [isDelegate, setIsDelegate] = useState(false);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    type: "pedagogicka" as MeetingType,
    title: "",
    meeting_date: "",
    content: "",
  });

  const updateDraftTask = (index: number, patch: Partial<TaskDraft>) =>
    setDraftTasks((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));


  const nameOf = useCallback(
    (id: string) => {
      if (id === user?.id) return "Já";
      return colleagueLabel(colleagues.find((c) => c.id === id)) || "Učitel";
    },
    [colleagues, user?.id],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const fetchMeetings = useCallback(async () => {
    if (!schoolId) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("school_meetings")
      .select("*")
      .eq("school_id", schoolId)
      .order("meeting_date", { ascending: false });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      setMeetings((data as Meeting[]) || []);
    }
    setLoading(false);
  }, [schoolId, toast]);

  useEffect(() => {
    if (schoolLoading) return;
    fetchMeetings();
  }, [schoolLoading, fetchMeetings]);

  const loadDetail = useCallback(async (meetingId: string) => {
    const [a, k, t] = await Promise.all([
      supabase.from("school_meeting_attendees").select("*").eq("meeting_id", meetingId),
      supabase.from("school_meeting_acknowledgments").select("*").eq("meeting_id", meetingId),
      supabase.from("school_meeting_tasks").select("*").eq("meeting_id", meetingId),
    ]);
    setAttendees((a.data as Attendee[]) || []);
    setAcks((k.data as Ack[]) || []);
    setTasks((t.data as MeetingTask[]) || []);
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const selected = meetings.find((m) => m.id === selectedId) || null;
  const canManage =
    !!selected &&
    (selected.author_id === user?.id ||
      realRole === "school_admin" ||
      realRole === "admin" ||
      isDelegate);

  /** Úkoly seskupené podle zadání — jeden úkol může mít více adresátů. */
  const groupedTasks = useMemo(() => {
    const map = new Map<string, { task: string; due_date: string | null; rows: MeetingTask[] }>();
    tasks.forEach((t) => {
      const key = `${t.task}::${t.due_date ?? ""}`;
      const g = map.get(key) ?? { task: t.task, due_date: t.due_date, rows: [] };
      g.rows.push(t);
      map.set(key, g);
    });
    return Array.from(map.values());
  }, [tasks]);

  // Zjisti, zda má přihlášený uživatel delegovaná práva vedení školy
  useEffect(() => {
    if (!user || !schoolId) {
      setIsDelegate(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("school_leadership_delegates")
      .select("id")
      .eq("school_id", schoolId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsDelegate(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, schoolId]);

  // Stav splnění úkolů — načítá se jen pro vedení školy (funkce sama oprávnění ověřuje)
  useEffect(() => {
    if (!selectedId || !canManage) {
      setCompletions({});
      return;
    }
    let cancelled = false;
    void supabase.rpc("meeting_task_completions", { _meeting_id: selectedId }).then(({ data }) => {
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: { task_id: string; done: boolean }) => {
        map[r.task_id] = r.done;
      });
      setCompletions(map);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, canManage]);

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      type: selected.type,
      title: selected.title,
      meeting_date: selected.meeting_date,
      content: selected.content ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected || !editForm.title.trim()) {
      toast({ title: "Zadejte název porady", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("school_meetings")
      .update({
        type: editForm.type,
        title: editForm.title.trim(),
        meeting_date: editForm.meeting_date,
        content: editForm.content || null,
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Uložení selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setEditOpen(false);
    toast({ title: "Zápis byl upraven" });
    await fetchMeetings();
  };
  const detailPresentIds = useMemo(
    () => attendees.filter((a) => a.attended).map((a) => a.teacher_id),
    [attendees],
  );


  const teacherPool = useMemo(() => {
    const me = user ? [{ id: user.id, first_name: "Já", last_name: null, email: null }] : [];
    return [...me, ...colleagues.filter((c) => c.id !== user?.id)];
  }, [colleagues, user]);

  const createMeeting = async () => {
    if (!user || !schoolId || !form.title.trim()) {
      toast({ title: "Zadejte název porady", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("school_meetings")
      .insert({
        school_id: schoolId,
        author_id: user.id,
        type: form.type,
        title: form.title.trim(),
        meeting_date: form.meeting_date,
        content: form.content || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast({ title: "Uložení selhalo", description: error?.message, variant: "destructive" });
      return;
    }
    const rows = teacherPool.map((t) => ({
      meeting_id: data.id,
      teacher_id: t.id,
      attended: presentIds.includes(t.id),
    }));
    if (rows.length) {
      const { error: aErr } = await supabase.from("school_meeting_attendees").insert(rows);
      if (aErr) {
        toast({ title: "Účast se nepodařilo uložit", description: aErr.message, variant: "destructive" });
      }
    }

    const taskRows = draftTasks
      .filter((d) => d.task.trim() && d.assignees.length > 0)
      .flatMap((d) =>
        d.assignees.map((id) => ({
          meeting_id: data.id,
          assigned_to: id,
          task: d.task.trim(),
          due_date: d.due_date || null,
        })),
      );
    if (taskRows.length) {
      const { error: tErr } = await supabase.from("school_meeting_tasks").insert(taskRows);
      if (tErr) {
        toast({ title: "Úkoly se nepodařilo uložit", description: tErr.message, variant: "destructive" });
      }
    }

    setSaving(false);
    setCreateOpen(false);
    setForm({
      type: "pedagogicka",
      title: "",
      meeting_date: new Date().toISOString().split("T")[0],
      content: "",
    });
    setPresentIds([]);
    setDraftTasks([]);
    toast({ title: "Zápis z porady byl vytvořen" });
    await fetchMeetings();
    setSelectedId(data.id);
  };


  const addTask = async () => {
    if (!selected || taskForm.assignees.length === 0 || !taskForm.task.trim()) {
      toast({ title: "Vyberte alespoň jednoho učitele a zadejte úkol", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("school_meeting_tasks").insert(
      taskForm.assignees.map((id) => ({
        meeting_id: selected.id,
        assigned_to: id,
        task: taskForm.task.trim(),
        due_date: taskForm.due_date || null,
      })),
    );
    if (error) {
      toast({ title: "Úkol se nepodařilo přidat", description: error.message, variant: "destructive" });
      return;
    }
    const count = taskForm.assignees.length;
    setTaskForm({ assignees: [], task: "", due_date: "" });
    setTaskOpen(false);
    toast({
      title: count > 1 ? `Úkol přidán ${count} učitelům` : "Úkol přidán",
      description: "Objeví se i v seznamu úkolů přiřazených učitelů.",
    });
    loadDetail(selected.id);
  };


  const removeTask = async (id: string) => {
    if (!selected) return;
    const { error } = await supabase.from("school_meeting_tasks").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    loadDetail(selected.id);
  };

  const deleteMeeting = async (id: string) => {
    const { error } = await supabase.from("school_meetings").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedId(null);
    fetchMeetings();
  };

  const acknowledge = async () => {
    if (!selected || !user) return;
    const { error } = await supabase.from("school_meeting_acknowledgments").insert({
      meeting_id: selected.id,
      teacher_id: user.id,
    });
    if (error) {
      toast({ title: "Nepodařilo se potvrdit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Přečtení potvrzeno" });
    loadDetail(selected.id);
  };

  const myAttendance = attendees.find((a) => a.teacher_id === user?.id);
  const iWasAbsent = !myAttendance || !myAttendance.attended;
  const iAcknowledged = acks.some((a) => a.teacher_id === user?.id);
  const absentees = attendees.filter((a) => !a.attended);
  const pendingAcks = absentees.filter((a) => !acks.some((k) => k.teacher_id === a.teacher_id));

  const exportPdf = async () => {
    if (!selected) return;
    await exportOne("meeting_notes", selected.id);
  };

  const filtered = meetings.filter((m) => filterType === "all" || m.type === filterType);

  if (!schoolLoading && !hasSchool) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
          <h1 className="font-heading text-3xl font-bold mb-3">Porady školy</h1>
          <p className="text-muted-foreground">
            Porady jsou dostupné pouze učitelům pod licencí školy. Váš účet není přiřazen k žádné škole.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        {!selected ? (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
              <div>
                <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
                  Porady školy
                  <BetaBadge context="Porady školy" />
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Zápisy z porad, účast, potvrzení přečtení a úkoly. Zapisovat může kterýkoli učitel školy.
                </p>
              </div>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                Nový zápis
              </Button>
            </div>

            <div className="mb-6 max-w-xs">
              <Label>Typ porady</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny typy</SelectItem>
                  {MEETING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Načítání...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">Žádné porady</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.title}</span>
                      <Badge variant="secondary">{typeLabel(m.type)}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(m.meeting_date).toLocaleDateString("cs-CZ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Zapsal(a): {nameOf(m.author_id)}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" className="gap-2 mb-4" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="w-4 h-4" />
              Zpět na seznam
            </Button>

            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
              <div>
                <h1 className="font-heading text-2xl font-bold">{selected.title}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary">{typeLabel(selected.type)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(selected.meeting_date).toLocaleDateString("cs-CZ")}
                  </span>
                  <span className="text-sm text-muted-foreground">· Zapsal(a): {nameOf(selected.author_id)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={exportPdf} disabled={isExporting}>
                  <FileDown className="w-4 h-4" />
                  {isExporting ? "Generuji..." : "Export do PDF"}
                </Button>
                {canManage && (
                  <Button
                    variant="outline"
                    className="gap-2 text-red-500"
                    onClick={() => deleteMeeting(selected.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Smazat
                  </Button>
                )}
              </div>
            </div>

            {iWasAbsent && (
              <Card className="mb-6 border-yellow-500/40 bg-yellow-500/5">
                <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm">
                    {iAcknowledged
                      ? "Nebyl(a) jste přítomen(na) — přečtení zápisu máte potvrzené."
                      : "Nebyl(a) jste na poradě přítomen(na). Potvrďte prosím přečtení zápisu."}
                  </p>
                  {iAcknowledged ? (
                    <Badge className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Potvrzeno
                    </Badge>
                  ) : (
                    <Button onClick={acknowledge}>Potvrdit přečtení</Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Zápis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {selected.content || "Bez obsahu."}
                </p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" /> Účast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {attendees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Účast nebyla zaznamenána.</p>
                  ) : (
                    attendees.map((a) => {
                      const ack = acks.find((k) => k.teacher_id === a.teacher_id);
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>{nameOf(a.teacher_id)}</span>
                          {a.attended ? (
                            <Badge variant="secondary">Přítomen(na)</Badge>
                          ) : ack ? (
                            <Badge className="gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Přečteno
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Nepotvrzeno</Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                  {pendingAcks.length > 0 && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Čeká na potvrzení: {pendingAcks.map((a) => nameOf(a.teacher_id)).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" /> Úkoly z porady
                  </CardTitle>
                  {canManage && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setTaskOpen(true)}>
                      <Plus className="w-3 h-3" /> Přidat
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Žádné úkoly.</p>
                  ) : (
                    tasks.map((t) => (
                      <div key={t.id} className="flex items-start justify-between gap-2 text-sm">
                        <div>
                          <p>{t.task}</p>
                          <p className="text-xs text-muted-foreground">
                            {nameOf(t.assigned_to)}
                            {t.due_date
                              ? ` · do ${new Date(t.due_date).toLocaleDateString("cs-CZ")}`
                              : ""}
                          </p>
                        </div>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500"
                            onClick={() => removeTask(t.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nový zápis z porady</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Typ *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v as MeetingType })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Datum *</Label>
                  <Input
                    type="date"
                    value={form.meeting_date}
                    onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Název *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Např. Pedagogická rada – listopad"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Obsah zápisu</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  placeholder="Body programu, závěry, rozhodnutí..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Přítomní</Label>
                <div className="mt-2 space-y-2">
                  {teacherPool.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={presentIds.includes(t.id)}
                        onCheckedChange={(c) =>
                          setPresentIds((prev) =>
                            c ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                          )
                        }
                      />
                      {t.id === user?.id ? "Já" : colleagueLabel(t)}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Neoznačení učitelé budou vedeni jako nepřítomní a uvidíme, kdo zápis potvrdil.
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <Label className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Úkoly z porady (volitelné)
                </Label>
                <div className="mt-3 space-y-4">
                  {draftTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Zatím žádné úkoly. Můžete je přidat i později v detailu porady.
                    </p>
                  )}
                  {draftTasks.map((d, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                      <div className="flex items-start gap-2">
                        <Input
                          value={d.task}
                          onChange={(e) => updateDraftTask(i, { task: e.target.value })}
                          placeholder="Co je potřeba udělat"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-red-500 shrink-0"
                          aria-label="Odebrat úkol"
                          onClick={() => setDraftTasks((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">Termín</Label>
                        <Input
                          type="date"
                          value={d.due_date}
                          onChange={(e) => updateDraftTask(i, { due_date: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Přiřadit učitelům *</Label>
                        <AssigneePicker
                          pool={teacherPool}
                          value={d.assignees}
                          onChange={(ids) => updateDraftTask(i, { assignees: ids })}
                          presentIds={presentIds}
                          userId={user?.id}
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      setDraftTasks((prev) => [...prev, { task: "", due_date: "", assignees: [] }])
                    }
                  >
                    <Plus className="w-3 h-3" /> Přidat úkol
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={createMeeting} disabled={saving}>
                {saving ? "Ukládám..." : "Vytvořit zápis"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Úkol z porady</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <Label>Přiřadit učitelům *</Label>
                <AssigneePicker
                  pool={teacherPool}
                  value={taskForm.assignees}
                  onChange={(ids) => setTaskForm({ ...taskForm, assignees: ids })}
                  presentIds={detailPresentIds}
                  userId={user?.id}
                />
              </div>
              <div>
                <Label>Úkol *</Label>
                <Input
                  value={taskForm.task}
                  onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })}
                  placeholder="Co je potřeba udělat"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Termín</Label>
                <Input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Úkol se automaticky objeví v seznamu úkolů každého vybraného učitele.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={addTask}>Přidat úkol</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
      <SiteFooter />
    </div>
  );
};

export default SchoolMeetings;
