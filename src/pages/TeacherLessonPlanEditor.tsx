import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, format, getISOWeek, startOfDay } from "date-fns";
import { cs } from "date-fns/locale";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Clock,
  Save,
  CalendarDays,
  Sparkles,
  BookOpen,
  Loader2,
  Plus,
  X,
  FileDown,
  LayoutTemplate,
  Trash2,
  Share2,
  Lock,
  Globe,
  School,
  Lightbulb,
  Wand2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportLessonPlanPdf,
  type LessonPlanTemplate,
} from "@/lib/lesson-plan-pdf-export";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadSchedule, expandTeacherSchedule } from "@/lib/teacher-schedule-store";
import { expandScheduleSlots, formatTime } from "@/lib/calendar-utils";
import { savePhasePlan } from "@/lib/lesson-phase-plans";

interface Phase {
  key: string;
  title: string;
  hint: string;
}

const PHASES: Phase[] = [
  { key: "uvod", title: "Úvod", hint: "Přivítání, organizace, cíl hodiny." },
  { key: "motivace", title: "Motivace", hint: "Otázka, příběh, video — vzbuzení zájmu." },
  { key: "hlavni", title: "Hlavní část", hint: "Výklad nového učiva, klíčové aktivity." },
  { key: "procviceni", title: "Procvičení", hint: "Samostatná či skupinová práce, příklady." },
  { key: "reflexe", title: "Reflexe", hint: "Co si žáci odnesli, zpětná vazba." },
  { key: "zaver", title: "Závěr", hint: "Shrnutí, domácí úkol, rozloučení." },
];

type ActivityKind =
  | "quiz"
  | "worksheet"
  | "live_game"
  | "lesson_block"
  | "offline_activity"
  | "discussion";

interface SuggestedActivity {
  kind: ActivityKind;
  title: string;
}

interface PhaseValue {
  timeMin: string;
  description: string;
  activities?: SuggestedActivity[];
}

const ACTIVITY_META: Record<ActivityKind, { label: string; href: string | null; hrefLabel: string }> = {
  quiz: { label: "Kvíz / interaktivní aktivita", href: "/ucitel/aktivity", hrefLabel: "Otevřít aktivity" },
  worksheet: { label: "Pracovní list", href: "/ucitel/pracovni-listy", hrefLabel: "Pracovní listy" },
  live_game: { label: "Živá hra", href: "/ucitel/hry", hrefLabel: "Spustit živou hru" },
  lesson_block: { label: "Blok z učebnice", href: null, hrefLabel: "Otevřít lekci" },
  offline_activity: { label: "Offline aktivita z učebnice", href: null, hrefLabel: "Otevřít lekci" },
  discussion: { label: "Řízená diskuse", href: null, hrefLabel: "" },
};

type PhasesState = Record<string, PhaseValue>;

const emptyPhases = (): PhasesState =>
  PHASES.reduce((acc, p) => {
    acc[p.key] = { timeMin: "", description: "", activities: [] };
    return acc;
  }, {} as PhasesState);

interface ScheduledOccurrence {
  date: string;
  start: string;
  end: string;
  className?: string;
  room?: string;
}

interface LessonOption {
  id: string;
  title: string;
  source: "teacher_textbook_lessons" | "lessons";
  textbookId?: string;
  textbookTitle?: string;
  content?: string;
  blocks?: any;
}

