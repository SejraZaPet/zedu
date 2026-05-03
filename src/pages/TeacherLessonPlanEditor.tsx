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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
  const { user } = useAuth();
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
      if (input.phases) setPhases({ ...emptyPhases(), ...input.phases });
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
  useEffect(() => {
    if (!user) return;
    supabase
      .from("teacher_textbooks")
      .select("id, title, subject")
      .eq("teacher_id", user.id)
      .order("title", { ascending: true })
      .then(({ data }) => setTextbooks((data as any[]) ?? []));
  }, [user]);

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
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: ct } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("user_id", user.id);
      const ids = (ct ?? []).map((r: any) => r.class_id);
      if (!ids.length) {
        setTeacherClasses([]);
        return;
      }
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name")
        .in("id", ids)
        .eq("archived", false)
        .order("name");
      setTeacherClasses((cls as any[]) ?? []);
    })();
  }, [user]);

  const [classId, setClassId] = useState<string>("");

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

  async function handleSave() {
    if (!user) {
      toast({ title: "Nepřihlášen", description: "Přihlaš se pro uložení plánu.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Persist a clean schedule to local store for calendar
      if (subject && linkedDate && linkedTime) {
        const [start, end] = linkedTime.split("-");
        savePhasePlan({
          subject,
          date: linkedDate,
          start,
          end,
          title,
          phases: PHASES.map((p) => ({
            key: p.key,
            title: p.title,
            timeMin: parseInt(phases[p.key].timeMin, 10) || 0,
          })),
          updatedAt: new Date().toISOString(),
        });
      }

      const payload = {
        teacher_id: user.id,
        title,
        subject: subject || "",
        grade_band: "",
        slides: [],
        input_data: {
          description,
          subject,
          linkedDate,
          linkedTime,
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
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
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
                <SelectValue placeholder="Vyber předmět z učebnic / rozvrhu…" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={`${s.source}-${s.label}`} value={s.label}>
                    {s.abbreviation ? `${s.abbreviation} · ${s.label}` : s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    placeholder={textbooks.length ? "Vyber učebnici…" : "Žádné učebnice"}
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
                        teacherClasses.length ? "Vyber třídu…" : "Žádné třídy"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Termíny se filtrují podle rozvrhu této třídy pro vybraný předmět.
                </p>
              </div>

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

      <SiteFooter />
    </div>
  );
}
