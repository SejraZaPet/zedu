import { assignmentStatus, assignmentClassProgress, type ClassProgress } from "@/lib/assignment-status";
import { cheatSheetAllowed } from "@/lib/cheatsheet";
import { unpublishedWorksheet } from "@/lib/worksheet-assignment-link";
import UnpublishedWorksheetWarning from "@/components/worksheet/UnpublishedWorksheetWarning";
import AddAssignmentMenu from "@/components/assignments/AddAssignmentMenu";
import { safeWallReturn } from "@/lib/wall-composer";
import { AssignmentStatusGroups, AssignmentStateIcon, AssignmentStateBadge } from "@/components/assignments/AssignmentStatusGroups";
import { useState, useEffect, useMemo, useRef } from "react";
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
import { Loader2, Plus, CalendarIcon, Trash2, Send, Clock, Users, Shuffle, RotateCcw, Eye, EyeOff, BarChart3, FileText, ExternalLink, Lock, Pencil, Check, ClipboardList, FolderCheck, ListTodo, BookOpen, Megaphone, ArrowUp, ArrowDown, X } from "lucide-react";
import AssignmentFormActions from "@/components/assignments/AssignmentFormActions";
import { showSaveChangesOnly, editSaveOutcome } from "@/lib/assignment-edit-save";
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
import { isPlanWithoutContent, type PlanLesson } from "@/lib/planned-assignment";
import { addLesson, applyLessonsToSettings, assignmentLessons, lessonCountLabel, lessonFieldsForSave, moveLesson, removeLesson, assignmentWorksheets, addWorksheet, moveWorksheet, removeWorksheet, worksheetFieldsForSave, applyWorksheetsToSettings, materialContentLabel, type MaterialWorksheet } from "@/lib/assignment-content";
import { SearchableSelect } from "@/components/ui/searchable-select";
import AssignmentMaterialsEditor from "@/components/assignments/AssignmentMaterialsEditor";
import AssignmentDescriptionEditor from "@/components/assignments/AssignmentDescriptionEditor";
import SubjectPicker from "@/components/subjects/SubjectPicker";
import { type AssignmentMaterial, parseMaterials } from "@/lib/assignment-materials";
import { assignmentDescriptionToText } from "@/lib/assignment-description";
import { Checkbox } from "@/components/ui/checkbox";
import { ANNOUNCEMENT_MAX, KIND_LABELS, assignmentKind, isPinned, lateLimit, lateMode, lateUntilFromDays, mergeKindSettings, kindFromParam, kindHas, neutralizeForKind, canChangeKind, worksheetGoesToPortfolio, KIND_TEXT, type AssignmentKind } from "@/lib/assignment-kind";
import AssignmentTargetsPicker, { type AssignmentTarget } from "@/components/assignments/AssignmentTargetsPicker";
import AssignmentRecipientsPicker from "@/components/assignments/AssignmentRecipientsPicker";
import { audienceAllowed, audienceError, effectiveRecipients, fetchRecipientsMap, syncRecipients, type AudienceMode } from "@/lib/assignment-recipients";
import AssignmentListFilters, { readAssignmentFilter, saveAssignmentFilter } from "@/components/assignments/AssignmentListFilters";
import {
  ALL_SCOPE, ALL_STATUS, courseSubjectOptions, filterAssignments, groupsFullyInClass, keepSubject, statusCounts,
  type CourseSubjectSource,
} from "@/lib/results-filters";



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
  subject?: string | null;
  settings?: unknown;
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
  const wallReturn = searchParams.get("fromWall") === "1" ? safeWallReturn(searchParams.get("return_to")) : null;

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
  // Druh položky (úkol / materiál / oznámení) a odevzdání po termínu – ukládá se do settings.
  const [formKind, setFormKind] = useState<AssignmentKind>(() => kindFromParam(searchParams.get("kind")) ?? "task");
  /** ID položek, které už mají aspoň jeden pokus žáka (druh pak nelze měnit). */
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(() => new Set());
  const [notifyEmailOpt, setNotifyEmailOpt] = useState<boolean | null>(wallReturn ? false : null);
  const [commentsOpt, setCommentsOpt] = useState<boolean | null>(null);
  const [cheatsheetOpt, setCheatsheetOpt] = useState(false);
  const [notifyOverdueOpt, setNotifyOverdueOpt] = useState<boolean | null>(null);
  const [lateChoice, setLateChoice] = useState<"no" | "3" | "7" | "14" | "custom" | "unlimited">("no");
  const [lateCustom, setLateCustom] = useState("");
  const [pinned, setPinned] = useState(false);
  const [visibleUntil, setVisibleUntil] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [randomizeChoices, setRandomizeChoices] = useState(false);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  // Cíl zadání se předvyplní z Výuky (?classId=… nebo ?groupId=…), nikdy obojí.
  const prefillGroupId = searchParams.get("groupId") || "";
  const prefillClassId = prefillGroupId ? "" : (searchParams.get("classId") || "");
  const [selectedClassId, setSelectedClassId] = useState<string>(prefillClassId);
  // Zadání lze nově směrovat i na skupinu předmětu (vedle třídy, nikdy obojí).
  const [selectedGroupId, setSelectedGroupId] = useState<string>(prefillGroupId);
  // Nový úkol lze zadat více cílům najednou; každý cíl = samostatný řádek.
  const prefillTargets = (): AssignmentTarget[] =>
    prefillGroupId ? [{ key: `group:${prefillGroupId}`, publishAt: "", deadlineAt: "" }]
    : prefillClassId ? [{ key: `class:${prefillClassId}`, publishAt: "", deadlineAt: "" }] : [];
  const [newTargets, setNewTargets] = useState<AssignmentTarget[]>(prefillTargets);

  const [worksheets, setWorksheets] = useState<WorksheetOption[]>([]);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string>(prefillWorksheetId || "");
  const [materialWorksheets, setMaterialWorksheets] = useState<MaterialWorksheet[]>(() => prefillWorksheetId ? [{ id: prefillWorksheetId, title: "Pracovní list" }] : []);
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
  /** Materiál: libovolný počet lekcí v pořadí (settings.lessons). */
  const [materialLessons, setMaterialLessons] = useState<PlanLesson[]>([]);

  /** Portfoliový úkol a lockdown se vylučují — zapnutí portfolia lockdown vypne. */
  const togglePortfolioTask = (next: boolean) => {
    setIsPortfolioTask(next);
    if (next) setLockdownMode(false);
  };
  const [examType, setExamType] = useState<ExamType | "ukol">("ukol");
  const [filterExamType, setFilterExamType] = useState<string>("__all__");
  /** Filtr podle třídy/skupiny v seznamu úloh. */
  const [filterTarget, setFilterTarget] = useState<string>(() => readAssignmentFilter("scope", ALL_SCOPE));
  const [filterSubject, setFilterSubject] = useState<string>(() => readAssignmentFilter("subject", ALL_SCOPE));
  const [filterStatus, setFilterStatus] = useState<string>(() => readAssignmentFilter("status", ALL_STATUS));
  const [courseSubjects, setCourseSubjects] = useState<CourseSubjectSource[]>([]);
  const [filterClassMembers, setFilterClassMembers] = useState<{ class_id: string; user_id: string }[]>([]);
  const [filterGroupMembers, setFilterGroupMembers] = useState<{ group_id: string; student_id: string }[]>([]);
  /** Odevzdanost pro publikované úlohy: id úlohy → {odevzdáno, celkem}. */
  const [progress, setProgress] = useState<Record<string, ClassProgress>>({});
  const [recipientsMap, setRecipientsMap] = useState<Record<string, string[]>>({});
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
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

  // Přepnutí na materiál: dosud vybraná jedna lekce se stane první v seznamu.
  useEffect(() => {
    if (formKind !== "material" || !linkedLessonId) return;
    setMaterialLessons((x) => (x.length ? x : [{ id: linkedLessonId, source: linkedLessonSource === "textbook_lessons" ? "textbook_lessons" : "teacher_textbook_lessons", title: "Lekce" }]));
  }, [formKind, linkedLessonId, linkedLessonSource]);

  useEffect(() => {
    if (formKind !== "material" || !selectedWorksheetId) return;
    setMaterialWorksheets((list) => list.length ? list : [{ id: selectedWorksheetId, title: worksheets.find((w) => w.id === selectedWorksheetId)?.title ?? "Pracovní list" }]);
  }, [formKind, selectedWorksheetId]);

  useEffect(() => {
    setMaterialWorksheets((list) => list.map((w) => ({ ...w, title: worksheets.find((option) => option.id === w.id)?.title ?? w.title })));
  }, [worksheets]);

  // Starší záznamy mají u lekce jen ID – dohledáme názvy pro seznam materiálu.
  useEffect(() => {
    const missing = materialLessons.filter((l) => l.title === "Lekce");
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const names = new Map<string, string>();
      for (const table of ["teacher_textbook_lessons", "textbook_lessons"] as const) {
        const ids = missing.filter((l) => l.source === table).map((l) => l.id);
        if (!ids.length) continue;
        const { data } = await supabase.from(table as any).select("id, title").in("id", ids);
        for (const r of ((data as any[]) ?? [])) if (r?.title) names.set(r.id, r.title);
      }
      if (!cancelled && names.size) setMaterialLessons((list) => list.map((l) => ({ ...l, title: names.get(l.id) ?? l.title })));
    })();
    return () => { cancelled = true; };
  }, [materialLessons]);


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
        .in("status", ["draft", "scheduled", "published"])
        .order("updated_at", { ascending: false }),
    ]);
    const list = (assignmentsRes.data as any[]) || [];
    const subjectIds = [...new Set(list.map((assignment) => assignment.subject_id).filter(Boolean))] as string[];
    const { data: subjectRows } = subjectIds.length
      ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
      : { data: [] as any[] };
    const subjectNames = new Map(((subjectRows ?? []) as any[]).map((subject) => [subject.id, subject.name]));
    const enriched = list.map((assignment) => ({ ...assignment, subject: assignment.subject_id ? subjectNames.get(assignment.subject_id) ?? null : null }));
    if (assignmentsRes.data) setAssignments(enriched as any);
    if (worksheetsRes.data) setWorksheets(worksheetsRes.data as any);
    await loadProgress(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const classIds = classes.map((item) => item.id);
      const groupIds = groups.map((item) => item.id);
      const [slotsRes, classMembersRes, groupMembersRes] = await Promise.all([
        supabase.from("class_schedule_slots").select("class_id, subject_id").eq("created_by", userId).is("group_id", null).not("subject_id", "is", null),
        classIds.length ? supabase.from("class_members").select("class_id, user_id").in("class_id", classIds) : Promise.resolve({ data: [] as any[] }),
        groupIds.length ? supabase.from("subject_group_members").select("group_id, student_id").in("group_id", groupIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      setFilterClassMembers((classMembersRes.data ?? []) as any);
      setFilterGroupMembers((groupMembersRes.data ?? []) as any);
      const ids = [...new Set([
        ...(slotsRes.data ?? []).map((slot: any) => slot.subject_id),
        ...groups.flatMap((group) => group.subjectIds ?? [group.subject_id]),
        ...assignments.map((assignment) => assignment.subject_id).filter(Boolean),
      ])] as string[];
      const [{ data: linkedSubjects }, { data: ownedSubjects }] = await Promise.all([
        ids.length ? supabase.from("subjects").select("id, name").in("id", ids) : Promise.resolve({ data: [] as any[] }),
        supabase.from("subjects").select("id, name").eq("created_by", userId),
      ]);
      const catalog = [...new Map([...((linkedSubjects ?? []) as any[]), ...((ownedSubjects ?? []) as any[])].map((subject) => [subject.id, subject])).values()];
      setCourseSubjects(catalog.map((subject) => ({
        id: subject.id,
        name: subject.name,
        classIds: (slotsRes.data ?? []).filter((slot: any) => slot.subject_id === subject.id).map((slot: any) => slot.class_id),
        groupIds: groups.filter((group) => (group.subjectIds ?? [group.subject_id]).includes(subject.id)).map((group) => group.id),
      })));
    })();
  }, [assignments, classes, groups, userId]);

  const filterGroupToClass = useMemo(
    () => groupsFullyInClass(filterGroupMembers, filterClassMembers),
    [filterClassMembers, filterGroupMembers],
  );
  const filterSubjectOptions = useMemo(
    () => courseSubjectOptions(filterTarget, assignments, courseSubjects, filterGroupToClass),
    [assignments, courseSubjects, filterGroupToClass, filterTarget],
  );
  useEffect(() => {
    const next = keepSubject(filterSubject, filterSubjectOptions);
    if (next !== filterSubject) {
      setFilterSubject(next);
      saveAssignmentFilter("subject", next);
    }
  }, [filterSubject, filterSubjectOptions]);
  const assignmentsInCurrentSelection = useMemo(
    () => filterAssignments(assignments, filterTarget, filterSubject, filterGroupToClass),
    [assignments, filterGroupToClass, filterSubject, filterTarget],
  );
  const assignmentStatusCounts = useMemo(() => statusCounts(assignmentsInCurrentSelection), [assignmentsInCurrentSelection]);
  const filteredListAssignments = useMemo(
    () => filterAssignments(assignments, filterTarget, filterSubject, filterGroupToClass, filterStatus),
    [assignments, filterGroupToClass, filterStatus, filterSubject, filterTarget],
  );

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
      supabase.from("assignment_attempts" as any).select("assignment_id, student_id, group_id, status, score, max_score, submitted_at, progress").in("assignment_id", ids),
      classIds.length
        ? supabase.from("class_members").select("class_id, user_id").in("class_id", classIds)
        : Promise.resolve({ data: [] as any[] }),
      groupIds.length
        ? supabase.from("subject_group_members").select("group_id, student_id").in("group_id", groupIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const recMap = await fetchRecipientsMap(ids);
    setRecipientsMap(recMap);
    const { data: sharedGroups } = await supabase.from("assignment_groups").select("id").in("assignment_id", ids);
    const { data: sharedMembers } = sharedGroups?.length ? await supabase.from("assignment_group_members").select("group_id, student_id").in("group_id", sharedGroups.map((g) => g.id)) : { data: [] };
    const next: Record<string, ClassProgress> = {};
    list.forEach((a) => {
      const rows = ((attemptsRes.data ?? []) as any[]).filter((t) => t.assignment_id === a.id);
      const memberIds = a.group_id
        ? ((groupMembersRes.data ?? []) as any[]).filter((m) => m.group_id === a.group_id).map((m) => m.student_id)
        : a.class_id ? ((membersRes.data ?? []) as any[]).filter((m) => m.class_id === a.class_id).map((m) => m.user_id)
        : rows.map((t) => t.student_id);
      const targetIds = effectiveRecipients(memberIds, recMap[a.id]);
      next[a.id] = assignmentClassProgress(rows, targetIds, sharedMembers ?? []);
    });
    setProgress(next);
    setAttemptedIds(new Set(((attemptsRes.data ?? []) as any[]).map((t) => t.assignment_id as string)));
  };

  /**
   * Společné jádro pro všechny tři akce uložení úlohy.
   * `mode` určuje výsledný stav: "draft" | "scheduled" | "published".
   */
  const kindLocked = !!editingId && !canChangeKind(attemptedIds.has(editingId));
  const hiddenTaskData = !!deadline || maxAttempts !== 1 || randomizeOrder || randomizeChoices || isPortfolioTask || lockdownMode || examType !== "ukol" || groupMode !== "individual" || cheatsheetOpt;
  const unpublishedSelected = kindHas(formKind, "worksheet") ? worksheets.filter(w => unpublishedWorksheet(w.status) && (formKind === "material" ? materialWorksheets.some(m => m.id === w.id) : w.id === selectedWorksheetId)) : [];
  const [pendingWorksheetMode, setPendingWorksheetMode] = useState<"draft" | "scheduled" | "published" | null>(null);
  const [worksheetWarningAccepted, setWorksheetWarningAccepted] = useState(false);
  const submitAssignment = async (mode: "draft" | "scheduled" | "published") => {
    if (unpublishedSelected.length && !worksheetWarningAccepted) { setPendingWorksheetMode(mode); return; }
    setWorksheetWarningAccepted(false);
    if (!title.trim()) {
      toast({ title: "Chyba", description: "Zadej název úlohy.", variant: "destructive" });
      return;
    }
    // Úkol musí mít adresáta – bez třídy nebo skupiny by ho nešlo komu zobrazit.
    if (editingId ? !selectedClassId && !selectedGroupId : newTargets.length === 0) {
      toast({
        title: "Vyberte třídu nebo skupinu",
        description: "Úkol lze zadat jen třídě nebo skupině, kterou učíte.",
        variant: "destructive",
      });
      return;
    }
    const useSelected = audienceAllowed(formKind) && audienceMode === "selected";
    const audErr = useSelected && mode !== "draft"
      ? audienceError("selected", recipientIds.length, audienceTarget.count)
      : useSelected && audienceTarget.count !== 1 ? audienceError("selected", 1, audienceTarget.count) : null;
    if (audErr) {
      toast({ title: "Pro koho", description: audErr, variant: "destructive" });
      return;
    }
    const nextRecipients = useSelected ? recipientIds : [];

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
      const worksheetSave = worksheetFieldsForSave(formKind, materialWorksheets, selectedWorksheetId);
      if (!subjectIdForAssignment && worksheetSave.worksheet_id) {
        const { data: ws } = await supabase
          .from("worksheets")
          .select("subject_id")
          .eq("id", worksheetSave.worksheet_id)
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

      const isTask = formKind === "task";
      if (!isTask) deadlineIso = null;
      if (formKind === "announcement" && assignmentDescriptionToText(description).length > ANNOUNCEMENT_MAX) {
        throw new Error(`Oznámení může mít nejvýše ${ANNOUNCEMENT_MAX} znaků.`);
      }
      const lateFor = (due: string | null): string | null => {
        if (!isTask || !due || lateChoice === "no") return null;
        if (lateChoice === "unlimited") return "unlimited";
        if (lateChoice === "custom") {
          const d = lateCustom ? new Date(`${lateCustom}T23:59`) : null;
          if (!d || isNaN(d.getTime()) || d.getTime() <= new Date(due).getTime()) throw new Error("Datum pro odevzdání po termínu musí být po termínu.");
          return d.toISOString();
        }
        return lateUntilFromDays(due, Number(lateChoice));
      };
      const lessonSave = lessonFieldsForSave(formKind, materialLessons, { id: linkedLessonId, source: linkedLessonSource });
      const kindPatch = (due: string | null) => ({
        kind: formKind, lateUntil: lateFor(due), pinned,
        notifyEmail: notifyEmailOpt, notifyOverdue: notifyOverdueOpt, commentsEnabled: commentsOpt,
        cheatSheetAllowed: cheatsheetOpt,
        visibleUntil: visibleUntil ? new Date(`${visibleUntil}T23:59`).toISOString() : null,
      });

      if (editingId) {
        // Úprava už zadané úlohy: název, popis, termín, cíl i nastavení lze měnit
        // i po zveřejnění. Stav (koncept/naplánováno/publikováno) se mění podle
        // zvolené akce – kromě již publikované úlohy, kde "Publikovat" nedělá
        // republish (žádné duplicitní notifikace studentům).
        const patch: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim(),
          deadline: deadlineIso,
          settings: applyWorksheetsToSettings(applyLessonsToSettings(
            mergeKindSettings(assignments.find((a) => a.id === editingId)?.settings as any, kindPatch(deadlineIso)),
            lessonSave.lessons,
            (assignments.find((a) => a.id === editingId)?.settings as any)?.plan === true,
          ), formKind, materialWorksheets) as any,
          materials: materials as any,
          max_attempts: isTask ? maxAttempts : 1,
          randomize_choices: randomizeChoices,
          randomize_order: randomizeOrder,
          class_id: selectedGroupId ? null : (selectedClassId || null),
          group_id: selectedGroupId || null,
          worksheet_id: worksheetSave.worksheet_id,
          lesson_id: lessonSave.lesson_id,
          lesson_source: lessonSave.lesson_source,
          lockdown_mode: lockdownMode,
          is_portfolio_task: isPortfolioTask,
          exam_type: examType === "ukol" ? null : examType,
          group_mode: groupMode,
          group_size: groupMode === "groups" ? groupSize : groupMode === "pairs" ? 2 : null,
        };
        Object.assign(patch, neutralizeForKind(formKind, patch as any));
        if (subjectIdForAssignment) patch.subject_id = subjectIdForAssignment;
        const original = assignments.find((a) => a.id === editingId);
        const outcome = editSaveOutcome(original?.status, mode);
        if (mode === "scheduled") {
          patch.scheduled_publish_at = scheduledPublishAt;
          if (outcome.status) patch.status = outcome.status;
        } else if (mode === "published") {
          patch.scheduled_publish_at = null;
          // Už publikovanou úlohu nepřepublikujeme – pouze updatneme pole,
          // status zůstává "published" beze změny, trigger nespustí notifikace.
          if (outcome.status) patch.status = outcome.status;
        } else {
          // draft
          patch.scheduled_publish_at = null;
          patch.status = outcome.status;
        }
        // Pořadí: nejdřív příjemci, až pak případné zveřejnění (upozornění dostanou jen vybraní).
        const finalStatus = patch.status as string | undefined;
        if (finalStatus === "published" && original?.status !== "published") {
          const { error: e1 } = await supabase.from("assignments" as any)
            .update({ ...patch, status: "draft" } as any).eq("id", editingId);
          if (e1) throw e1;
          await syncRecipients(editingId, nextRecipients);
          const { error: e2 } = await supabase.from("assignments" as any)
            .update({ status: "published" } as any).eq("id", editingId);
          if (e2) throw e2;
        } else {
          await syncRecipients(editingId, nextRecipients);
          const { error } = await supabase
            .from("assignments" as any)
            .update(patch as any)
            .eq("id", editingId);
          if (error) throw error;
        }
        // Už publikovaná úloha se jen upravuje – status se nemění, toast není "publikováno".
        toast({ title: outcome.toastTitle === "Úloha publikována" ? KIND_TEXT[formKind].published : outcome.toastTitle === "Úloha naplánována" ? KIND_TEXT[formKind].scheduled : outcome.toastTitle });
      } else {
        // Každý vybraný cíl = samostatný nezávislý řádek s vlastními termíny.
        const baseStatus = mode === "published" ? "published" : mode === "scheduled" ? "scheduled" : "draft";
        const rows = newTargets.map((t) => {
          const [kind, id] = t.key.split(":");
          let status = baseStatus;
          let publishAt = scheduledPublishAt;
          if (t.publishAt && mode !== "draft") {
            const when = new Date(t.publishAt);
            if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
              throw new Error("Čas zveřejnění u každého cíle musí být v budoucnosti.");
            }
            publishAt = when.toISOString();
            status = "scheduled";
          }
          if (mode === "draft") publishAt = null;
          const ownDeadline = isTask && t.deadlineAt ? new Date(t.deadlineAt) : null;
          const rowDeadline = ownDeadline && !isNaN(ownDeadline.getTime()) ? ownDeadline.toISOString() : deadlineIso;
          return {
            settings: applyWorksheetsToSettings(applyLessonsToSettings(mergeKindSettings(null, kindPatch(rowDeadline)), lessonSave.lessons, false), formKind, materialWorksheets) as any,
            teacher_id: user.id,
            title: title.trim(),
            description: description.trim(),
            deadline: rowDeadline,
            materials: materials as any,
            max_attempts: isTask ? maxAttempts : 1,
            randomize_choices: randomizeChoices,
            randomize_order: randomizeOrder,
            class_id: kind === "class" ? id : null,
            group_id: kind === "group" ? id : null,
            subject_id: subjectIdForAssignment,
            status,
            scheduled_publish_at: publishAt,
            activity_data: [] as any,
            worksheet_id: worksheetSave.worksheet_id,
            lesson_id: lessonSave.lesson_id,
            lesson_source: lessonSave.lesson_source,
            lockdown_mode: lockdownMode,
            is_portfolio_task: isPortfolioTask,
            exam_type: examType === "ukol" ? null : examType,
            group_mode: groupMode,
            group_size: groupMode === "groups" ? groupSize : groupMode === "pairs" ? 2 : null,
          };
        }).map((r) => neutralizeForKind(formKind, r));
        // S výběrem žáků: vložit jako koncept → uložit příjemce → teprve pak zveřejnit.
        const insertRows = nextRecipients.length || wallReturn
          ? rows.map((r) => ({ ...r, status: "draft", scheduled_publish_at: null }))
          : rows;
        const { data: created, error } = await supabase.from("assignments" as any).insert(insertRows as any).select("id");

        if (error) throw error;
        if (nextRecipients.length || wallReturn) {
          for (let i = 0; i < ((created as any[]) ?? []).length; i++) {
            const row = (created as any[])[i];
            await syncRecipients(row.id, nextRecipients);
            if (rows[i].status !== "draft") {
              const { error: pe } = await supabase.from("assignments" as any)
                .update({ status: rows[i].status, scheduled_publish_at: rows[i].scheduled_publish_at } as any)
                .eq("id", row.id);
              if (pe) throw pe;
            }
          }
        }
        toast({
          title: rows.length > 1
            ? `${KIND_TEXT[formKind].many}: ${rows.length}`
            : mode === "published" ? KIND_TEXT[formKind].published : mode === "scheduled" ? KIND_TEXT[formKind].scheduled : KIND_TEXT[formKind].created,
        });
        // U skupinového úkolu s jedním cílem necháme formulář otevřený, aby šlo hned rozdělit skupiny.
        const createdRows = (created as any[]) ?? [];
        if (kindHas(formKind, "groupMode") && groupMode !== "individual" && createdRows.length === 1) {
          const [kind, id] = newTargets[0].key.split(":");
          setSelectedClassId(kind === "class" ? id : "");
          setSelectedGroupId(kind === "group" ? id : "");
          setEditingId(createdRows[0].id as string);
          await loadData();
          setCreating(false);
          return;
        }
      }

      setShowForm(false);
      resetForm();
      loadData();
      if (wallReturn) navigate(wallReturn);
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const audienceTarget = (() => {
    if (editingId) {
      const n = selectedGroupId || selectedClassId ? 1 : 0;
      return { classId: selectedGroupId ? null : selectedClassId || null, groupId: selectedGroupId || null, count: n };
    }
    if (newTargets.length !== 1) return { classId: null, groupId: null, count: newTargets.length };
    const [k, id] = newTargets[0].key.split(":");
    return { classId: k === "class" ? id : null, groupId: k === "group" ? id : null, count: 1 };
  })();

  const handleSaveDraft = () => submitAssignment("draft");
  const handleSchedule = () => submitAssignment("scheduled");
  const handlePublishForm = () => submitAssignment("published");

  // Už publikovaná úloha při editaci: místo tří tlačítek jen "Uložit změny",
  // aby učitel omylem nestáhl publikovaný úkol do konceptu.
  const editingOriginal = editingId ? assignments.find((a) => a.id === editingId) : null;
  const isEditingPublished = showSaveChangesOnly(editingOriginal?.status);

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
    setNewTargets(prefillTargets());

    setSelectedWorksheetId("");
    setMaterialWorksheets([]);
    setSelectedLessonTextbookId("");
    setLinkedLessonId("");
    setLinkedLessonSource(null);
    setMaterialLessons([]);
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
    setAudienceMode("all"); setRecipientIds([]);
    setFormKind("task"); setLateChoice("no"); setLateCustom(""); setPinned(false); setVisibleUntil(""); setNotifyEmailOpt(null); setNotifyOverdueOpt(null); setCommentsOpt(null);
    setCheatsheetOpt(false);
  };

  /** Otevře formulář s předvyplněnými hodnotami už zadané úlohy. */
  const startEdit = (a: Assignment) => {
    setEditingId(a.id);
    {
      const rec = recipientsMap[a.id] ?? [];
      setRecipientIds(rec);
      setAudienceMode(rec.length ? "selected" : "all");
    }
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
    {
      setFormKind(assignmentKind(a.settings));
      setCheatsheetOpt(cheatSheetAllowed(a.settings));
      const lm = lateMode(a.settings);
      const lim = lateLimit(a.settings);
      setLateChoice(lm === "unlimited" ? "unlimited" : lm === "until" ? "custom" : "no");
      setLateCustom(lim instanceof Date ? format(lim, "yyyy-MM-dd") : "");
      setPinned(isPinned(a.settings));
      const ne = (a.settings as any)?.notifyEmail, no = (a.settings as any)?.notifyOverdue;
      setNotifyEmailOpt(typeof ne === "boolean" ? ne : null);
      const ce = (a.settings as any)?.commentsEnabled;
      setCommentsOpt(typeof ce === "boolean" ? ce : null);
      setNotifyOverdueOpt(typeof no === "boolean" ? no : null);
      const vu = (a.settings as any)?.visibleUntil;
      setVisibleUntil(typeof vu === "string" && !isNaN(new Date(vu).getTime()) ? format(new Date(vu), "yyyy-MM-dd") : "");
    }
    setMaxAttempts(a.max_attempts ?? 1);
    setRandomizeChoices(!!a.randomize_choices);
    setRandomizeOrder(!!a.randomize_order);
    setSelectedGroupId(a.group_id || "");
    setSelectedClassId(a.group_id ? "" : (a.class_id || ""));
    setSelectedWorksheetId(a.worksheet_id || "");
    setMaterialWorksheets(assignmentWorksheets(a).map((w) => ({ ...w, title: worksheets.find((option) => option.id === w.id)?.title ?? w.title })));
    setLinkedLessonId(a.lesson_id || "");
    setLinkedLessonSource(
      (a.lesson_source as "textbook_lessons" | "teacher_textbook_lessons" | null) || null,
    );
    setSelectedLessonTextbookId("");
    setMaterialLessons(assignmentLessons(a));
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
            <p className="text-sm text-muted-foreground">Úkoly, materiály a oznámení</p>
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
              </div>
              <AddAssignmentMenu size="default" onPick={(k) => {
                resetForm();
                setFormKind(k);
                setShowForm(true);
              }} />
            </div>

        {/* Create form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{editingId ? KIND_TEXT[formKind].edit : KIND_TEXT[formKind].create}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset>
                <legend className="text-sm font-medium">Co přidáváte?</legend>
                <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Druh položky">
                  {(["task", "material", "announcement"] as AssignmentKind[]).map((k) => {
                    const Icon = k === "task" ? ClipboardList : k === "material" ? BookOpen : Megaphone;
                    return <Button key={k} type="button" role="radio" aria-checked={formKind === k}
                      variant={formKind === k ? "default" : "outline"} className="min-h-11 gap-2"
                      disabled={kindLocked && formKind !== k} onClick={() => setFormKind(k)}>
                      <Icon className="h-4 w-4" aria-hidden="true" />{KIND_LABELS[k]}
                    </Button>;
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formKind === "task" ? "Žáci úkol odevzdávají; má termín a hodnocení."
                    : formKind === "material" ? "Materiál se neodevzdává – žáci ho jen otevřou. Nemá termín ani hodnocení."
                    : `Krátká zpráva pro žáky (do ${ANNOUNCEMENT_MAX} znaků), bez odevzdání a termínu.`}
                </p>
                {kindLocked && <p className="mt-1 text-xs text-muted-foreground" data-testid="kind-locked">Druh nelze změnit – žáci už mají pokusy nebo odevzdání.</p>}
                {formKind !== "task" && hiddenTaskData && <p className="mt-1 text-xs text-muted-foreground" data-testid="kind-hidden-note">Termín, pokusy a nastavení úkolu zůstávají jen ve formuláři – u {formKind === "material" ? "materiálu" : "oznámení"} se neuloží.</p>}
              </fieldset>
              <div>
                <Label>Název</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Test – Zlomky" className="mt-1" />
              </div>
              <div>
                <Label>Popis (volitelný)</Label>
                <AssignmentDescriptionEditor content={description} onChange={setDescription} />
              </div>

              <fieldset className="space-y-1">
                {kindHas(formKind, "cheatsheet") && <label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={cheatsheetOpt} onCheckedChange={v => setCheatsheetOpt(v === true)} />Tahák povolen</label>}
                <legend className="sr-only">Upozornění žákům</legend>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={notifyEmailOpt ?? formKind !== "material"}
                    onCheckedChange={(v) => setNotifyEmailOpt(v === true)}
                  />
                  Poslat žákům e-mail
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={commentsOpt ?? formKind !== "task"}
                    onCheckedChange={(v) => setCommentsOpt(v === true)}
                  />
                  Povolit komentáře na zdi třídy
                </label>
                {formKind === "task" && (
                  <div>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <Checkbox
                        checked={notifyOverdueOpt ?? true}
                        onCheckedChange={(v) => setNotifyOverdueOpt(v === true)}
                      />
                      Automaticky upozornit, když neodevzdají
                    </label>
                    <p className="ml-6 text-xs text-muted-foreground">Bude aktivní po zapnutí automatických upozornění.</p>
                  </div>
                )}
              </fieldset>

              {formKind === "announcement" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} /> Připnout nahoru
                  </label>
                  <div>
                    <Label htmlFor="announcement-until">Zobrazovat do (volitelné)</Label>
                    <Input id="announcement-until" type="date" value={visibleUntil} onChange={(e) => setVisibleUntil(e.target.value)} className="mt-1" />
                  </div>
                </div>
              )}
              {formKind === "task" && (
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
                <div className="col-span-2">
                  <Label htmlFor="late-choice">Lze odevzdat po termínu</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select id="late-choice" value={lateChoice} disabled={!deadline}
                      onChange={(e) => setLateChoice(e.target.value as typeof lateChoice)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="no">Ne</option>
                      <option value="3">Ano, ještě 3 dny</option>
                      <option value="7">Ano, ještě 7 dní</option>
                      <option value="14">Ano, ještě 14 dní</option>
                      <option value="custom">Ano, do vlastního data</option>
                      <option value="unlimited">Ano, bez omezení</option>
                    </select>
                    {lateChoice === "custom" && (
                      <Input type="date" aria-label="Odevzdat lze nejpozději do" value={lateCustom}
                        onChange={(e) => setLateCustom(e.target.value)} className="w-auto" />
                    )}
                  </div>
                  {!deadline && <p className="mt-1 text-xs text-muted-foreground">Nejdřív nastavte termín odevzdání.</p>}
                </div>
              </div>
              )}

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
                      Položka zůstane žákům skrytá a appka ji zpřístupní sama ve zvolený čas.
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
                {!editingId ? (
                <div className="col-span-2">
                  <AssignmentTargetsPicker
                    targets={newTargets}
                    onChange={setNewTargets}
                    showDeadline={kindHas(formKind, "targetDeadline")}
                    onSelectKey={async (key) => {
                      const id = key.slice(6);
                      if (key.startsWith("class:") && classes.find((c) => c.id === id)?.source === "school") {
                        await claimSchoolClass(id);
                        refetchClasses();
                      }
                    }}
                    sections={[
                      { title: "Moje třídy", options: myClasses.map((c) => ({ key: `class:${c.id}`, label: c.name })) },
                      { title: "Třídy školy", options: schoolClasses.map((c) => ({ key: `class:${c.id}`, label: `${c.name}${c.year ? ` · ${c.year}. ročník` : ""}` })) },
                      { title: "Skupiny předmětu", options: groups.map((g) => ({ key: `group:${g.id}`, label: `${g.name}${g.subjectName ? ` · ${g.subjectName}` : ""}` })) },
                    ]}
                  />
                </div>
                ) : (
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
                )}

                {audienceAllowed(formKind) && (
                  <div className="col-span-2 min-w-0">
                    <AssignmentRecipientsPicker
                      classId={audienceTarget.classId}
                      groupId={audienceTarget.groupId}
                      mode={audienceMode}
                      onModeChange={setAudienceMode}
                      selected={recipientIds}
                      onSelectedChange={setRecipientIds}
                      disabledReason={audienceTarget.count === 1 ? null : "Vybrané žáky lze určit, jen když je zvolená jedna třída nebo skupina."}
                    />
                  </div>
                )}

                {/* Exam type */}
                {kindHas(formKind, "examType") && <div>
                  <Label>Typ</Label>
                  <Select value={examType} onValueChange={(v) => setExamType(v as ExamType | "ukol")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>}
              </div>

              {/* Typ zadání – individuálně / dvojice / skupiny */}
              {kindHas(formKind, "groupMode") && <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-3">
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
              </div>}

              {kindHas(formKind, "randomize") && <>
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
                    {worksheetGoesToPortfolio(formKind, isPortfolioTask, selectedWorksheetId) && (
                      <p className="text-xs font-medium text-muted-foreground mt-1">
                        Žáci vyplní přiložený pracovní list přímo v úkolu. Po odevzdání se list automaticky vloží do jejich portfolia.
                      </p>
                    )}
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
              </>}



            {/* Pracovní list selector */}
            {kindHas(formKind, "worksheet") && formKind !== "material" && <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
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
                    <SelectTrigger className="flex-1 min-w-0 min-h-11 h-auto [&>span]:whitespace-normal [&>span]:break-words">
                      <SelectValue placeholder="— Žádný pracovní list —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Žádný pracovní list —</SelectItem>
                      {worksheets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <span className="block break-words">{w.title}{unpublishedWorksheet(w.status) && <Badge variant="destructive" className="block whitespace-normal mt-1">Nezveřejněno – žáci ho neuvidí</Badge>}</span>
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
                {selectedWorksheetId && !unpublishedSelected.length && (
                  <p className="text-[11px] text-muted-foreground">
                    ✓ Žáci uvidí tento pracovní list v interaktivním plejeru.
                  </p>
                )}
              </div>}

            {/* Propojení s lekcí z učebnice – nezávislé na pracovním listu i portfoliu */}
            {formKind === "material" && <section aria-labelledby="material-lessons-title" className="p-3 border border-border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h3 id="material-lessons-title" className="text-sm font-medium">Pracovní listy a lekce</h3>
              </div>
              {materialWorksheets.length > 0 && <ol className="space-y-2" aria-label="Vybrané pracovní listy">
                {materialWorksheets.map((w, i) => <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 break-words text-sm">{i + 1}. {w.title}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={i === 0} aria-label={`Posunout list ${w.title} nahoru`} title="Posunout nahoru" onClick={() => setMaterialWorksheets((list) => moveWorksheet(list, i, -1))}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={i === materialWorksheets.length - 1} aria-label={`Posunout list ${w.title} dolů`} title="Posunout dolů" onClick={() => setMaterialWorksheets((list) => moveWorksheet(list, i, 1))}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Odebrat list ${w.title}`} title="Odebrat list" onClick={() => setMaterialWorksheets((list) => removeWorksheet(list, w.id))}><X className="h-4 w-4" /></Button>
                  </div>
                </li>)}
              </ol>}
              {materialLessons.length > 0 && (
                <ol className="space-y-2" aria-label="Vybrané lekce">
                  {materialLessons.map((l, i) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
                      <span className="w-6 shrink-0 text-xs font-mono text-muted-foreground">{i + 1}.</span>
                      <span className="min-w-0 flex-1 break-words text-sm">{l.title}</span>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={i === 0}
                          aria-label={`Posunout lekci ${l.title} nahoru`} onClick={() => setMaterialLessons((x) => moveLesson(x, i, -1))}><ArrowUp className="w-4 h-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={i === materialLessons.length - 1}
                          aria-label={`Posunout lekci ${l.title} dolů`} onClick={() => setMaterialLessons((x) => moveLesson(x, i, 1))}><ArrowDown className="w-4 h-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-11 w-11"
                          aria-label={`Odebrat lekci ${l.title}`} onClick={() => setMaterialLessons((x) => removeLesson(x, l.id))}><X className="w-4 h-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <SearchableSelect label="Hledat učebnici" placeholder="— Vyberte učebnici —" value={selectedLessonTextbookId}
                options={lessonTextbooks.map((t) => ({ value: t.id, label: t.title }))} onValueChange={setSelectedLessonTextbookId} />
              <div className="grid min-w-0 grid-cols-2 gap-2">
                <SearchableSelect
                  label="Přidat list" placeholder="+ Přidat list" value="" growing
                  options={worksheets.filter((w) => !materialWorksheets.some((selected) => selected.id === w.id)).map((w) => ({ value: w.id, label: w.title, subtitle: unpublishedWorksheet(w.status) ? "Nezveřejněno – žáci ho neuvidí" : undefined }))}
                  onValueChange={(id) => { const found = worksheets.find((w) => w.id === id); if (found) setMaterialWorksheets((list) => addWorksheet(list, found)); }}
                />
                <SearchableSelect
                  label="Přidat lekci"
                  growing
                  placeholder={lessonOptionsLoading ? "Načítám lekce…" : "+ Přidat lekci"}
                  disabled={!selectedLessonTextbookId || lessonOptionsLoading}
                  value=""
                  options={textbookLessonOptions
                    .filter((l) => !materialLessons.some((m) => m.id === l.id))
                    .map((l) => ({ value: `${l.source}:${l.id}`, label: l.title }))}
                  onValueChange={(v) => {
                    const [source, id] = v.split(":");
                    const found = textbookLessonOptions.find((l) => l.id === id && l.source === source);
                    if (found) setMaterialLessons((x) => addLesson(x, { id: found.id, source: found.source, title: found.title }));
                  }}
                />
              </div>
              {materialLessons.length > 0 && (
                <p className="text-[11px] text-muted-foreground">✓ Žáci uvidí {lessonCountLabel(materialLessons.length)} k otevření.</p>
              )}
            </section>}

            {unpublishedSelected.map(w => <UnpublishedWorksheetWarning key={w.id} worksheet={w} onPublished={id => setWorksheets(list => list.map(item => item.id === id ? { ...item, status: "published" } : item))} />)}

            {kindHas(formKind, "lesson") && formKind !== "material" && <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-2">
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
            </div>}

              <AssignmentFormActions
                isEditingPublished={isEditingPublished}
                creating={creating}
                canSchedule={!!scheduleDate && !!scheduleTime}
                onSaveDraft={handleSaveDraft}
                onSchedule={handleSchedule}
                onPublish={handlePublishForm}
                onCancel={() => { setShowForm(false); resetForm(); if (wallReturn) navigate(wallReturn); }}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <AssignmentListFilters
              classes={classes}
              groups={groups.map((group) => ({ id: group.id, name: group.name, subject: group.subjectName }))}
              subjects={filterSubjectOptions}
              scope={filterTarget}
              subject={filterSubject}
              status={filterStatus}
              counts={assignmentStatusCounts}
              loading={loading}
              onScopeChange={(value) => { setFilterTarget(value); saveAssignmentFilter("scope", value); }}
              onSubjectChange={(value) => { setFilterSubject(value); saveAssignmentFilter("subject", value); }}
              onStatusChange={(value) => { setFilterStatus(value); saveAssignmentFilter("status", value); }}
            />
          </CardContent>
        </Card>

        {/* Assignments list – seskupené podle stavu */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Zatím žádné úkoly, materiály ani oznámení. Klikněte na „Přidat“.</p>
          </div>
        ) : (() => {
          const visible = filteredListAssignments
            .filter((a) => filterExamType === "__all__" || (filterExamType === "ukol" ? !a.exam_type : a.exam_type === filterExamType));

          if (visible.length === 0) return <div className="text-center py-12 text-muted-foreground text-sm">Žádné úlohy odpovídající filtru.</div>;
          return (
            <AssignmentStatusGroups teacher items={visible} storageKey="assignment-groups:teacher"
              statusOf={(a) => assignmentStatus(a, [], new Date(), progress[a.id] ?? { submitted: 0, total: 0, graded: 0 })}
              renderItem={(a, visualStatus) => {
                      const targetName = a.group_id
                        ? groups.find((g) => g.id === a.group_id)?.name ?? "Skupina"
                        : classes.find((c) => c.id === a.class_id)?.name ?? null;
                      const prog = progress[a.id] ?? { submitted: 0, total: 0, graded: 0 };
                      const pct = prog.total > 0 ? Math.round((prog.submitted / prog.total) * 100) : 0;

                      return (
                        <Card
                          key={a.id}
                          className={`assignment-status-card assignment-status-${visualStatus.state} hover:shadow-md transition-shadow cursor-pointer`}
                          onClick={() => setDetailAssignment(a)}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex gap-3 min-w-0">
                                <AssignmentStateIcon status={visualStatus} />
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold break-words">{a.title}</h3>
                                    <AssignmentStateBadge status={visualStatus} />
                                    {assignmentKind(a.settings) === "task" && <ExamTypeBadge examType={a.exam_type} showDefault />}
                                    {assignmentKind(a.settings) === "material" && materialContentLabel(a) && (
                                      <Badge variant="outline" className="text-xs"><BookOpen className="w-3 h-3 mr-1" aria-hidden />{materialContentLabel(a)}</Badge>
                                    )}
                                    {(recipientsMap[a.id]?.length ?? 0) > 0 && (
                                      <Badge variant="outline" className="text-xs">Jen vybraní žáci ({recipientsMap[a.id].length})</Badge>
                                    )}
                                    {isPlanWithoutContent(a) && (
                                      <Badge variant="outline" className="text-xs" title="Naplánováno z přehledu Dnes. Obsah připojíte přes Upravit → Uložit změny.">
                                        Plán · bez obsahu
                                      </Badge>
                                    )}
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
                                      <Badge variant="outline" className="assignment-card-outline text-xs">
                                        <Users className="w-3 h-3 mr-1" />
                                        {targetName}
                                      </Badge>
                                    )}
                                    {a.status === "scheduled" && a.scheduled_publish_at && (
                                      <Badge variant="outline" className="assignment-card-outline text-xs">
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
                                  {a.description && (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                      {assignmentDescriptionToText(a.description)}
                                    </p>
                                  )}

                                  {a.status === "published" && assignmentKind(a.settings) === "task" && (
                                    <div className="space-y-1 pt-1 max-w-xs">
                                      <div className="assignment-card-meta flex justify-between text-xs text-muted-foreground">
                                        <span>{prog.submitted}/{prog.total} odevzdáno</span>
                                        <span>{pct}%</span>
                                      </div>
                                      <Progress value={pct} className="h-1.5" />
                                    </div>
                                  )}

                                  <div className="assignment-card-meta flex items-center gap-4 text-xs text-muted-foreground pt-1">
                                    {a.deadline && assignmentKind(a.settings) === "task" && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(a.deadline), "d. M. yyyy", { locale: cs })}
                                      </span>
                                    )}
                                    {assignmentKind(a.settings) === "task" && <span className="flex items-center gap-1">
                                      <RotateCcw className="w-3 h-3" />
                                      {a.max_attempts} {a.max_attempts === 1 ? "pokus" : "pokusy"}
                                    </span>}
                                    {a.randomize_order && assignmentKind(a.settings) === "task" && <span className="flex items-center gap-1"><Shuffle className="w-3 h-3" /> Míchání</span>}
                                    {a.lockdown_mode && assignmentKind(a.settings) === "task" && (
                                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                        <Lock className="w-3 h-3" /> Lockdown
                                      </span>
                                    )}
                                  </div>
                                  <TeacherAssignmentAttachments assignmentId={a.id} />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="outline" className="assignment-card-action" onClick={() => setDetailAssignment(a)}>Detail</Button>
                                {a.status === "published" && a.class_id && assignmentKind(a.settings) === "task" && (
                                  <RemindButton
                                    mode="teacher"
                                    receiverType="class"
                                    receiverIds={[a.class_id]}
                                    className="assignment-card-action"
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
                                  <Button size="sm" variant="outline" className="assignment-card-action" onClick={() => handlePublish(a.id)}>
                                    <Send className="w-3.5 h-3.5 mr-1" />
                                    {a.status === "scheduled" ? "Publikovat hned" : "Publikovat"}
                                  </Button>
                                )}
                                <Button
                                  className="assignment-card-action"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Výsledky"
                                  title="Výsledky"
                                  onClick={() => setResultsAssignmentId(a.id)}
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  className="assignment-card-action"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Upravit"
                                  title="Upravit"
                                  onClick={() => startEdit(a)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  className="assignment-card-action"
                                  size="icon"
                                  variant="ghost"
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
              }} />
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
      <Dialog open={!!pendingWorksheetMode} onOpenChange={v => { if (!v) { setPendingWorksheetMode(null); setWorksheetWarningAccepted(false); } }}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Úloha obsahuje nezveřejněný list</DialogTitle></DialogHeader>
          <p className="text-sm text-destructive">Nezveřejněno – žáci ho neuvidí. Zveřejněte list, nebo potvrďte uložení bez zveřejnění listu.</p>
          <Button className="min-h-11" variant="outline" onClick={() => setPendingWorksheetMode(null)}>Zpět k listu</Button>
          {!worksheetWarningAccepted ? <Button className="min-h-11" variant="outline" onClick={() => setWorksheetWarningAccepted(true)}>Rozumím, ponechat list nezveřejněný</Button> : <Button className="min-h-11" onClick={() => { const mode = pendingWorksheetMode; setPendingWorksheetMode(null); if (mode) void submitAssignment(mode); }}>Pokračovat v uložení</Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherAssignments;