export default function TeacherLessonPlanEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { subjects } = useTeacherSubjects();

  const [title, setTitle] = useState("Nový plán hodin");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState<PhasesState>(emptyPhases);
  const [subject, setSubject] = useState<string>(searchParams.get("subject") ?? "");
  const [linkedDate, setLinkedDate] = useState<string>(searchParams.get("date") ?? "");
  const [linkedTime, setLinkedTime] = useState<string>(
    searchParams.get("start")
      ? `${searchParams.get("start")}-${searchParams.get("end") ?? ""}`
      : "",
  );
  const [textbookId, setTextbookId] = useState<string>("");
  const [lessonId, setLessonId] = useState<string>("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planDbId, setPlanDbId] = useState<string | null>(
    id && id !== "novy" ? id : null,
  );
  const [linkedSlots, setLinkedSlots] = useState<
    {
      subject: string;
      classId?: string;
      className?: string;
      date: string;
      time: string;
    }[]
  >([]);

  // Load existing plan from DB when editing
  useEffect(() => {
    if (!user || !id || id === "novy") return;
    (async () => {
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return;
      setPlanDbId(data.id);
      setTitle(data.title || "Plán hodiny");
      const input = (data.input_data as any) || {};
      if (input.description) setDescription(input.description);
      if (input.subject) setSubject(input.subject);
      if (input.linkedDate) setLinkedDate(input.linkedDate);
      if (input.linkedTime) setLinkedTime(input.linkedTime);
      if (input.textbookId) setTextbookId(input.textbookId);
      if (input.lessonId) setLessonId(input.lessonId);
      if (input.classId) setClassId(input.classId);
      if (Array.isArray(input.linkedSlots)) setLinkedSlots(input.linkedSlots);
      if (input.phases) setPhases({ ...emptyPhases(), ...input.phases });
      if ((data as any).shared_visibility) setSharedVisibility((data as any).shared_visibility);
      if (typeof (data as any).anonymous === "boolean") setAnonymous((data as any).anonymous);
    })();
  }, [user, id]);

  const [dbSlots, setDbSlots] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("class_schedule_slots" as any)
      .select("*, classes(name)")
      .then(({ data }) => setDbSlots((data as any[]) ?? []));
  }, [user]);

  /** All teacher textbooks (for explicit picker, independent of subject) */
  const [textbooks, setTextbooks] = useState<{ id: string; title: string; subject: string }[]>([]);
  const [loadingTextbooks, setLoadingTextbooks] = useState(false);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTextbooks([]);
      return;
    }

    let cancelled = false;
    setLoadingTextbooks(true);

    (async () => {
      const { data, error } = await supabase
        .from("teacher_textbooks")
        .select("id, title, subject")
        .order("title", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.warn("[TeacherLessonPlanEditor] textbooks load failed:", error.message);
        setTextbooks([]);
      } else {
        setTextbooks((data as any[]) ?? []);
      }

      setLoadingTextbooks(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  /** Default textbook from chosen subject */
  const matchedTextbookId = useMemo(() => {
    const s = subjects.find(
      (s) => s.label.toLowerCase() === (subject || "").trim().toLowerCase(),
    );
    return s?.teacherTextbookId;
  }, [subjects, subject]);

  useEffect(() => {
    if (matchedTextbookId && !textbookId) setTextbookId(matchedTextbookId);
  }, [matchedTextbookId, textbookId]);

  const [lessons, setLessons] = useState<LessonOption[]>([]);
  useEffect(() => {
    setLessons([]);
    setLessonId("");
    if (!textbookId) return;
    (async () => {
      // 1) Teacher's own textbook lessons
      const { data: ownLessons } = await supabase
        .from("teacher_textbook_lessons")
        .select("id, title, blocks")
        .eq("textbook_id", textbookId)
        .order("sort_order", { ascending: true });

      const own: LessonOption[] = (ownLessons ?? []).map((l: any) => ({
        id: l.id,
        title: l.title,
        source: "teacher_textbook_lessons" as const,
        textbookId,
        blocks: l.blocks,
      }));

      // 2) Global textbook lessons linked via subject slug of the textbook
      const tb = textbooks.find((t) => t.id === textbookId);
      let global: LessonOption[] = [];
      if (tb?.subject) {
        const { data: topics } = await supabase
          .from("textbook_topics" as any)
          .select("id")
          .eq("subject", tb.subject);
        const topicIds = (topics ?? []).map((t: any) => t.id);
        if (topicIds.length) {
          const { data: gl } = await supabase
            .from("textbook_lessons" as any)
            .select("id, title, blocks, sort_order")
            .in("topic_id", topicIds)
            .order("sort_order", { ascending: true });
          global = (gl ?? []).map((l: any) => ({
            id: l.id,
            title: l.title,
            source: "lessons" as const,
            textbookId,
            blocks: l.blocks,
          }));
        }
      }

      setLessons([...own, ...global]);
    })();
  }, [textbookId, textbooks]);

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === lessonId),
    [lessons, lessonId],
  );

  /** Classes the teacher belongs to (for filtering schedule occurrences) */
  const { classes: teacherClasses } = useTeacherClasses();

  const [classId, setClassId] = useState<string>("");

  /**
   * (subject, classId) pairs derived from both the personal schedule
   * (localStorage) and the DB-backed `class_schedule_slots`. Used to
   * cross-filter the Subject and Class pickers.
   */
  const schedulePairs = useMemo(() => {
    const pairs: { subject: string; classId?: string; className?: string }[] = [];
    // Personal schedule (all weeks pooled)
    const ps = loadSchedule();
    const allLessons = [...ps.lessonsBoth, ...ps.lessonsOdd, ...ps.lessonsEven];
    for (const l of allLessons) {
      if (!l.subject) continue;
      pairs.push({
        subject: l.subject.trim(),
        classId: l.classId || undefined,
        className: l.className || undefined,
      });
    }
    // DB schedule slots
    for (const s of dbSlots as any[]) {
      const subj = (s.subject_label || "").trim();
      if (!subj) continue;
      pairs.push({
        subject: subj,
        classId: s.class_id || undefined,
        className: s.classes?.name || undefined,
      });
    }
    return pairs;
  }, [dbSlots]);

  /** Class IDs that have the chosen subject scheduled. */
  const allowedClassIds = useMemo(() => {
    if (!subject) return null; // null = no filter
    const set = new Set<string>();
    const target = subject.trim().toLowerCase();
    for (const p of schedulePairs) {
      if (p.classId && p.subject.toLowerCase() === target) set.add(p.classId);
    }
    return set;
  }, [schedulePairs, subject]);

  /** Subject labels that are scheduled for the chosen class. */
  const allowedSubjects = useMemo(() => {
    if (!classId) return null;
    const set = new Set<string>();
    for (const p of schedulePairs) {
      if (p.classId === classId) set.add(p.subject.toLowerCase());
    }
    return set;
  }, [schedulePairs, classId]);

  /** Filtered subject options for the Subject picker. */
  const filteredSubjects = useMemo(() => {
    if (!allowedSubjects) return subjects;
    const filtered = subjects.filter((s) =>
      allowedSubjects.has(s.label.trim().toLowerCase()),
    );
    // Always keep currently selected subject visible to avoid an empty trigger.
    if (subject && !filtered.some((s) => s.label === subject)) {
      filtered.unshift({ label: subject, source: "predefined" } as any);
    }
    return filtered;
  }, [subjects, allowedSubjects, subject]);

  /** Filtered classes for the Class picker. */
  const filteredClasses = useMemo(() => {
    if (!allowedClassIds) return teacherClasses;
    const filtered = teacherClasses.filter((c) => allowedClassIds.has(c.id));
    if (classId && !filtered.some((c) => c.id === classId)) {
      const cur = teacherClasses.find((c) => c.id === classId);
      if (cur) filtered.unshift(cur);
    }
    return filtered;
  }, [teacherClasses, allowedClassIds, classId]);


  /** Schedule occurrences for the chosen subject */
  const occurrences = useMemo<(ScheduledOccurrence & { classId?: string })[]>(() => {
    if (!subject) return [];
    const from = startOfDay(new Date());
    const to = addDays(from, 8 * 7);
    const personal = expandTeacherSchedule(loadSchedule(), from, to);
    const dbExpanded = expandScheduleSlots(dbSlots as any, from, to);
    const all = [...personal, ...dbExpanded].filter(
      (e) => (e.subject ?? "").trim().toLowerCase() === subject.trim().toLowerCase(),
    );
    const seen = new Set<string>();
    const list: (ScheduledOccurrence & { classId?: string })[] = [];
    for (const e of all.sort((a, b) => a.start.getTime() - b.start.getTime())) {
      const key = `${format(e.start, "yyyy-MM-dd")}-${formatTime(e.start)}-${e.classId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        date: format(e.start, "yyyy-MM-dd"),
        start: formatTime(e.start),
        end: formatTime(e.end),
        className: e.className,
        room: e.room,
        classId: e.classId,
      });
    }
    return list;
  }, [subject, dbSlots]);

  const filteredOccurrences = useMemo(
    () => (classId ? occurrences.filter((o) => o.classId === classId) : occurrences),
    [occurrences, classId],
  );

  const availableDates = useMemo(() => {
    const set = new Map<string, ScheduledOccurrence>();
    for (const o of filteredOccurrences) if (!set.has(o.date)) set.set(o.date, o);
    return Array.from(set.keys());
  }, [filteredOccurrences]);

  const timeSlotsForDate = useMemo(
    () => filteredOccurrences.filter((o) => o.date === linkedDate),
    [filteredOccurrences, linkedDate],
  );

  useEffect(() => {
    if (subject && title === "Nový plán hodin") {
      setTitle(`Plán hodiny – ${subject}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const totalMin = PHASES.reduce((sum, p) => {
    const n = parseInt(phases[p.key].timeMin, 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  function updatePhase(key: string, patch: Partial<PhaseValue>) {
    setPhases((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  /** Extract plain text from teacher_textbook_lessons.blocks (best-effort) */
  function extractText(blocks: any): string {
    if (!blocks) return "";
    if (typeof blocks === "string") return blocks;
    try {
      const arr = Array.isArray(blocks) ? blocks : [];
      return arr
        .map((b: any) => {
          if (!b) return "";
          if (typeof b === "string") return b;
          return (
            b.text ||
            b.content ||
            b.title ||
            (Array.isArray(b.children)
              ? b.children.map((c: any) => c.text || "").join(" ")
              : "")
          );
        })
        .filter(Boolean)
        .join("\n");
    } catch {
      return "";
    }
  }

  /** Compact summary of available blocks for the AI (type + short title). */
  function extractBlockSummaries(blocks: any): { type: string; title: string }[] {
    if (!Array.isArray(blocks)) return [];
    return blocks
      .map((b: any) => {
        if (!b || typeof b !== "object") return null;
        const type = b.type || b.kind || "block";
        const title =
          b.title ||
          b.props?.title ||
          (typeof b.text === "string" ? b.text.slice(0, 80) : "") ||
          (typeof b.content === "string" ? b.content.slice(0, 80) : "") ||
          "";
        return { type: String(type), title: String(title).trim() };
      })
      .filter(Boolean) as { type: string; title: string }[];
  }

  async function generateWithAI(opts?: { fromLessonOnly?: boolean }) {
    const fromLessonOnly = !!opts?.fromLessonOnly;
    if (fromLessonOnly && !selectedLesson) {
      toast({
        title: "Vyber lekci",
        description: "Pro rychlý návrh nejprve zvol učebnici a lekci.",
      });
      return;
    }
    if (!fromLessonOnly && !subject && !aiInstructions.trim() && !selectedLesson) {
      toast({
        title: "Doplň kontext",
        description: "Vyber lekci, předmět nebo zadej vlastní pokyny pro AI.",
      });
      return;
    }
    setAiLoading(true);
    try {
      const lessonContent = selectedLesson ? extractText(selectedLesson.blocks) : "";
      const availableLessonBlocks = selectedLesson
        ? extractBlockSummaries(selectedLesson.blocks)
        : [];
      const { data, error } = await supabase.functions.invoke("generate-lesson-phases", {
        body: {
          subject,
          lessonTitle: selectedLesson?.title,
          lessonContent,
          availableLessonBlocks,
          customInstructions: fromLessonOnly ? "" : aiInstructions,
          totalMin: 45,
        },
      });
      if (error) throw error;
      const incoming = (data as any)?.phases || {};
      setPhases((prev) => {
        const next = { ...prev };
        for (const p of PHASES) {
          const inc = incoming[p.key];
          if (inc) {
            next[p.key] = {
              timeMin: String(inc.timeMin ?? ""),
              description: inc.description ?? "",
              activities: Array.isArray(inc.activities) ? inc.activities : [],
            };
          }
        }
        return next;
      });
      if ((data as any)?.title && title === "Nový plán hodin") {
        setTitle((data as any).title);
      }
      toast({ title: "Plán navržen", description: "AI vyplnila fáze hodiny." });
    } catch (e: any) {
      toast({
        title: "Chyba AI",
        description: e?.message || "Nepodařilo se vygenerovat plán.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }

  function handleExportPdf(template: LessonPlanTemplate) {
    try {
      const [start, end] = (linkedTime || "").split("-");
      const className = teacherClasses.find((c) => c.id === classId)?.name;
      exportLessonPlanPdf(template, {
        title: title?.trim() || "Plán hodiny",
        subject: subject || undefined,
        className,
        date: linkedDate || undefined,
        start: start || undefined,
        end: end || undefined,
        description: description || undefined,
        phases: PHASES.map((p) => ({
          key: p.key,
          title: p.title,
          timeMin: phases[p.key]?.timeMin ?? "",
          description: phases[p.key]?.description ?? "",
          activities: phases[p.key]?.activities ?? [],
        })),
      });
    } catch (e: any) {
      toast({
        title: "Export se nezdařil",
        description: e?.message || "Nepodařilo se otevřít okno tisku.",
        variant: "destructive",
      });
    }
  }

  // Templates
  const [templates, setTemplates] = useState<
    { id: string; title: string; description: string | null; phases_json: any; created_at: string }[]
  >([]);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);

  // Sharing
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedVisibility, setSharedVisibility] = useState<"private" | "public" | "school">("private");
  const [anonymous, setAnonymous] = useState(false);
  const [sharingSaving, setSharingSaving] = useState(false);

  // Learning methods
  type LearningMethod = {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    category: string | null;
    difficulty: string | null;
    time_range: string | null;
    template_phases_json: any;
  };
  const [methods, setMethods] = useState<LearningMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [methodSuggestions, setMethodSuggestions] = useState<
    { method: LearningMethod; reason: string }[]
  >([]);
  const [methodAiLoading, setMethodAiLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("learning_methods")
      .select("id,name,slug,description,category,difficulty,time_range,template_phases_json")
      .order("name", { ascending: true })
      .then(({ data }) => setMethods((data as any[]) ?? []));
  }, []);

  // Load existing method link for the plan
  useEffect(() => {
    if (!planDbId) return;
    supabase
      .from("lesson_method_links")
      .select("method_id")
      .eq("lesson_plan_id", planDbId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.method_id) setSelectedMethodId(data.method_id as string);
      });
  }, [planDbId]);

  function applyMethodTemplate(method: LearningMethod) {
    const arr = Array.isArray(method.template_phases_json) ? method.template_phases_json : [];
    const next = emptyPhases();
    PHASES.forEach((p, idx) => {
      const tp = arr[idx];
      if (!tp) return;
      const desc = [tp.name ? `${tp.name}` : "", tp.description ?? ""]
        .filter(Boolean)
        .join(" — ");
      next[p.key] = {
        timeMin: tp.duration ? String(tp.duration) : "",
        description: desc,
        activities: [],
      };
    });
    setPhases(next);
  }

  async function handleSelectMethod(methodId: string) {
    setSelectedMethodId(methodId);
    const m = methods.find((x) => x.id === methodId);
    if (!m) return;
    applyMethodTemplate(m);
    toast({
      title: `Metoda: ${m.name}`,
      description: "Fáze byly předvyplněny ze šablony metody.",
    });
    if (planDbId && user) {
      await supabase.from("lesson_method_links").delete().eq("lesson_plan_id", planDbId);
      const { error } = await supabase
        .from("lesson_method_links")
        .insert({ lesson_plan_id: planDbId, method_id: methodId });
      if (error) {
        toast({
          title: "Propojení s metodou se neuložilo",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  }

  async function handleRecommendMethods() {
    const goal = [title, description, aiInstructions].filter(Boolean).join(". ").trim();
    if (!goal) {
      toast({
        title: "Zadejte cíl hodiny",
        description: "Vyplňte název, popis nebo pokyny pro AI.",
        variant: "destructive",
      });
      return;
    }
    if (!methods.length) return;
    setMethodAiLoading(true);
    setMethodSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-learning-methods", {
        body: {
          goal,
          subject,
          customInstructions: aiInstructions,
          methods: methods.map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            difficulty: m.difficulty,
            time_range: m.time_range,
            description: m.description,
          })),
        },
      });
      if (error) throw error;
      const recs = (data?.recommendations ?? []) as { method_id: string; reason: string }[];
      const mapped = recs
        .map((r) => {
          const m = methods.find((x) => x.id === r.method_id);
          return m ? { method: m, reason: r.reason } : null;
        })
        .filter(Boolean) as { method: LearningMethod; reason: string }[];
      setMethodSuggestions(mapped);
      if (!mapped.length) {
        toast({ title: "AI nenavrhla žádnou metodu", variant: "destructive" });
      }
    } catch (e: any) {
      toast({
        title: "AI doporučení se nezdařilo",
        description: e?.message || "Zkuste to znovu.",
        variant: "destructive",
      });
    } finally {
      setMethodAiLoading(false);
    }
  }


  async function handleSaveSharing() {
    if (!user) return;
    if (!planDbId) {
      toast({ title: "Nejprve uložte plán", description: "Plán musí existovat, než ho můžete sdílet.", variant: "destructive" });
      return;
    }
    setSharingSaving(true);
    const { error } = await supabase
      .from("lesson_plans")
      .update({ shared_visibility: sharedVisibility, anonymous } as any)
      .eq("id", planDbId);
    setSharingSaving(false);
    if (error) {
      toast({ title: "Uložení sdílení se nezdařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sdílení uloženo" });
    setShareOpen(false);
  }

  async function reloadTemplates() {
    if (!user) return;
    const { data } = await supabase
      .from("lesson_plan_templates")
      .select("id, title, description, phases_json, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setTemplates((data as any[]) ?? []);
  }
  useEffect(() => {
    reloadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSaveAsTemplate() {
    if (!user) return;
    if (!templateTitle.trim()) {
      toast({ title: "Zadejte název šablony", variant: "destructive" });
      return;
    }
    setTemplateSaving(true);
    // Save only structure: titles, times, general descriptions. NO activities, NO lesson-specific content.
    const phases_json = PHASES.map((p) => ({
      key: p.key,
      title: p.title,
      timeMin: parseInt(phases[p.key].timeMin, 10) || 0,
      description: phases[p.key].description || "",
    }));
    const { error } = await supabase.from("lesson_plan_templates").insert({
      teacher_id: user.id,
      title: templateTitle.trim(),
      description: templateDesc.trim() || null,
      phases_json,
    });
    setTemplateSaving(false);
    if (error) {
      toast({ title: "Uložení šablony se nezdařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Šablona uložena" });
    setSaveTemplateOpen(false);
    setTemplateTitle("");
    setTemplateDesc("");
    reloadTemplates();
  }

  function applyTemplate(tpl: { phases_json: any }) {
    const arr = Array.isArray(tpl.phases_json) ? tpl.phases_json : [];
    const next = emptyPhases();
    for (const p of arr) {
      if (!p?.key || !next[p.key]) continue;
      next[p.key] = {
        timeMin: p.timeMin ? String(p.timeMin) : "",
        description: p.description || "",
        activities: [],
      };
    }
    setPhases(next);
    setLoadTemplateOpen(false);
    toast({ title: "Šablona použita", description: "Fáze byly předvyplněny." });
  }

  async function handleSave() {
    if (!user) {
      toast({ title: "Nepřihlášen", description: "Přihlaš se pro uložení plánu.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Persist a clean schedule to local store for calendar (all linked slots)
      const allSlots = [
        ...linkedSlots,
        ...(subject && linkedDate && linkedTime
          ? [
              {
                subject,
                date: linkedDate,
                time: linkedTime,
                classId,
              },
            ]
          : []),
      ];
      const phaseEntries = PHASES.map((p) => ({
        key: p.key,
        title: p.title,
        timeMin: parseInt(phases[p.key].timeMin, 10) || 0,
      }));
      const updatedAt = new Date().toISOString();
      for (const sl of allSlots) {
        const [start, end] = (sl.time || "").split("-");
        if (!sl.subject || !sl.date || !start) continue;
        await savePhasePlan({
          subject: sl.subject,
          date: sl.date,
          start,
          end,
          title,
          phases: phaseEntries,
          updatedAt,
        });
      }

      // Aggregated subjects (for filtering on plans list)
      const aggSubjects = Array.from(
        new Set(
          [subject, ...linkedSlots.map((s) => s.subject)].filter(Boolean) as string[],
        ),
      );

      const payload = {
        teacher_id: user.id,
        title,
        subject: subject || aggSubjects[0] || "",
        grade_band: "",
        slides: [],
        input_data: {
          description,
          subject,
          subjects: aggSubjects,
          linkedDate,
          linkedTime,
          linkedSlots,
          textbookId,
          lessonId,
          classId,
          phases,
        } as any,
      };

      let resultId = planDbId;
      if (planDbId) {
        const { error } = await supabase
          .from("lesson_plans")
          .update(payload)
          .eq("id", planDbId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("lesson_plans")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        resultId = data.id;
        setPlanDbId(data.id);
        // Update URL without navigating away
        window.history.replaceState(null, "", `/ucitel/plany-hodin/${data.id}`);
      }
      // Sync method link
      if (resultId) {
        await supabase.from("lesson_method_links").delete().eq("lesson_plan_id", resultId);
        if (selectedMethodId) {
          await supabase
            .from("lesson_method_links")
            .insert({ lesson_plan_id: resultId, method_id: selectedMethodId });
        }
      }
      toast({ title: "Plán uložen" });
    } catch (e: any) {
      toast({
        title: "Chyba ukládání",
        description: e?.message || "Plán se nepodařilo uložit.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const summaryRows = PHASES.map((p) => ({
    title: p.title,
    timeMin: parseInt(phases[p.key].timeMin, 10) || 0,
  }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/ucitel/plany-hodin")}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na plány
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Celkem: {totalMin} min</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportovat PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Vyberte šablonu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportPdf("short")} className="flex-col items-start gap-0.5">
                  <span className="font-medium">A) Krátký plán</span>
                  <span className="text-xs text-muted-foreground">1 strana – tabulka fází s časy a aktivitami</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPdf("detailed")} className="flex-col items-start gap-0.5">
                  <span className="font-medium">B) Detailní plán</span>
                  <span className="text-xs text-muted-foreground">Pro hospitaci – cíle, kompetence, pomůcky, formy práce</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPdf("student")} className="flex-col items-start gap-0.5">
                  <span className="font-medium">C) Studentský plán</span>
                  <span className="text-xs text-muted-foreground">„Co budeme dnes dělat" – jen názvy fází a aktivity</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => setShareOpen(true)}
              disabled={!planDbId}
              title={planDbId ? "Sdílet plán" : "Nejprve plán uložte"}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Sdílet
            </Button>
            <Button
              variant="outline"
              onClick={() => setLoadTemplateOpen(true)}
              disabled={!templates.length}
              title={templates.length ? "Předvyplnit fáze ze šablony" : "Zatím nemáte žádné šablony"}
            >
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Ze šablony
            </Button>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(true)}>
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Uložit jako šablonu
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Uložit
            </Button>
          </div>
        </div>

        {/* Hlavička plánu */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-title">Název plánu</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Sčítání zlomků – 6. ročník"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-subject">Předmět</Label>
              <Select
                value={subject || undefined}
                onValueChange={(v) => {
                  setSubject(v);
                  setLinkedDate("");
                  setLinkedTime("");
                }}
              >
                <SelectTrigger id="plan-subject">
                  <SelectValue
                    placeholder={
                      filteredSubjects.length
                        ? "Vyber předmět…"
                        : classId
                          ? "Tato třída nemá v rozvrhu žádný předmět"
                          : "Vyber předmět z učebnic / rozvrhu…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map((s) => (
                    <SelectItem key={`${s.source}-${s.label}`} value={s.label}>
                      {s.abbreviation ? `${s.abbreviation} · ${s.label}` : s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-class">Třída</Label>
              <Select
                value={classId || undefined}
                onValueChange={(v) => {
                  setClassId(v);
                  setLinkedDate("");
                  setLinkedTime("");
                }}
              >
                <SelectTrigger id="plan-class">
                  <SelectValue
                    placeholder={
                      filteredClasses.length
                        ? "Vyber třídu…"
                        : subject
                          ? "Žádná třída nemá tento předmět v rozvrhu"
                          : "Žádné třídy"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Předmět a třída se vzájemně filtrují podle rozvrhu (rozvrhové sloty).
          </p>

          {/* Učebnice + lekce */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-textbook" className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Učebnice
              </Label>
              <Select
                value={textbookId || undefined}
                onValueChange={(v) => {
                  setTextbookId(v);
                  setLessonId("");
                }}
              >
                <SelectTrigger id="plan-textbook">
                  <SelectValue
                    placeholder={loadingTextbooks ? "Načítám učebnice…" : textbooks.length ? "Vyber učebnici…" : "Žádné učebnice"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {textbooks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-lesson">Lekce z učebnice</Label>
              <Select
                value={lessonId || undefined}
                onValueChange={setLessonId}
                disabled={!textbookId}
              >
                <SelectTrigger id="plan-lesson">
                  <SelectValue
                    placeholder={
                      !textbookId
                        ? "Nejprve vyber učebnici"
                        : lessons.length
                          ? "Vyber lekci…"
                          : "V této učebnici nejsou lekce"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedLesson && (
            <p className="text-xs text-muted-foreground -mt-2">
              AI bude vycházet z obsahu lekce <strong>{selectedLesson.title}</strong>.
            </p>
          )}

          {/* Propojení s konkrétní hodinou v rozvrhu */}
          {subject && (
            <div className="space-y-4">

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-date" className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Datum hodiny
                  </Label>
                  <Select
                    value={linkedDate || undefined}
                    onValueChange={(v) => {
                      setLinkedDate(v);
                      setLinkedTime("");
                    }}
                  >
                    <SelectTrigger id="plan-date">
                      <SelectValue
                        placeholder={
                          availableDates.length
                            ? "Vyber datum…"
                            : classId
                              ? "Žádné nadcházející hodiny pro tuto třídu"
                              : "Žádné nadcházející hodiny v rozvrhu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDates.map((d) => {
                        const dateObj = new Date(d);
                        const week = getISOWeek(dateObj);
                        return (
                          <SelectItem key={d} value={d}>
                            {format(dateObj, "EEEE d. M. yyyy", { locale: cs })} (t. {week})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-time">Čas hodiny</Label>
                  <Select
                    value={linkedTime || undefined}
                    onValueChange={setLinkedTime}
                    disabled={!linkedDate}
                  >
                    <SelectTrigger id="plan-time">
                      <SelectValue
                        placeholder={linkedDate ? "Vyber čas…" : "Nejprve vyber datum"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlotsForDate.map((o) => {
                        const v = `${o.start}-${o.end}`;
                        const meta = [o.className, o.room].filter(Boolean).join(" · ");
                        return (
                          <SelectItem key={v} value={v}>
                            {o.start} – {o.end}
                            {meta ? ` · ${meta}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linked slots (multi-assignment) */}
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-medium">
                    Další přiřazené termíny ({linkedSlots.length})
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!subject || !linkedDate || !linkedTime}
                    onClick={() => {
                      const slot = filteredOccurrences.find(
                        (o) =>
                          o.date === linkedDate &&
                          `${o.start}-${o.end}` === linkedTime,
                      );
                      const newSlot = {
                        subject,
                        classId: classId || slot?.classId,
                        className: slot?.className,
                        date: linkedDate,
                        time: linkedTime,
                      };
                      setLinkedSlots((prev) => {
                        const exists = prev.some(
                          (s) =>
                            s.subject === newSlot.subject &&
                            s.date === newSlot.date &&
                            s.time === newSlot.time &&
                            s.classId === newSlot.classId,
                        );
                        if (exists) {
                          toast({ title: "Termín už je přiřazen" });
                          return prev;
                        }
                        return [...prev, newSlot];
                      });
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Přidat aktuální termín
                  </Button>
                </div>
                {linkedSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Plán lze přiřadit i k více předmětům a hodinám. Vyber termín výše
                    a klikni „Přidat aktuální termín".
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {linkedSlots.map((sl, i) => (
                      <li key={i}>
                        <Badge
                          variant="secondary"
                          className="gap-1.5 pr-1 text-xs font-normal"
                        >
                          <span>
                            {sl.subject}
                            {" · "}
                            {sl.date
                              ? format(new Date(sl.date), "d. M.", { locale: cs })
                              : ""}
                            {sl.time ? ` · ${sl.time.replace("-", "–")}` : ""}
                            {sl.className ? ` · ${sl.className}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setLinkedSlots((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            className="rounded p-0.5 hover:bg-background/60"
                            aria-label="Odebrat termín"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-desc">Krátký popis (volitelné)</Label>
            <Textarea
              id="plan-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Téma, cíl hodiny, poznámky…"
              rows={2}
            />
          </div>
          {id && id !== "novy" && (
            <p className="text-xs text-muted-foreground">
              ID plánu: <span className="font-mono">{id}</span>
            </p>
          )}
        </div>

        {/* AI asistent */}
        <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">AI asistent</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            AI navrhne časové rozvržení a aktivity pro každou fázi.
            {selectedLesson
              ? " Vychází z vybrané lekce."
              : " Vyber lekci nebo napiš vlastní pokyny."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch">
            <Textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              placeholder="Vlastní pokyny – např. „Zaměř se na skupinovou práci a krátké video v motivaci.“"
              rows={2}
              className="flex-1"
            />
            <div className="flex sm:flex-col gap-2">
              <Button
                onClick={() => generateWithAI({ fromLessonOnly: true })}
                disabled={aiLoading || !selectedLesson}
                size="sm"
                variant="outline"
                title={!selectedLesson ? "Nejprve vyber lekci" : "Rychlý návrh přímo z obsahu vybrané lekce"}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Navrhnout z lekce
              </Button>
              <Button onClick={() => generateWithAI()} disabled={aiLoading} size="sm">
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generuji…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Navrhnout plán
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* AI doporučení metod */}
          <div className="border-t border-primary/10 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Po zadání cíle hodiny vám AI doporučí 2–3 vhodné výukové metody.
              </p>
              <Button
                onClick={handleRecommendMethods}
                disabled={methodAiLoading || !methods.length}
                size="sm"
                variant="outline"
              >
                {methodAiLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4 mr-2" />
                )}
                Doporučit metody
              </Button>
            </div>
            {methodSuggestions.length > 0 && (
              <div className="grid sm:grid-cols-3 gap-2 mt-2">
                {methodSuggestions.map(({ method, reason }) => (
                  <div
                    key={method.id}
                    className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2"
                  >
                    <div>
                      <div className="font-medium text-sm">{method.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[method.category, method.difficulty, method.time_range]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-4">{reason}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-auto"
                      onClick={() => handleSelectMethod(method.id)}
                    >
                      <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                      Použít
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Metoda učení */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold">Metoda učení</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Vyberte výukovou metodu z katalogu — fáze se předvyplní podle její šablony.
          </p>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="plan-method">Metoda</Label>
              <Select
                value={selectedMethodId || undefined}
                onValueChange={handleSelectMethod}
              >
                <SelectTrigger id="plan-method">
                  <SelectValue
                    placeholder={methods.length ? "Vyber metodu…" : "Načítání metod…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.category ? ` · ${m.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMethodId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  setSelectedMethodId("");
                  if (planDbId) {
                    await supabase
                      .from("lesson_method_links")
                      .delete()
                      .eq("lesson_plan_id", planDbId);
                  }
                  toast({ title: "Metoda odebrána" });
                }}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Odebrat
              </Button>
            )}
          </div>
          {selectedMethodId && (() => {
            const m = methods.find((x) => x.id === selectedMethodId);
            if (!m) return null;
            return (
              <div className="bg-muted/30 border border-border rounded-md p-3 space-y-1.5">
                <div className="text-xs text-muted-foreground">
                  {[m.category, m.difficulty, m.time_range].filter(Boolean).join(" · ")}
                </div>
                {m.description && <p className="text-sm">{m.description}</p>}
              </div>
            );
          })()}
        </div>

        {/* Fáze hodiny */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Fáze hodiny</h2>

          {PHASES.map((phase, idx) => {
            const value = phases[phase.key];
            return (
              <div
                key={phase.key}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-brand text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base">{phase.title}</h3>
                      <p className="text-xs text-muted-foreground">{phase.hint}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Label
                      htmlFor={`time-${phase.key}`}
                      className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                      Čas (min)
                    </Label>
                    <Input
                      id={`time-${phase.key}`}
                      type="number"
                      min={0}
                      max={180}
                      value={value.timeMin}
                      onChange={(e) =>
                        updatePhase(phase.key, { timeMin: e.target.value })
                      }
                      placeholder="0"
                      className="w-20 h-9"
                    />
                  </div>
                </div>

                <Textarea
                  value={value.description}
                  onChange={(e) =>
                    updatePhase(phase.key, { description: e.target.value })
                  }
                  placeholder="Popiš aktivity v této fázi…"
                  rows={3}
                />

                {value.activities && value.activities.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Navržené ZEdu aktivity
                    </p>
                    <ul className="space-y-1.5">
                      {value.activities.map((act, i) => {
                        const meta = ACTIVITY_META[act.kind];
                        const isLessonBlock =
                          act.kind === "lesson_block" || act.kind === "offline_activity";
                        const href = isLessonBlock
                          ? selectedLesson?.textbookId
                            ? `/ucitel/ucebnice/${selectedLesson.textbookId}/lekce?lesson=${selectedLesson.id}`
                            : null
                          : meta?.href ?? null;
                        return (
                          <li
                            key={i}
                            className="flex items-start justify-between gap-3 text-sm bg-muted/30 border border-border rounded-md px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{act.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {meta?.label ?? act.kind}
                              </div>
                            </div>
                            {href && meta?.hrefLabel && (
                              <a
                                href={href}
                                className="text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
                              >
                                {meta.hrefLabel} →
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Shrnutí – časový harmonogram */}
        <div className="mt-8 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Časový harmonogram
            </h2>
            <span className="text-sm text-muted-foreground">
              Celkem {totalMin} min
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fáze</th>
                  <th className="px-3 py-2 font-medium w-24">Minut</th>
                  <th className="px-3 py-2 font-medium w-32">Podíl</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => {
                  const pct = totalMin > 0 ? Math.round((row.timeMin / totalMin) * 100) : 0;
                  return (
                    <tr key={row.title} className="border-t border-border">
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2 tabular-nums">{row.timeMin} min</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Tento harmonogram (jen fáze + časy) se po uložení zobrazí v detailu hodiny v rozvrhu i v kalendáři.
          </p>
        </div>
      </main>

      {/* Save as template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uložit jako šablonu</DialogTitle>
            <DialogDescription>
              Uloží se pouze struktura fází (názvy, časy, obecné popisy) — bez konkrétního obsahu lekce a aktivit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-title">Název šablony *</Label>
              <Input
                id="tpl-title"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="Např. Standardní 45min hodina"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Popis (volitelný)</Label>
              <Textarea
                id="tpl-desc"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Kdy tuto šablonu používat…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)} disabled={templateSaving}>
              Zrušit
            </Button>
            <Button onClick={handleSaveAsTemplate} disabled={templateSaving}>
              {templateSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Uložit šablonu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load from template dialog */}
      <Dialog open={loadTemplateOpen} onOpenChange={setLoadTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vyberte šablonu</DialogTitle>
            <DialogDescription>
              Po výběru se předvyplní fáze hodiny. Stávající obsah fází bude přepsán.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-2 py-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Zatím nemáte žádné šablony.
              </p>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="w-full text-left border border-border rounded-lg p-3 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <div className="font-medium text-sm">{tpl.title}</div>
                  {tpl.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {tpl.description}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground/70 mt-1">
                    {Array.isArray(tpl.phases_json) ? tpl.phases_json.length : 0} fází
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sdílení plánu</DialogTitle>
            <DialogDescription>
              Vyberte, kdo může váš plán hodiny vidět v katalogu sdílených plánů.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RadioGroup
              value={sharedVisibility}
              onValueChange={(v) => setSharedVisibility(v as any)}
              className="space-y-2"
            >
              <label
                htmlFor="vis-private"
                className="flex items-start gap-3 border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40"
              >
                <RadioGroupItem id="vis-private" value="private" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Lock className="w-4 h-4" /> Soukromý
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Plán vidíte jen vy.
                  </p>
                </div>
              </label>
              <label
                htmlFor="vis-school"
                className="flex items-start gap-3 border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40"
              >
                <RadioGroupItem id="vis-school" value="school" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <School className="w-4 h-4" /> Pouze moje škola
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vidí ho učitelé z vaší školy.
                  </p>
                </div>
              </label>
              <label
                htmlFor="vis-public"
                className="flex items-start gap-3 border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40"
              >
                <RadioGroupItem id="vis-public" value="public" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="w-4 h-4" /> Veřejný
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vidí ho všichni učitelé v katalogu.
                  </p>
                </div>
              </label>
            </RadioGroup>

            <div className="flex items-center justify-between border border-border rounded-lg p-3">
              <div>
                <Label htmlFor="anon-toggle" className="text-sm font-medium">
                  Anonymní sdílení
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  V katalogu se nezobrazí vaše jméno.
                </p>
              </div>
              <Switch
                id="anon-toggle"
                checked={anonymous}
                onCheckedChange={setAnonymous}
                disabled={sharedVisibility === "private"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)} disabled={sharingSaving}>
              Zrušit
            </Button>
            <Button onClick={handleSaveSharing} disabled={sharingSaving}>
              {sharingSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
