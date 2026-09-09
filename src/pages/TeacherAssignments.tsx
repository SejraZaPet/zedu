import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Plus, CalendarIcon, Trash2, Send, Clock, Users, Shuffle, RotateCcw, Eye, EyeOff, BarChart3, FileText, ExternalLink, Lock, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AssignmentResultsDashboard from "@/components/admin/AssignmentResultsDashboard";
import RemindButton from "@/components/notifications/RemindButton";
import TeacherAssignmentAttachments from "@/components/assignments/TeacherAssignmentAttachments";
import { ExamTypeBadge } from "@/components/assignments/ExamTypeBadge";
import { EXAM_TYPE_OPTIONS, type ExamType } from "@/lib/exam-types";
import { useTeacherClasses, claimSchoolClass } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";



interface Assignment {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  scheduled_publish_at?: string | null;
  max_attempts: number;
  randomize_choices: boolean;
  randomize_order: boolean;
  class_id: string | null;
  group_id?: string | null;

  created_at: string;
  activity_data: any[];
  worksheet_id?: string | null;
  lockdown_mode?: boolean;
  is_portfolio_task?: boolean;
  exam_type?: string | null;
}


interface WorksheetOption {
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

const TeacherAssignments = () => {
  const navigate = useNavigate();
  const { groups } = useSubjectGroups();
  const [searchParams] = useSearchParams();

  const prefillLessonId = searchParams.get("lessonId");
  const prefillLessonTitle = searchParams.get("lessonTitle") || "";
  const prefillLessonType = (searchParams.get("lessonType") as "global" | "teacher" | null) || "teacher";
  const prefillWorksheetId = searchParams.get("worksheetId");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  // Třídy bereme z hooku – nabízí nejdřív moje třídy, pak existující třídy školy
  const { classes, myClasses, schoolClasses, refetch: refetchClasses } = useTeacherClasses();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** Když je vyplněné, formulář upravuje existující úlohu místo vytváření nové. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(!!prefillLessonId || !!searchParams.get("classId") || !!searchParams.get("groupId"));

  // Form state
  const [title, setTitle] = useState(prefillLessonTitle ? `Pracovní list – ${prefillLessonTitle}` : "");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [randomizeChoices, setRandomizeChoices] = useState(false);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  // Cíl zadání se předvyplní z Výuky (?classId=… nebo ?groupId=…), nikdy obojí.
  const prefillGroupId = searchParams.get("groupId") || "";
  const prefillClassId = prefillGroupId ? "" : (searchParams.get("classId") || "");
  const [selectedClassId, setSelectedClassId] = useState<string>(prefillClassId);
  // Zadání lze nově směrovat i na skupinu předmětu (vedle třídy, nikdy obojí).
  const [selectedGroupId, setSelectedGroupId] = useState<string>(prefillGroupId);

  const [worksheets, setWorksheets] = useState<WorksheetOption[]>([]);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string>(prefillWorksheetId || "");
  const [lockdownMode, setLockdownMode] = useState(false);
  const [isPortfolioTask, setIsPortfolioTask] = useState(false);

  /** Portfoliový úkol a lockdown se vylučují — zapnutí portfolia lockdown vypne. */
  const togglePortfolioTask = (next: boolean) => {
    setIsPortfolioTask(next);
    if (next) setLockdownMode(false);
  };
  const [examType, setExamType] = useState<ExamType | "ukol">("ukol");
  const [filterExamType, setFilterExamType] = useState<string>("__all__");
  // Naplánované zveřejnění – appka úlohu zpřístupní žákům sama v daný čas.
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("08:00");


  useEffect(() => {
    loadData();
  }, []);

  // (Old AI inline generator removed — worksheets are now first-class entities.)

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const [assignmentsRes, worksheetsRes] = await Promise.all([
      supabase.from("assignments" as any).select("*").order("created_at", { ascending: false }),
      supabase
        .from("worksheets" as any)
        .select("id, title, status, updated_at")
        .in("status", ["draft", "published"])
        .order("updated_at", { ascending: false }),
    ]);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as any);
    if (worksheetsRes.data) setWorksheets(worksheetsRes.data as any);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Chyba", description: "Zadej název úlohy.", variant: "destructive" });
      return;
    }
    // Úkol musí mít adresáta – bez třídy nebo skupiny by ho nešlo komu zobrazit.
    if (!selectedClassId && !selectedGroupId) {
      toast({
        title: "Vyberte třídu nebo skupinu",
        description: "Úkol lze zadat jen třídě nebo skupině, kterou učíte.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");

      // Naplánované zveřejnění: uloží se jako `scheduled` + časová značka,
      // publikaci pak provede appka na pozadí. Bez plánu zůstává „Koncept“.
      let scheduledPublishAt: string | null = null;
      if (scheduleEnabled) {
        if (!scheduleDate) {
          throw new Error("Vyberte datum zveřejnění.");
        }
        const [h, m] = scheduleTime.split(":").map((n) => parseInt(n, 10));
        const when = new Date(scheduleDate);
        when.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
        const unchanged =
          !!editingId &&
          assignments.find((a) => a.id === editingId)?.scheduled_publish_at ===
            when.toISOString();
        if (when.getTime() <= Date.now() && !unchanged) {
          throw new Error("Čas zveřejnění musí být v budoucnosti.");
        }
        scheduledPublishAt = when.toISOString();

      }

      // Předmět (Výuka) — použije se pro sdílení se spoluučiteli dané Výuky.
      const subjectIdParam = searchParams.get("subjectId");
      let subjectIdForAssignment: string | null = subjectIdParam || null;
      if (!subjectIdForAssignment && selectedWorksheetId) {
        const { data: ws } = await supabase
          .from("worksheets")
          .select("subject_id")
          .eq("id", selectedWorksheetId)
          .maybeSingle();
        subjectIdForAssignment = (ws as any)?.subject_id ?? null;
      }

      if (editingId) {
        // Úprava už zadané úlohy: název, popis, termín, cíl i nastavení lze měnit
        // i po zveřejnění. Stav (koncept/publikováno) měníme jen kvůli plánu.
        const patch: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim(),
          deadline: deadline?.toISOString() || null,
          max_attempts: maxAttempts,
          randomize_choices: randomizeChoices,
          randomize_order: randomizeOrder,
          class_id: selectedGroupId ? null : (selectedClassId || null),
          group_id: selectedGroupId || null,
          worksheet_id: selectedWorksheetId || null,
          lockdown_mode: lockdownMode,
          is_portfolio_task: isPortfolioTask,
          exam_type: examType === "ukol" ? null : examType,
        };
        if (subjectIdForAssignment) patch.subject_id = subjectIdForAssignment;
        const original = assignments.find((a) => a.id === editingId);
        if (scheduledPublishAt) {
          patch.scheduled_publish_at = scheduledPublishAt;
          if (original?.status !== "published") patch.status = "scheduled";
        } else {
          patch.scheduled_publish_at = null;
          if (original?.status === "scheduled") patch.status = "draft";
        }
        const { error } = await supabase
          .from("assignments" as any)
          .update(patch as any)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Změny uloženy" });
      } else {
        const { error } = await supabase.from("assignments" as any).insert({
          teacher_id: user.id,
          title: title.trim(),
          description: description.trim(),
          deadline: deadline?.toISOString() || null,
          max_attempts: maxAttempts,
          randomize_choices: randomizeChoices,
          randomize_order: randomizeOrder,
          class_id: selectedGroupId ? null : (selectedClassId || null),
          group_id: selectedGroupId || null,
          subject_id: subjectIdForAssignment,
          status: scheduledPublishAt ? "scheduled" : "draft",
          scheduled_publish_at: scheduledPublishAt,
          activity_data: [] as any,
          worksheet_id: selectedWorksheetId || null,
          lockdown_mode: lockdownMode,
          is_portfolio_task: isPortfolioTask,
          exam_type: examType === "ukol" ? null : examType,
        } as any);

        if (error) throw error;
        toast({
          title: scheduledPublishAt ? "Úloha naplánována" : "Úloha vytvořena",
          description: scheduledPublishAt
            ? `Žákům se zpřístupní ${new Date(scheduledPublishAt).toLocaleString("cs-CZ")}.`
            : undefined,
        });
      }

      setShowForm(false);
      resetForm();
      loadData();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Když Výuka předá třídu školy, ke které učitel ještě není přihlášený, přihlásíme ho.
  useEffect(() => {
    if (!prefillClassId) return;
    if (!schoolClasses.some((c) => c.id === prefillClassId)) return;
    (async () => {
      await claimSchoolClass(prefillClassId);
      await refetchClasses();
    })();
  }, [prefillClassId, schoolClasses]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDeadline(undefined);
    setMaxAttempts(1);
    setRandomizeChoices(false);
    setRandomizeOrder(false);
    setSelectedClassId(prefillClassId);
    setSelectedGroupId(prefillGroupId);

    setSelectedWorksheetId("");
    setLockdownMode(false);
    setIsPortfolioTask(false);
    setExamType("ukol");
    setScheduleEnabled(false);
    setScheduleDate(undefined);
    setScheduleTime("08:00");
  };

  /** Otevře formulář s předvyplněnými hodnotami už zadané úlohy. */
  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setTitle(a.title ?? "");
    setDescription(a.description ?? "");
    setDeadline(a.deadline ? new Date(a.deadline) : undefined);
    setMaxAttempts(a.max_attempts ?? 1);
    setRandomizeChoices(!!a.randomize_choices);
    setRandomizeOrder(!!a.randomize_order);
    setSelectedGroupId(a.group_id || "");
    setSelectedClassId(a.group_id ? "" : (a.class_id || ""));
    setSelectedWorksheetId(a.worksheet_id || "");
    setIsPortfolioTask(!!a.is_portfolio_task);
    setLockdownMode(!!a.lockdown_mode && !a.is_portfolio_task);
    setExamType((a.exam_type as ExamType) || "ukol");
    if (a.scheduled_publish_at) {
      const when = new Date(a.scheduled_publish_at);
      setScheduleEnabled(true);
      setScheduleDate(when);
      setScheduleTime(
        `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`,
      );
    } else {
      setScheduleEnabled(false);
      setScheduleDate(undefined);
      setScheduleTime("08:00");
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };



  const handlePublish = async (id: string) => {
    const { error } = await supabase
      .from("assignments" as any)
      .update({ status: "published", scheduled_publish_at: null } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Úloha publikována" });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("assignments" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Úloha smazána" });
      loadData();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Úlohy pro žáky</h1>
            <p className="text-sm text-muted-foreground">Vytvářej a spravuj zadání úloh</p>
          </div>
        </div>

        <Tabs defaultValue="assignments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assignments">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Úlohy
            </TabsTrigger>
            <TabsTrigger value="results">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Výsledky
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            <div className="flex justify-between gap-2 flex-wrap">
              <Select value={filterExamType} onValueChange={setFilterExamType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrovat podle typu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Všechny typy</SelectItem>
                  {EXAM_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (showForm && !editingId) {
                    setShowForm(false);
                    return;
                  }
                  resetForm();
                  setShowForm(true);
                }}
              >

                <Plus className="w-4 h-4 mr-2" />
                Nová úloha
              </Button>
            </div>

        {/* Create form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{editingId ? "Upravit úlohu" : "Nová úloha"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Název</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Test – Zlomky" className="mt-1" />
              </div>
              <div>
                <Label>Popis (volitelný)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instrukce pro žáky…" className="mt-1" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Deadline */}
                <div>
                  <Label>Termín odevzdání</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {deadline ? format(deadline, "d. M. yyyy", { locale: cs }) : "Bez termínu"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadline}
                        onSelect={setDeadline}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Max attempts */}
                <div>
                  <Label>Počet pokusů</Label>
                  <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="mt-1" />
                </div>
              </div>

              {/* Scheduled publishing */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                >
                  <div>
                    <Label htmlFor="assignment-schedule" className="text-sm cursor-pointer">
                      Naplánovat zveřejnění
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Úloha zůstane žákům skrytá a appka ji zpřístupní sama ve zvolený čas.
                    </p>
                  </div>
                  <Switch
                    id="assignment-schedule"
                    checked={scheduleEnabled}
                    onCheckedChange={setScheduleEnabled}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {scheduleEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Datum zveřejnění</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full mt-1 justify-start text-left font-normal",
                              !scheduleDate && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {scheduleDate
                              ? format(scheduleDate, "d. M. yyyy", { locale: cs })
                              : "Vyberte datum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={setScheduleDate}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Čas</Label>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>


              <div className="grid grid-cols-2 gap-4">
                {/* Class or subject group */}
                <div>
                  <Label>Třída nebo skupina (volitelné)</Label>
                  <Select
                    value={
                      selectedGroupId
                        ? `group:${selectedGroupId}`
                        : selectedClassId
                          ? `class:${selectedClassId}`
                          : "__all__"
                    }
                    onValueChange={async (v) => {
                      if (v === "__all__") {
                        setSelectedClassId("");
                        setSelectedGroupId("");
                      } else if (v.startsWith("group:")) {
                        setSelectedGroupId(v.slice(6));
                        setSelectedClassId("");
                      } else {
                        const classId = v.slice(6);
                        setSelectedClassId(classId);
                        setSelectedGroupId("");
                        // Existující třída školy: učitel se k ní přihlásí jako vyučující
                        if (classes.find((c) => c.id === classId)?.source === "school") {
                          await claimSchoolClass(classId);
                          refetchClasses();
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Všichni žáci" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Všichni žáci</SelectItem>
                      {myClasses.map((c) => (
                        <SelectItem key={c.id} value={`class:${c.id}`}>{c.name}</SelectItem>
                      ))}
                      {schoolClasses.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Třídy školy</div>
                          {schoolClasses.map((c) => (
                            <SelectItem key={c.id} value={`class:${c.id}`}>
                              {c.name}
                              {c.year ? ` · ${c.year}. ročník` : ""}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {groups.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Skupiny předmětu</div>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={`group:${g.id}`}>
                              {g.name}
                              {g.subjectName ? ` · ${g.subjectName}` : ""}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>


                {/* Exam type */}
                <div>
                  <Label>Typ</Label>
                  <Select value={examType} onValueChange={(v) => setExamType(v as ExamType | "ukol")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Randomization */}
              <div className="flex flex-col gap-3 p-3 border border-border rounded-lg bg-muted/30">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setRandomizeOrder(!randomizeOrder)}
                >
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="assignment-randomize-order" className="text-sm cursor-pointer">
                      Zamíchat pořadí otázek
                    </Label>
                  </div>
                  <Switch
                    id="assignment-randomize-order"
                    checked={randomizeOrder}
                    onCheckedChange={setRandomizeOrder}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setRandomizeChoices(!randomizeChoices)}
                >
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="assignment-randomize-choices" className="text-sm cursor-pointer">
                      Zamíchat volby u otázek
                    </Label>
                  </div>
                  <Switch
                    id="assignment-randomize-choices"
                    checked={randomizeChoices}
                    onCheckedChange={setRandomizeChoices}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Portfolio task */}
              <div
                className="flex items-start justify-between gap-3 p-3 border border-border rounded-lg bg-muted/30 cursor-pointer"
                onClick={() => togglePortfolioTask(!isPortfolioTask)}
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <Label htmlFor="assignment-portfolio" className="text-sm cursor-pointer">
                      Portfoliový úkol
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Místo kvízu žáci nahrají výstup (soubor/foto/PDF). Odevzdání se automaticky přidá do jejich portfolia.
                    </p>
                  </div>
                </div>
                <Switch
                  id="assignment-portfolio"
                  checked={isPortfolioTask}
                  onCheckedChange={togglePortfolioTask}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Lockdown mode */}
              <div
                className={cn(
                  "flex items-start justify-between gap-3 p-3 border border-border rounded-lg bg-muted/30",
                  isPortfolioTask ? "opacity-70" : "cursor-pointer",
                )}
                onClick={() => {
                  if (!isPortfolioTask) setLockdownMode(!lockdownMode);
                }}
              >
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <Label
                      htmlFor="assignment-lockdown"
                      className={cn("text-sm", !isPortfolioTask && "cursor-pointer")}
                    >
                      Lockdown mód (bezpečný test)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Žák píše test ve fullscreenu, kopírování a vkládání jsou blokovány. Opuštění stránky se zaznamenává a uvidíte ho ve výsledcích.
                    </p>
                    {isPortfolioTask && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        Nelze kombinovat s portfoliovým úkolem — žáci jen nahrávají výstup, netestují se.
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  id="assignment-lockdown"
                  checked={lockdownMode}
                  onCheckedChange={setLockdownMode}
                  disabled={isPortfolioTask}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>



            {/* Pracovní list selector */}
            <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Pracovní list (volitelné)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vyber existující pracovní list – žáci ho otevřou v interaktivním plejeru.
                </p>
                <div className="flex gap-2">
                  <Select
                    value={selectedWorksheetId || "__none__"}
                    onValueChange={(v) => setSelectedWorksheetId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="— Žádný pracovní list —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Žádný pracovní list —</SelectItem>
                      {worksheets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.title} {w.status === "draft" ? "(koncept)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (prefillLessonId) {
                        params.set("from_lesson", prefillLessonId);
                        params.set("from_lesson_type", prefillLessonType);
                      }
                      const returnUrl = `/ucitel/ulohy${
                        prefillLessonId
                          ? `?lessonId=${prefillLessonId}&lessonTitle=${encodeURIComponent(prefillLessonTitle)}`
                          : ""
                      }`;
                      params.set("return_to", returnUrl);
                      window.open(`/ucitel/pracovni-listy?${params.toString()}`, "_blank");
                    }}
                    title="Vytvořit nový pracovní list v novém okně"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Nový
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={loadData}
                    title="Obnovit seznam pracovních listů"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {selectedWorksheetId && (
                  <p className="text-[11px] text-muted-foreground">
                    ✓ Žáci uvidí tento pracovní list v interaktivním plejeru.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : editingId ? <Pencil className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingId ? "Uložit změny" : "Vytvořit"}

                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Zrušit</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assignments list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Zatím žádné úlohy. Klikni na „Nová úloha".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments
              .filter((a) => filterExamType === "__all__" || (filterExamType === "ukol" ? !a.exam_type : a.exam_type === filterExamType))
              .map((a) => (
              <Card key={a.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{a.title}</h3>
                        <ExamTypeBadge examType={a.exam_type} showDefault />
                        <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-xs">
                          {a.status === "published"
                            ? "Publikováno"
                            : a.status === "scheduled"
                              ? "Naplánováno"
                              : "Koncept"}
                        </Badge>
                        {a.status === "scheduled" && a.scheduled_publish_at && (
                          <Badge variant="outline" className="text-xs">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            {new Date(a.scheduled_publish_at).toLocaleString("cs-CZ", {
                              day: "numeric",
                              month: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Badge>
                        )}

                        {a.group_id && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            {groups.find((g) => g.id === a.group_id)?.name ?? "Skupina"}
                          </Badge>
                        )}

                      </div>
                      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {a.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(a.deadline), "d. M. yyyy", { locale: cs })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          {a.max_attempts} {a.max_attempts === 1 ? "pokus" : "pokusy"}
                        </span>
                        {a.randomize_order && <span className="flex items-center gap-1"><Shuffle className="w-3 h-3" /> Míchání</span>}
                        {a.lockdown_mode && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Lock className="w-3 h-3" /> Lockdown
                          </span>
                        )}
                      </div>
                      <TeacherAssignmentAttachments assignmentId={a.id} />
                    </div>
                    <div className="flex gap-1">
                      {a.status === "published" && a.class_id && (
                        <RemindButton
                          mode="teacher"
                          receiverType="class"
                          receiverIds={[a.class_id]}
                          title={`Připomenutí úkolu: ${a.title}`}
                          content={
                            a.deadline
                              ? `Nezapomeň odevzdat úkol „${a.title}" do ${format(new Date(a.deadline), "d. M. yyyy", { locale: cs })}.`
                              : `Nezapomeň na úkol „${a.title}".`
                          }
                          link={`/student/ulohy`}
                        />
                      )}
                      {(a.status === "draft" || a.status === "scheduled") && (
                        <Button size="sm" variant="outline" onClick={() => handlePublish(a.id)}>
                          <Send className="w-3.5 h-3.5 mr-1" />
                          {a.status === "scheduled" ? "Publikovat hned" : "Publikovat"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Upravit
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(a.id)}>

                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>

          <TabsContent value="results">
            {userId && <AssignmentResultsDashboard teacherId={userId} />}
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherAssignments;
