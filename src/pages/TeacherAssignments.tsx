import { useState, useEffect, useRef } from "react";
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
import { Loader2, Plus, CalendarIcon, Trash2, Send, Clock, Users, Shuffle, RotateCcw, Eye, EyeOff, BarChart3, FileText, ExternalLink, Lock, Pencil, ClipboardList, FolderCheck, ListTodo, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AssignmentDetailDialog from "@/components/admin/AssignmentDetailDialog";
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
import AssignmentMaterialsEditor from "@/components/assignments/AssignmentMaterialsEditor";
import SubjectPicker from "@/components/subjects/SubjectPicker";
import { type AssignmentMaterial, parseMaterials } from "@/lib/assignment-materials";



interface Assignment {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  materials?: unknown;
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
  lesson_id?: string | null;
  lesson_source?: string | null;
  exam_type?: string | null;
  group_mode?: string | null;
  group_size?: number | null;
  subject_id?: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();

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
  // Termín odevzdání má i konkrétní hodinu; výchozí je konec dne.
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [materials, setMaterials] = useState<AssignmentMaterial[]>([]);
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

  // ---- Propojení úlohy s lekcí z učebnice (nepovinné) ----
  /** Učebnice, ke kterým má učitel přístup (pro výběr lekce). */
  const [lessonTextbooks, setLessonTextbooks] = useState<{ id: string; title: string }[]>([]);
  const [selectedLessonTextbookId, setSelectedLessonTextbookId] = useState<string>("");
  /** Lekce zvolené učebnice – učitelské i globální, každá se svým zdrojem. */
  const [textbookLessonOptions, setTextbookLessonOptions] = useState<
    { id: string; title: string; source: "textbook_lessons" | "teacher_textbook_lessons" }[]
  >([]);
  const [linkedLessonId, setLinkedLessonId] = useState<string>("");
  const [linkedLessonSource, setLinkedLessonSource] = useState<
    "textbook_lessons" | "teacher_textbook_lessons" | null
  >(null);
  const [lessonOptionsLoading, setLessonOptionsLoading] = useState(false);

  /** Portfoliový úkol a lockdown se vylučují — zapnutí portfolia lockdown vypne. */
  const togglePortfolioTask = (next: boolean) => {
    setIsPortfolioTask(next);
    if (next) setLockdownMode(false);
  };
  const [examType, setExamType] = useState<ExamType | "ukol">("ukol");
  const [filterExamType, setFilterExamType] = useState<string>("__all__");
  /** Filtr podle třídy/skupiny v seznamu úloh. */
  const [filterTarget, setFilterTarget] = useState<string>("__all__");
  /** Odevzdanost pro publikované úlohy: id úlohy → {odevzdáno, celkem}. */
  const [progress, setProgress] = useState<Record<string, { submitted: number; total: number }>>({});
  /** Úloha otevřená v needitovatelném detailu (klik na tělo karty). */
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);
  /** Úloha, pro kterou se mají zobrazit výsledky. */
  const [resultsAssignmentId, setResultsAssignmentId] = useState<string | null>(null);
  // Naplánované zveřejnění – appka úlohu zpřístupní žákům sama v daný čas.
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("08:00");

  // ---- Skupinové / párové úkoly ----
  type GroupMode = "individual" | "pairs" | "groups";
  const [groupMode, setGroupMode] = useState<GroupMode>("individual");
  const [groupSize, setGroupSize] = useState(3);
  /** Skupiny vytvořené pro právě upravovanou úlohu (včetně členů). */
  const [assignmentGroups, setAssignmentGroups] = useState<
    { id: string; name: string; members: { id: string; name: string }[] }[]
  >([]);
  /** Žáci zvolené třídy/skupiny předmětu. */
  const [targetMembers, setTargetMembers] = useState<{ id: string; name: string }[]>([]);
  /** Ruční rozdělení: student_id → číslo skupiny (1..N). */
  const [manualAssign, setManualAssign] = useState<Record<string, number>>({});
  const [manualGroupCount, setManualGroupCount] = useState(2);
  const [showManual, setShowManual] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const [copySourceId, setCopySourceId] = useState("");
  /** Předmět úlohy – lze doplnit i u starších úloh bez subject_id. */
  const [formSubjectId, setFormSubjectId] = useState<string | null>(null);


  useEffect(() => {
    loadData();
  }, []);

  // Učebnice pro propojení s lekcí – RLS vrátí jen ty, ke kterým má učitel přístup.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teacher_textbooks" as any)
        .select("id, title")
        .order("title", { ascending: true });
      setLessonTextbooks(((data as any[]) ?? []).map((t) => ({ id: t.id, title: t.title })));
    })();
  }, []);

  // Lekce zvolené učebnice: učitelské lekce + globální lekce přes témata předmětu.
  useEffect(() => {
    if (!selectedLessonTextbookId) {
      setTextbookLessonOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLessonOptionsLoading(true);
      const options: {
        id: string;
        title: string;
        source: "textbook_lessons" | "teacher_textbook_lessons";
      }[] = [];

      const [tbRes, teacherLessonsRes] = await Promise.all([
        supabase
          .from("teacher_textbooks" as any)
          .select("subject, title")
          .eq("id", selectedLessonTextbookId)
          .maybeSingle(),
        supabase
          .from("teacher_textbook_lessons" as any)
          .select("id, title, sort_order")
          .eq("textbook_id", selectedLessonTextbookId)
          .order("sort_order", { ascending: true }),
      ]);

      for (const l of ((teacherLessonsRes.data as any[]) ?? [])) {
        options.push({ id: l.id, title: l.title, source: "teacher_textbook_lessons" });
      }

      const tb = tbRes.data as any;
      const slug =
        (tb?.subject && String(tb.subject).trim()) ||
        String(tb?.title ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      if (slug) {
        const { data: topics } = await supabase
          .from("textbook_topics")
          .select("id")
          .eq("subject", slug);
        const topicIds = ((topics as any[]) ?? []).map((t) => t.id);
        if (topicIds.length > 0) {
          const { data: tas } = await supabase
            .from("lesson_topic_assignments")
            .select("lesson_id")
            .in("topic_id", topicIds);
          const globalIds = [...new Set(((tas as any[]) ?? []).map((a) => a.lesson_id).filter(Boolean))];
          if (globalIds.length > 0) {
            const { data: gl } = await supabase
              .from("textbook_lessons")
              .select("id, title")
              .in("id", globalIds);
            for (const l of ((gl as any[]) ?? [])) {
              options.push({ id: l.id, title: l.title, source: "textbook_lessons" });
            }
          }
        }
      }

      if (!cancelled) {
        setTextbookLessonOptions(options);
        setLessonOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLessonTextbookId]);

  // Při editaci úlohy dohledáme učebnici, ve které propojená lekce leží.
  useEffect(() => {
    if (!linkedLessonId || selectedLessonTextbookId) return;
    (async () => {
      if (linkedLessonSource === "teacher_textbook_lessons") {
        const { data } = await supabase
          .from("teacher_textbook_lessons" as any)
          .select("textbook_id")
          .eq("id", linkedLessonId)
          .maybeSingle();
        const tbId = (data as any)?.textbook_id;
        if (tbId) setSelectedLessonTextbookId(tbId as string);
      }
    })();
  }, [linkedLessonId, linkedLessonSource, selectedLessonTextbookId]);


  // Pokud URL obsahuje ?detail=<id> (např. z Předmět/Třída), otevři detail úlohy jednou.
  const detailParam = searchParams.get("detail");
  const detailOpenedRef = useRef(false);
  /** ID úlohy otevřené přes URL deep-link – jen ta má při zavření vrátit return_to. */
  const deepLinkIdRef = useRef<string | null>(null);
  /** return_to zachycené v okamžiku otevření deep-link dialogu. */
  const deepLinkReturnRef = useRef<string | null>(null);
  useEffect(() => {
    if (detailOpenedRef.current) return;
    if (!detailParam) return;
    if (assignments.length === 0) return;
    const found = assignments.find((a) => a.id === detailParam);
    if (found) {
      detailOpenedRef.current = true;
      deepLinkIdRef.current = detailParam;
      deepLinkReturnRef.current = searchParams.get("return_to");
      setDetailAssignment(found);
    } else {
      detailOpenedRef.current = true;
    }
    // detail/return_to se použily (nebo neplatí) – vyčistíme je z URL, ať nezůstávají viset.
    const next = new URLSearchParams(searchParams);
    next.delete("detail");
    next.delete("return_to");
    setSearchParams(next, { replace: true });
  }, [detailParam, assignments, searchParams, setSearchParams]);

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
    const list = (assignmentsRes.data as any[]) || [];
    if (assignmentsRes.data) setAssignments(list as any);
    if (worksheetsRes.data) setWorksheets(worksheetsRes.data as any);
    await loadProgress(list);
    setLoading(false);
  };

  /**
   * Spočítá „X/Y odevzdáno“ pro publikované úlohy – stejná logika jako
   * v přehledu výsledků (odevzdané pokusy vs. počet členů třídy/skupiny).
   */
  const loadProgress = async (list: any[]) => {
    if (list.length === 0) {
      setProgress({});
      return;
    }
    const ids = list.map((a) => a.id);
    const classIds = [...new Set(list.filter((a) => a.class_id).map((a) => a.class_id as string))];
    const groupIds = [...new Set(list.filter((a) => a.group_id).map((a) => a.group_id as string))];

    const [attemptsRes, membersRes, groupMembersRes] = await Promise.all([
      supabase.from("assignment_attempts" as any).select("assignment_id, student_id, status").in("assignment_id", ids),
      classIds.length
        ? supabase.from("class_members").select("class_id").in("class_id", classIds)
        : Promise.resolve({ data: [] as any[] }),
      groupIds.length
        ? supabase.from("subject_group_members").select("group_id").in("group_id", groupIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const byClass: Record<string, number> = {};
    ((membersRes as any).data || []).forEach((m: any) => {
      byClass[m.class_id] = (byClass[m.class_id] || 0) + 1;
    });
    const byGroup: Record<string, number> = {};
    ((groupMembersRes as any).data || []).forEach((m: any) => {
      byGroup[m.group_id] = (byGroup[m.group_id] || 0) + 1;
    });

    const submittedByAssignment: Record<string, Set<string>> = {};
    (((attemptsRes as any).data as any[]) || []).forEach((att: any) => {
      if (att.status !== "submitted") return;
      if (!submittedByAssignment[att.assignment_id]) submittedByAssignment[att.assignment_id] = new Set();
      submittedByAssignment[att.assignment_id].add(att.student_id);
    });

    const next: Record<string, { submitted: number; total: number }> = {};
    list.forEach((a) => {
      const submitted = submittedByAssignment[a.id]?.size ?? 0;
      const total = a.group_id
        ? byGroup[a.group_id] ?? 0
        : a.class_id
          ? byClass[a.class_id] ?? 0
          : submitted;
      next[a.id] = { submitted, total };
    });
    setProgress(next);
  };

  /**
   * Společné jádro pro všechny tři akce uložení úlohy.
   * `mode` určuje výsledný stav: "draft" | "scheduled" | "published".
   */
  const submitAssignment = async (mode: "draft" | "scheduled" | "published") => {
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
      // publikaci pak provede appka na pozadí.
      let scheduledPublishAt: string | null = null;
      if (mode === "scheduled") {
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
      // Ruční volba ve formuláři má přednost – umožní doplnit předmět u starých úloh.
      let subjectIdForAssignment: string | null =
        formSubjectId || subjectIdParam || null;
      if (!subjectIdForAssignment && selectedWorksheetId) {
        const { data: ws } = await supabase
          .from("worksheets")
          .select("subject_id")
          .eq("id", selectedWorksheetId)
          .maybeSingle();
        subjectIdForAssignment = (ws as any)?.subject_id ?? null;
      }

      // Termín odevzdání = vybraný den + zadaná hodina (výchozí 23:59).
      let deadlineIso: string | null = null;
      if (deadline) {
        const [dh, dm] = deadlineTime.split(":").map((n) => parseInt(n, 10));
        const due = new Date(deadline);
        due.setHours(Number.isFinite(dh) ? dh : 23, Number.isFinite(dm) ? dm : 59, 0, 0);
        deadlineIso = due.toISOString();
      }

      if (editingId) {
        // Úprava už zadané úlohy: název, popis, termín, cíl i nastavení lze měnit
        // i po zveřejnění. Stav (koncept/naplánováno/publikováno) se mění podle
        // zvolené akce – kromě již publikované úlohy, kde "Publikovat" nedělá
        // republish (žádné duplicitní notifikace studentům).
        const patch: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim(),
          deadline: deadlineIso,
          materials: materials as any,
          max_attempts: maxAttempts,
          randomize_choices: randomizeChoices,
          randomize_order: randomizeOrder,
          class_id: selectedGroupId ? null : (selectedClassId || null),
          group_id: selectedGroupId || null,
          worksheet_id: selectedWorksheetId || null,
          lesson_id: linkedLessonId || null,
          lesson_source: linkedLessonId ? linkedLessonSource : null,
          lockdown_mode: lockdownMode,
          is_portfolio_task: isPortfolioTask,
          exam_type: examType === "ukol" ? null : examType,
          group_mode: groupMode,
          group_size: groupMode === "groups" ? groupSize : groupMode === "pairs" ? 2 : null,
        };
        if (subjectIdForAssignment) patch.subject_id = subjectIdForAssignment;
        const original = assignments.find((a) => a.id === editingId);
        if (mode === "scheduled") {
          patch.scheduled_publish_at = scheduledPublishAt;
          if (original?.status !== "published") patch.status = "scheduled";
        } else if (mode === "published") {
          patch.scheduled_publish_at = null;
          // Už publikovanou úlohu nepřepublikujeme – pouze updatneme pole,
          // status zůstává "published" beze změny, trigger nespustí notifikace.
          if (original?.status !== "published") patch.status = "published";
        } else {
          // draft
          patch.scheduled_publish_at = null;
          patch.status = "draft";
        }
        const { error } = await supabase
          .from("assignments" as any)
          .update(patch as any)
          .eq("id", editingId);
        if (error) throw error;
        const toastTitle =
          mode === "published" ? "Úloha publikována" :
          mode === "scheduled" ? "Úloha naplánována" : "Koncept uložen";
        toast({ title: toastTitle });
      } else {
        const status = mode === "published" ? "published" : mode === "scheduled" ? "scheduled" : "draft";
        const { data: created, error } = await supabase.from("assignments" as any).insert({
          teacher_id: user.id,
          title: title.trim(),
          description: description.trim(),
          deadline: deadlineIso,
          materials: materials as any,
          max_attempts: maxAttempts,
          randomize_choices: randomizeChoices,
          randomize_order: randomizeOrder,
          class_id: selectedGroupId ? null : (selectedClassId || null),
          group_id: selectedGroupId || null,
          subject_id: subjectIdForAssignment,
          status,
          scheduled_publish_at: scheduledPublishAt,
          activity_data: [] as any,
          worksheet_id: selectedWorksheetId || null,
          lesson_id: linkedLessonId || null,
          lesson_source: linkedLessonId ? linkedLessonSource : null,
          lockdown_mode: lockdownMode,
          is_portfolio_task: isPortfolioTask,
          exam_type: examType === "ukol" ? null : examType,
          group_mode: groupMode,
          group_size: groupMode === "groups" ? groupSize : groupMode === "pairs" ? 2 : null,
        } as any).select("id").single();

        if (error) throw error;
        toast({
          title: mode === "published" ? "Úloha publikována" : mode === "scheduled" ? "Úloha naplánována" : "Úloha vytvořena",
          description: mode === "scheduled" && scheduledPublishAt
            ? `Žákům se zpřístupní ${new Date(scheduledPublishAt).toLocaleString("cs-CZ")}.`
            : undefined,
        });
        // U skupinových úkolů necháme formulář otevřený, aby šlo hned rozdělit skupiny.
        if (groupMode !== "individual" && (created as any)?.id) {
          setEditingId((created as any).id as string);
          await loadData();
          setCreating(false);
          return;
        }
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

  const handleSaveDraft = () => submitAssignment("draft");
  const handleSchedule = () => submitAssignment("scheduled");
  const handlePublishForm = () => submitAssignment("published");

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
    setDeadlineTime("23:59");
    setMaterials([]);
    setMaxAttempts(1);
    setRandomizeChoices(false);
    setRandomizeOrder(false);
    setSelectedClassId(prefillClassId);
    setSelectedGroupId(prefillGroupId);

    setSelectedWorksheetId("");
    setSelectedLessonTextbookId("");
    setLinkedLessonId("");
    setLinkedLessonSource(null);
    setLockdownMode(false);
    setIsPortfolioTask(false);
    setExamType("ukol");
    setScheduleEnabled(false);
    setScheduleDate(undefined);
    setScheduleTime("08:00");
    setGroupMode("individual");
    setGroupSize(3);
    setAssignmentGroups([]);
    setManualAssign({});
    setManualGroupCount(2);
    setShowManual(false);
    setCopySourceId("");
    setFormSubjectId(null);
  };

  /** Otevře formulář s předvyplněnými hodnotami už zadané úlohy. */
  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    setFormSubjectId(a.subject_id ?? null);
    setTitle(a.title ?? "");
    setDescription(a.description ?? "");
    setDeadline(a.deadline ? new Date(a.deadline) : undefined);
    setDeadlineTime(
      a.deadline
        ? `${String(new Date(a.deadline).getHours()).padStart(2, "0")}:${String(new Date(a.deadline).getMinutes()).padStart(2, "0")}`
        : "23:59",
    );
    setMaterials(parseMaterials(a.materials));
    setMaxAttempts(a.max_attempts ?? 1);
    setRandomizeChoices(!!a.randomize_choices);
    setRandomizeOrder(!!a.randomize_order);
    setSelectedGroupId(a.group_id || "");
    setSelectedClassId(a.group_id ? "" : (a.class_id || ""));
    setSelectedWorksheetId(a.worksheet_id || "");
    setLinkedLessonId(a.lesson_id || "");
    setLinkedLessonSource(
      (a.lesson_source as "textbook_lessons" | "teacher_textbook_lessons" | null) || null,
    );
    setSelectedLessonTextbookId("");
    setIsPortfolioTask(!!a.is_portfolio_task);
    setLockdownMode(!!a.lockdown_mode && !a.is_portfolio_task);
    setExamType((a.exam_type as ExamType) || "ukol");
    setGroupMode(((a.group_mode as GroupMode) || "individual") as GroupMode);
    setGroupSize(a.group_size && a.group_size > 1 ? a.group_size : 3);
    setShowManual(false);
    setCopySourceId("");
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

  // ---------- Skupinové / párové úkoly ----------

  /** Načte žáky zvolené třídy nebo skupiny předmětu (jméno pro zobrazení). */
  const loadTargetMembers = async () => {
    let ids: string[] = [];
    if (selectedGroupId) {
      const { data } = await supabase
        .from("subject_group_members")
        .select("student_id")
        .eq("group_id", selectedGroupId);
      ids = ((data as any[]) || []).map((m: any) => m.student_id);
    } else if (selectedClassId) {
      const { data } = await supabase
        .from("class_members")
        .select("user_id")
        .eq("class_id", selectedClassId);
      ids = ((data as any[]) || []).map((m: any) => m.user_id);
    }
    if (ids.length === 0) {
      setTargetMembers([]);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", ids);
    const list = ids.map((id) => {
      const p = ((profiles as any[]) || []).find((x: any) => x.id === id);
      return {
        id,
        name: p ? `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim() || "Žák" : "Žák",
      };
    });
    setTargetMembers(list.sort((a, b) => a.name.localeCompare(b.name, "cs")));
  };

  /** Načte existující skupiny (a jejich členy) pro upravovanou úlohu. */
  const loadAssignmentGroups = async (assignmentId: string) => {
    const { data: gData } = await supabase
      .from("assignment_groups" as any)
      .select("id, name")
      .eq("assignment_id", assignmentId)
      .order("name");
    const groupsRows = ((gData as any[]) || []);
    if (groupsRows.length === 0) {
      setAssignmentGroups([]);
      return;
    }
    const { data: mData } = await supabase
      .from("assignment_group_members" as any)
      .select("group_id, student_id")
      .in("group_id", groupsRows.map((g: any) => g.id));
    const memberRows = ((mData as any[]) || []);
    const studentIds = [...new Set(memberRows.map((m: any) => m.student_id))];
    let profileMap: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", studentIds);
      ((profiles as any[]) || []).forEach((p: any) => {
        profileMap[p.id] = `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim() || "Žák";
      });
    }
    setAssignmentGroups(
      groupsRows.map((g: any) => ({
        id: g.id,
        name: g.name,
        members: memberRows
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => ({ id: m.student_id, name: profileMap[m.student_id] || "Žák" })),
      })),
    );
  };

  /** Přepíše skupiny úlohy zadaným rozdělením (seznam seznamů student_id). */
  const replaceGroups = async (assignmentId: string, buckets: string[][]) => {
    setGroupBusy(true);
    try {
      await supabase.from("assignment_groups" as any).delete().eq("assignment_id", assignmentId);
      const usable = buckets.filter((b) => b.length > 0);
      for (let i = 0; i < usable.length; i++) {
        const { data: g, error } = await supabase
          .from("assignment_groups" as any)
          .insert({ assignment_id: assignmentId, name: `Skupina ${i + 1}` } as any)
          .select("id")
          .single();
        if (error) throw error;
        const gid = (g as any).id as string;
        const { error: mErr } = await supabase
          .from("assignment_group_members" as any)
          .insert(usable[i].map((sid) => ({ group_id: gid, student_id: sid })) as any);
        if (mErr) throw mErr;
      }
      await loadAssignmentGroups(assignmentId);
      toast({ title: "Skupiny uloženy", description: `Vytvořeno ${usable.length} skupin.` });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setGroupBusy(false);
    }
  };

  /** Náhodné rozdělení (Fisher-Yates) po zvolené velikosti skupiny. */
  const handleRandomSplit = async () => {
    if (!editingId) return;
    if (targetMembers.length === 0) {
      toast({ title: "Žádní žáci", description: "Zvolená třída/skupina nemá žáky.", variant: "destructive" });
      return;
    }
    const size = groupMode === "pairs" ? 2 : Math.max(2, groupSize);
    const shuffled = targetMembers.map((m) => m.id);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const buckets: string[][] = [];
    for (let i = 0; i < shuffled.length; i += size) buckets.push(shuffled.slice(i, i + size));
    // Poslední samotný žák se přidá k předchozí skupině.
    if (buckets.length > 1 && buckets[buckets.length - 1].length === 1) {
      const last = buckets.pop()!;
      buckets[buckets.length - 1].push(...last);
    }
    await replaceGroups(editingId, buckets);
  };

  /** Uloží ruční rozdělení podle vybraných čísel skupin. */
  const handleManualSave = async () => {
    if (!editingId) return;
    const buckets: string[][] = Array.from({ length: manualGroupCount }, () => []);
    targetMembers.forEach((m) => {
      const idx = (manualAssign[m.id] ?? 1) - 1;
      if (idx >= 0 && idx < buckets.length) buckets[idx].push(m.id);
    });
    await replaceGroups(editingId, buckets);
  };

  /** Zkopíruje složení skupin z jiné úlohy stejné třídy/skupiny. */
  const handleCopyGroups = async (sourceId: string) => {
    if (!editingId || !sourceId) return;
    setGroupBusy(true);
    try {
      const { data: gData } = await supabase
        .from("assignment_groups" as any)
        .select("id, name")
        .eq("assignment_id", sourceId)
        .order("name");
      const rows = ((gData as any[]) || []);
      if (rows.length === 0) {
        toast({ title: "Zdrojová úloha nemá skupiny", variant: "destructive" });
        return;
      }
      const { data: mData } = await supabase
        .from("assignment_group_members" as any)
        .select("group_id, student_id")
        .in("group_id", rows.map((g: any) => g.id));
      const members = ((mData as any[]) || []);
      const buckets = rows.map((g: any) =>
        members.filter((m: any) => m.group_id === g.id).map((m: any) => m.student_id as string),
      );
      setGroupBusy(false);
      await replaceGroups(editingId, buckets);
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
      setGroupBusy(false);
    }
  };

  // Načtení žáků cíle při změně cíle nebo režimu
  useEffect(() => {
    if (groupMode === "individual") return;
    loadTargetMembers();
  }, [groupMode, selectedClassId, selectedGroupId]);

  // Načtení existujících skupin upravované úlohy
  useEffect(() => {
    if (editingId && groupMode !== "individual") {
      loadAssignmentGroups(editingId);
    } else {
      setAssignmentGroups([]);
    }
  }, [editingId, groupMode]);

  /** Předchozí skupinové úlohy stejné třídy/skupiny (pro kopii složení). */
  const copySourceOptions = assignments.filter(
    (a) =>
      a.id !== editingId &&
      (a.group_mode ?? "individual") !== "individual" &&
      (selectedGroupId ? a.group_id === selectedGroupId : a.class_id === selectedClassId),
  );



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
              <div className="flex gap-2 flex-wrap">
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
              <Select value={filterTarget} onValueChange={setFilterTarget}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrovat podle třídy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Všechny třídy a skupiny</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={`class:${c.id}`}>{c.name}</SelectItem>
                  ))}
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={`group:${g.id}`}>{g.name} (skupina)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
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
                  <div className="mt-1 flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
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
                    <Input
                      type="time"
                      aria-label="Hodina termínu odevzdání"
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value || "23:59")}
                      disabled={!deadline}
                      className="w-[112px]"
                    />
                  </div>
                </div>


                {/* Max attempts */}
                <div>
                  <Label>Počet pokusů</Label>
                  <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="mt-1" />
                </div>
              </div>

              {/* Materiály k úkolu (odkazy, dokumenty, obrázky, zvuk, video) */}
              {userId && (
                <AssignmentMaterialsEditor
                  materials={materials}
                  onChange={setMaterials}
                  teacherId={userId}
                />
              )}


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


              {/* Předmět – u starších úloh bývá prázdný, lze ho tu doplnit. */}
              <div>
                <Label>Předmět</Label>
                <SubjectPicker
                  value={formSubjectId}
                  onChange={({ subjectId }) => setFormSubjectId(subjectId)}
                  placeholder="Vyberte předmět…"
                  className="mt-1"
                />
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

              {/* Typ zadání – individuálně / dvojice / skupiny */}
              <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Typ zadání</Label>
                    <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individuálně</SelectItem>
                        <SelectItem value="pairs">Ve dvojicích</SelectItem>
                        <SelectItem value="groups">Ve skupinách</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {groupMode === "groups" && (
                    <div>
                      <Label className="text-sm">Velikost skupiny</Label>
                      <Input
                        type="number"
                        min={2}
                        max={10}
                        value={groupSize}
                        onChange={(e) => setGroupSize(Math.max(2, Number(e.target.value) || 3))}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                {groupMode !== "individual" && (
                  <>
                    {!editingId ? (
                      <p className="text-xs text-muted-foreground">
                        Nejdřív úlohu vytvořte – potom tady rozdělíte žáky do skupin.
                      </p>
                    ) : !(selectedClassId || selectedGroupId) ? (
                      <p className="text-xs text-muted-foreground">
                        Vyberte třídu nebo skupinu, ať je koho rozdělit.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <Label className="text-sm">Rozdělení do skupin</Label>
                        <div className="flex gap-2 flex-wrap">
                          <Button type="button" size="sm" variant="outline" disabled={groupBusy} onClick={handleRandomSplit}>
                            {groupBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Shuffle className="w-3.5 h-3.5 mr-1" />}
                            Rozdělit náhodně
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowManual((v) => !v);
                              if (!showManual) {
                                const init: Record<string, number> = {};
                                targetMembers.forEach((m, i) => {
                                  init[m.id] =
                                    manualAssign[m.id] ??
                                    Math.min(manualGroupCount, Math.floor(i / (groupMode === "pairs" ? 2 : groupSize)) + 1);
                                });
                                setManualAssign(init);
                                setManualGroupCount(
                                  Math.max(
                                    2,
                                    Math.ceil(targetMembers.length / (groupMode === "pairs" ? 2 : groupSize)) || 2,
                                  ),
                                );
                              }
                            }}
                          >
                            <Users className="w-3.5 h-3.5 mr-1" />
                            Rozdělit ručně
                          </Button>
                          {copySourceOptions.length > 0 && (
                            <Select
                              value={copySourceId || "__none__"}
                              onValueChange={(v) => {
                                if (v === "__none__") return;
                                setCopySourceId(v);
                                handleCopyGroups(v);
                              }}
                            >
                              <SelectTrigger className="w-[260px] h-9 text-xs">
                                <SelectValue placeholder="Použít skupiny z jiného úkolu" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Použít skupiny z jiného úkolu</SelectItem>
                                {copySourceOptions.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {showManual && (
                          <div className="space-y-2 rounded-lg border border-border p-3 bg-background">
                            {targetMembers.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Tato třída/skupina nemá žáky.</p>
                            ) : (
                              <>
                                {targetMembers.map((m) => (
                                  <div key={m.id} className="flex items-center justify-between gap-3">
                                    <span className="text-sm">{m.name}</span>
                                    <Select
                                      value={String(manualAssign[m.id] ?? 1)}
                                      onValueChange={(v) => setManualAssign((prev) => ({ ...prev, [m.id]: Number(v) }))}
                                    >
                                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: manualGroupCount }, (_, i) => i + 1).map((n) => (
                                          <SelectItem key={n} value={String(n)}>Skupina {n}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setManualGroupCount((n) => n + 1)}
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Přidat skupinu
                                  </Button>
                                  <Button type="button" size="sm" disabled={groupBusy} onClick={handleManualSave}>
                                    {groupBusy && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                                    Uložit rozdělení
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {assignmentGroups.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Vytvořené skupiny ({assignmentGroups.length}) – lze kdykoli přegenerovat.
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {assignmentGroups.map((g) => (
                                <div key={g.id} className="rounded-lg border border-border p-2 bg-background">
                                  <p className="text-sm font-medium">{g.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {g.members.map((m) => m.name).join(", ") || "Bez členů"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
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

            {/* Propojení s lekcí z učebnice – nezávislé na pracovním listu i portfoliu */}
            <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm">Propojit s lekcí z učebnice (volitelné)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Žáci si u úlohy otevřou příslušnou lekci. Lze kombinovat s pracovním listem i portfoliem.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  value={selectedLessonTextbookId || "__none__"}
                  onValueChange={(v) => {
                    setSelectedLessonTextbookId(v === "__none__" ? "" : v);
                    setLinkedLessonId("");
                    setLinkedLessonSource(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— Vyber učebnici —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Vyber učebnici —</SelectItem>
                    {lessonTextbooks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={linkedLessonId || "__none__"}
                  disabled={!selectedLessonTextbookId || lessonOptionsLoading}
                  onValueChange={(v) => {
                    if (v === "__none__") {
                      setLinkedLessonId("");
                      setLinkedLessonSource(null);
                      return;
                    }
                    const found = textbookLessonOptions.find((l) => l.id === v);
                    setLinkedLessonId(v);
                    setLinkedLessonSource(found?.source ?? "teacher_textbook_lessons");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={lessonOptionsLoading ? "Načítám lekce…" : "— Bez lekce —"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Bez lekce —</SelectItem>
                    {textbookLessonOptions.map((l) => (
                      <SelectItem key={`${l.source}-${l.id}`} value={l.id}>
                        {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {linkedLessonId && (
                <p className="text-[11px] text-muted-foreground">
                  ✓ Žáci u úlohy uvidí tlačítko „Otevřít lekci“.
                </p>
              )}
            </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveDraft} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                  Uložit koncept
                </Button>
                {(() => {
                  const canSchedule = !!scheduleDate && !!scheduleTime;
                  const scheduleBtn = (
                    <Button onClick={handleSchedule} disabled={creating || !canSchedule}>
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
                      Naplánovat
                    </Button>
                  );
                  if (canSchedule) return scheduleBtn;
                  return (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block">{scheduleBtn}</span>
                        </TooltipTrigger>
                        <TooltipContent>Nejdřív vyber datum a čas</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })()}
                {(() => {
                  // U editace již publikované úlohy skryjeme "Publikovat",
                  // aby nedošlo k republish a duplicitním notifikacím.
                  const editingOriginal = editingId ? assignments.find((a) => a.id === editingId) : null;
                  const isAlreadyPublished = editingOriginal?.status === "published";
                  if (isAlreadyPublished) return null;
                  return (
                    <Button onClick={handlePublishForm} disabled={creating}>
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Publikovat
                    </Button>
                  );
                })()}
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Zrušit</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assignments list – seskupené podle stavu */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Zatím žádné úlohy. Klikni na „Nová úloha".</p>
          </div>
        ) : (() => {
          const visible = assignments
            .filter((a) => filterExamType === "__all__" || (filterExamType === "ukol" ? !a.exam_type : a.exam_type === filterExamType))
            .filter((a) => {
              if (filterTarget === "__all__") return true;
              const [kind, id] = filterTarget.split(":");
              return kind === "class" ? a.class_id === id : a.group_id === id;
            });

          const SECTIONS: { key: string; label: string; dot: string }[] = [
            { key: "published", label: "Publikováno", dot: "bg-emerald-500" },
            { key: "scheduled", label: "Naplánováno", dot: "bg-muted-foreground" },
            { key: "draft", label: "Koncepty", dot: "border border-border" },
          ];

          if (visible.length === 0) {
            return <div className="text-center py-12 text-muted-foreground text-sm">Žádné úlohy odpovídající filtru.</div>;
          }

          return (
            <div className="space-y-6">
              {SECTIONS.map((section) => {
                const items = visible.filter((a) =>
                  section.key === "draft" ? a.status !== "published" && a.status !== "scheduled" : a.status === section.key,
                );
                if (items.length === 0) return null;
                return (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2.5 h-2.5 rounded-full", section.dot)} />
                      <h2 className="text-sm font-semibold">{section.label}</h2>
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                    </div>

                    {items.map((a) => {
                      // Typová ikona a barva: pracovní list / portfolio / běžný úkol
                      const kind = a.worksheet_id
                        ? { Icon: ClipboardList, className: "text-blue-600 dark:text-blue-400 bg-blue-500/10" }
                        : a.is_portfolio_task
                          ? { Icon: FolderCheck, className: "text-purple-600 dark:text-purple-400 bg-purple-500/10" }
                          : { Icon: ListTodo, className: "text-muted-foreground bg-muted" };
                      const KindIcon = kind.Icon;
                      const targetName = a.group_id
                        ? groups.find((g) => g.id === a.group_id)?.name ?? "Skupina"
                        : classes.find((c) => c.id === a.class_id)?.name ?? null;
                      const prog = progress[a.id] ?? { submitted: 0, total: 0 };
                      const pct = prog.total > 0 ? Math.round((prog.submitted / prog.total) * 100) : 0;

                      return (
                        <Card
                          key={a.id}
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setDetailAssignment(a)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex gap-3 min-w-0">
                                <span className={cn("shrink-0 rounded-md p-2", kind.className)}>
                                  <KindIcon className="w-4 h-4" />
                                </span>
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold">{a.title}</h3>
                                    <ExamTypeBadge examType={a.exam_type} showDefault />
                                    {!a.subject_id && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/10"
                                        title="Úloha není přiřazená k předmětu – doplňte ji přes Upravit."
                                      >
                                        Bez předmětu
                                      </Badge>
                                    )}
                                    {targetName && (
                                      <Badge variant="outline" className="text-xs">
                                        <Users className="w-3 h-3 mr-1" />
                                        {targetName}
                                      </Badge>
                                    )}
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
                                  </div>
                                  {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}

                                  {a.status === "published" && (
                                    <div className="space-y-1 pt-1 max-w-xs">
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{prog.submitted}/{prog.total} odevzdáno</span>
                                        <span>{pct}%</span>
                                      </div>
                                      <Progress value={pct} className="h-1.5" />
                                    </div>
                                  )}

                                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
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
                              </div>

                              <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Výsledky"
                                  title="Výsledky"
                                  onClick={() => setResultsAssignmentId(a.id)}
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Upravit"
                                  title="Upravit"
                                  onClick={() => startEdit(a)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  aria-label="Smazat"
                                  title="Smazat"
                                  onClick={() => handleDelete(a.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <AssignmentDetailDialog
          assignment={detailAssignment}
          open={!!detailAssignment}
          onOpenChange={(o) => {
            if (!o) {
              const closedId = detailAssignment?.id ?? null;
              const wasDeepLink =
                deepLinkIdRef.current !== null && deepLinkIdRef.current === closedId;
              const returnTo = deepLinkReturnRef.current;
              setDetailAssignment(null);
              if (wasDeepLink) {
                deepLinkIdRef.current = null;
                deepLinkReturnRef.current = null;
                if (returnTo) navigate(decodeURIComponent(returnTo));
              }
            }
          }}
        />

        <Dialog open={!!resultsAssignmentId} onOpenChange={(o) => { if (!o) setResultsAssignmentId(null); }}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Výsledky úlohy</DialogTitle>
            </DialogHeader>
            {userId && resultsAssignmentId && (
              <AssignmentResultsDashboard teacherId={userId} initialAssignmentId={resultsAssignmentId} />
            )}
          </DialogContent>
        </Dialog>
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
