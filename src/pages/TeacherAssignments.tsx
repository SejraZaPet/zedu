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
import { Loader2, Plus, CalendarIcon, Trash2, Send, Clock, Users, Shuffle, RotateCcw, Eye, EyeOff, BarChart3, FileText, ExternalLink, Lock } from "lucide-react";
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


interface Assignment {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  max_attempts: number;
  randomize_choices: boolean;
  randomize_order: boolean;
  class_id: string | null;
  created_at: string;
  activity_data: any[];
  worksheet_id?: string | null;
  lockdown_mode?: boolean;
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
  const [searchParams] = useSearchParams();
  const prefillLessonId = searchParams.get("lessonId");
  const prefillLessonTitle = searchParams.get("lessonTitle") || "";
  const prefillLessonType = (searchParams.get("lessonType") as "global" | "teacher" | null) || "teacher";
  const prefillWorksheetId = searchParams.get("worksheetId");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(!!prefillLessonId);

  // Form state
  const [title, setTitle] = useState(prefillLessonTitle ? `Pracovní list – ${prefillLessonTitle}` : "");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [randomizeChoices, setRandomizeChoices] = useState(false);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [worksheets, setWorksheets] = useState<WorksheetOption[]>([]);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string>(prefillWorksheetId || "");
  const [lockdownMode, setLockdownMode] = useState(false);
  const [examType, setExamType] = useState<ExamType | "ukol">("ukol");
  const [filterExamType, setFilterExamType] = useState<string>("__all__");

  useEffect(() => {
    loadData();
  }, []);

  // (Old AI inline generator removed — worksheets are now first-class entities.)

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const [assignmentsRes, classesRes, worksheetsRes] = await Promise.all([
      supabase.from("assignments" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("classes").select("id, name").eq("archived", false),
      supabase
        .from("worksheets" as any)
        .select("id, title, status, updated_at")
        .in("status", ["draft", "published"])
        .order("updated_at", { ascending: false }),
    ]);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as any);
    if (classesRes.data) setClasses(classesRes.data);
    if (worksheetsRes.data) setWorksheets(worksheetsRes.data as any);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Chyba", description: "Zadej název úlohy.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");

      const { error } = await supabase.from("assignments" as any).insert({
        teacher_id: user.id,
        title: title.trim(),
        description: description.trim(),
        deadline: deadline?.toISOString() || null,
        max_attempts: maxAttempts,
        randomize_choices: randomizeChoices,
        randomize_order: randomizeOrder,
        class_id: selectedClassId || null,
        status: "draft",
        activity_data: [] as any,
        worksheet_id: selectedWorksheetId || null,
        lockdown_mode: lockdownMode,
        exam_type: examType === "ukol" ? null : examType,
      } as any);

      if (error) throw error;
      toast({ title: "Úloha vytvořena" });
      setShowForm(false);
      resetForm();
      loadData();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDeadline(undefined);
    setMaxAttempts(1);
    setRandomizeChoices(false);
    setRandomizeOrder(false);
    setSelectedClassId("");
    setSelectedWorksheetId("");
    setLockdownMode(false);
    setExamType("ukol");
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase.from("assignments" as any).update({ status: "published" } as any).eq("id", id);
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
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="w-4 h-4 mr-2" />
                Nová úloha
              </Button>
            </div>

        {/* Create form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Nová úloha</CardTitle>
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
                        disabled={(date) => date < new Date()}
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

              <div className="grid grid-cols-2 gap-4">
                {/* Class */}
                <div>
                  <Label>Třída (volitelné)</Label>
                  <Select value={selectedClassId || "__all__"} onValueChange={(v) => setSelectedClassId(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Všichni žáci" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Všichni žáci</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm">Zamíchat pořadí otázek</Label>
                  </div>
                  <Switch checked={randomizeOrder} onCheckedChange={setRandomizeOrder} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Zamíchat volby u otázek</Label>
                </div>
                <Switch checked={randomizeChoices} onCheckedChange={setRandomizeChoices} />
              </div>
            </div>

            {/* Lockdown mode */}
            <div className="flex items-start justify-between gap-3 p-3 border border-border rounded-lg bg-muted/30">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-sm">Lockdown mód (bezpečný test)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Žák píše test ve fullscreenu, kopírování a vkládání jsou blokovány. Opuštění stránky se zaznamenává a uvidíte ho ve výsledcích.
                  </p>
                </div>
              </div>
              <Switch checked={lockdownMode} onCheckedChange={setLockdownMode} />
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
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Vytvořit
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
                          {a.status === "published" ? "Publikováno" : "Koncept"}
                        </Badge>
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
                      {a.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => handlePublish(a.id)}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Publikovat
                        </Button>
                      )}
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
