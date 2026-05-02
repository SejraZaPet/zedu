import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
  Coffee,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Check,
  Clock,
  Settings2,
  ChevronDown,
  Users,
  BookOpen,
  ExternalLink,
  X,
  ShieldCheck,
  Utensils,
  CircleSlash,
  MapPin,
  StickyNote,
} from "lucide-react";
import {
  DEFAULT_PERIOD_TIMES,
  loadSchedule,
  saveSchedule,
  buildSubjectStyleMap,
  colorForSubject,
  SUBJECT_COLORS,
  BREAK_KIND_META,
  type LessonEntry,
  type RowBreak,
  type BreakKind,
  type TeacherScheduleData,
  type WeekParityMode,
} from "@/lib/teacher-schedule-store";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const DAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá"];

const newId = () => Math.random().toString(36).slice(2, 10);

type ParityTab = "both" | "odd" | "even";

interface ClassSlot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  subject_label: string | null;
  room: string | null;
  textbook_id: string | null;
  classes?: { name: string } | null;
}

/** Unified card-row item shown in the day column. */
type ScheduleCard =
  | {
      kind: "personal";
      sortStart: string; // "HH:MM" for sorting
      lesson: LessonEntry;
      time: { start: string; end: string } | null;
    }
  | {
      kind: "class";
      sortStart: string;
      slot: ClassSlot;
    }
  | {
      kind: "break";
      sortStart: string;
      brk: RowBreak;
    };

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${parseInt(h, 10)}:${m}`;
};

/** Subtract 1 minute from "HH:MM" (used for sorting breaks before first period). */
const prevTimeStr = (t: string): string => {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10) || 0);
  const total = h * 60 + m - 1;
  if (total < 0) return "00:00";
  const hh = Math.floor(total / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

export default function TeacherSchedule() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<TeacherScheduleData>(() => loadSchedule());
  const [activeTab, setActiveTab] = useState<ParityTab>(data.parityMode === "both" ? "both" : "odd");
  const [classSlots, setClassSlots] = useState<ClassSlot[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist personal schedule
  useEffect(() => {
    saveSchedule(data);
  }, [data]);

  // Load class slots (read-only synced from Třídy)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: ct } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("user_id", user.id);
      const classIds = (ct ?? []).map((r: any) => r.class_id);
      if (classIds.length === 0) {
        if (!cancelled) setClassSlots([]);
        return;
      }
      const { data: slots } = await supabase
        .from("class_schedule_slots" as any)
        .select("*, classes(name)")
        .in("class_id", classIds)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (!cancelled) setClassSlots((slots as any) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [editing, setEditing] = useState<LessonEntry | null>(null);
  const [isNew, setIsNew] = useState(false);

  const subjectStyles = useMemo(() => buildSubjectStyleMap(data), [data]);
  const { subjects: availableSubjects } = useTeacherSubjects();

  const subjectSuggestions = useMemo(() => {
    const map = new Map<string, { label: string; abbreviation?: string; color?: string }>();
    for (const [label, style] of subjectStyles.entries()) {
      map.set(label.toLowerCase(), { label, abbreviation: style.abbreviation, color: style.color });
    }
    for (const s of availableSubjects) {
      const k = s.label.toLowerCase();
      if (!map.has(k)) {
        map.set(k, { label: s.label, abbreviation: s.abbreviation, color: s.color });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "cs"));
  }, [subjectStyles, availableSubjects]);

  // Periods passed into the unified lesson dialog
  const dialogPeriods = useMemo(
    () =>
      data.periods
        .map((p) => {
          const t = data.periodTimes[p];
          return t ? { period: p, start: t.start, end: t.end } : null;
        })
        .filter((x): x is { period: number; start: string; end: string } => x !== null),
    [data.periods, data.periodTimes],
  );

  // Active list of personal lessons given current parity tab
  const currentLessons = useMemo(() => {
    if (data.parityMode === "both") return data.lessonsBoth;
    return activeTab === "odd" ? data.lessonsOdd : data.lessonsEven;
  }, [data, activeTab]);

  // Filter class slots by parity
  const visibleClassSlots = useMemo(() => {
    if (data.parityMode === "both") {
      // show all
      return classSlots;
    }
    return classSlots.filter((s) => s.week_parity === "every" || s.week_parity === activeTab);
  }, [classSlots, data.parityMode, activeTab]);

  // Build per-day merged cards sorted by start time
  const cardsByDay = useMemo(() => {
    const map = new Map<number, ScheduleCard[]>();
    for (let d = 0; d < 5; d++) map.set(d, []);

    for (const l of currentLessons) {
      const t = data.periodTimes[l.period] || null;
      map.get(l.day)!.push({
        kind: "personal",
        sortStart: t?.start ?? "99:99",
        lesson: l,
        time: t,
      });
    }
    for (const s of visibleClassSlots) {
      const dayIdx = s.day_of_week - 1; // 1=Mon → 0
      if (dayIdx < 0 || dayIdx > 4) continue;
      map.get(dayIdx)!.push({
        kind: "class",
        sortStart: s.start_time,
        slot: s,
      });
    }
    // Insert breaks at correct position. afterPeriod=0 → before first period.
    for (const br of data.breaks) {
      const days =
        br.days && br.days.length > 0 ? br.days : [0, 1, 2, 3, 4];
      // Compute sortStart: use end of `afterPeriod` (or "00:00" for 0)
      let sortStart = "00:00";
      if (br.afterPeriod === 0) {
        // Place just before first period start (use first defined period start minus epsilon)
        const firstP = data.periods[0];
        const t = firstP ? data.periodTimes[firstP] : null;
        sortStart = t ? prevTimeStr(t.start) : "00:00";
      } else {
        const t = data.periodTimes[br.afterPeriod];
        sortStart = t?.end ?? "99:00";
      }
      for (const d of days) {
        if (d < 0 || d > 4) continue;
        map.get(d)!.push({ kind: "break", sortStart, brk: br });
      }
    }
    for (const d of map.keys()) {
      map.get(d)!.sort((a, b) => a.sortStart.localeCompare(b.sortStart));
    }
    return map;
  }, [currentLessons, visibleClassSlots, data.periodTimes, data.breaks, data.periods]);

  function openNewLesson(day: number) {
    // pick first free period for default
    const used = new Set(currentLessons.filter((l) => l.day === day).map((l) => l.period));
    const period = data.periods.find((p) => !used.has(p)) ?? data.periods[0] ?? 1;
    setEditing({
      id: newId(),
      day,
      period,
      subject: "",
      abbreviation: "",
      color: SUBJECT_COLORS[0].value,
      className: "",
      room: "",
    });
    setIsNew(true);
  }
  function openEditLesson(entry: LessonEntry) {
    setEditing({ ...entry });
    setIsNew(false);
  }

  function applyLessonResult(slots: { day: number; period: number }[], base: LessonEntry) {
    const buildEntries = (): LessonEntry[] =>
      slots.map((s, i) => ({
        ...base,
        id: i === 0 ? base.id : newId(),
        day: s.day,
        period: s.period,
      }));

    setData((dState) => {
      const newEntries = buildEntries();
      if (dState.parityMode === "both") {
        const cleaned = dState.lessonsBoth.filter(
          (x) => x.id !== base.id && !newEntries.some((n) => n.day === x.day && n.period === x.period),
        );
        return { ...dState, lessonsBoth: [...cleaned, ...newEntries] };
      }

      const otherSide: "odd" | "even" = activeTab === "odd" ? "even" : "odd";
      const thisListKey = activeTab === "odd" ? "lessonsOdd" : "lessonsEven";
      const otherListKey = otherSide === "odd" ? "lessonsOdd" : "lessonsEven";

      if (base.mirrorBoth) {
        const mirrorKey = base.mirrorKey ?? newId();
        const thisEntries = newEntries.map((n) => ({ ...n, mirrorBoth: true, mirrorKey }));
        const twins = thisEntries.map((n) => ({ ...n, id: newId() }));
        const cleanedThis = dState[thisListKey].filter(
          (x) => x.id !== base.id && !thisEntries.some((n) => n.day === x.day && n.period === x.period),
        );
        const cleanedOther = dState[otherListKey].filter(
          (x) => x.mirrorKey !== mirrorKey && !twins.some((n) => n.day === x.day && n.period === x.period),
        );
        return {
          ...dState,
          [thisListKey]: [...cleanedThis, ...thisEntries],
          [otherListKey]: [...cleanedOther, ...twins],
        } as TeacherScheduleData;
      }

      const cleanedOther = base.mirrorKey
        ? dState[otherListKey].filter((x) => x.mirrorKey !== base.mirrorKey)
        : dState[otherListKey];
      const cleanedThisEntries = newEntries.map((n) => ({ ...n, mirrorBoth: false, mirrorKey: undefined }));
      const cleanedThis = dState[thisListKey].filter(
        (x) => x.id !== base.id && !cleanedThisEntries.some((n) => n.day === x.day && n.period === x.period),
      );
      return {
        ...dState,
        [thisListKey]: [...cleanedThis, ...cleanedThisEntries],
        [otherListKey]: cleanedOther,
      } as TeacherScheduleData;
    });
  }

  function deleteLesson() {
    if (!editing) return;
    const e = editing;
    setData((d) => {
      if (d.parityMode === "both") {
        return { ...d, lessonsBoth: d.lessonsBoth.filter((x) => x.id !== e.id) };
      }
      return {
        ...d,
        lessonsOdd: d.lessonsOdd.filter((x) => x.id !== e.id && (!e.mirrorKey || x.mirrorKey !== e.mirrorKey)),
        lessonsEven: d.lessonsEven.filter((x) => x.id !== e.id && (!e.mirrorKey || x.mirrorKey !== e.mirrorKey)),
      };
    });
    toast({ title: "Smazáno" });
    setEditing(null);
  }

  function setParityMode(mode: WeekParityMode) {
    setData((d) => ({ ...d, parityMode: mode }));
    setActiveTab(mode === "both" ? "both" : "odd");
  }

  // ───────── period & break management (now in collapsible settings) ─────────
  function updatePeriodTime(period: number, field: "start" | "end", value: string) {
    setData((d) => ({
      ...d,
      periodTimes: { ...d.periodTimes, [period]: { ...d.periodTimes[period], [field]: value } },
    }));
  }
  function addPeriod() {
    setData((d) => {
      const last = d.periods[d.periods.length - 1] ?? 0;
      const next = last + 1;
      const lastTime = d.periodTimes[last] ?? { start: "08:00", end: "08:45" };
      return {
        ...d,
        periods: [...d.periods, next],
        periodTimes: {
          ...d.periodTimes,
          [next]: DEFAULT_PERIOD_TIMES[next] ?? { start: lastTime.end, end: lastTime.end },
        },
      };
    });
  }
  function removePeriod(period: number) {
    setData((d) => ({
      ...d,
      periods: d.periods.filter((p) => p !== period),
      lessonsBoth: d.lessonsBoth.filter((l) => l.period !== period),
      lessonsOdd: d.lessonsOdd.filter((l) => l.period !== period),
      lessonsEven: d.lessonsEven.filter((l) => l.period !== period),
      breaks: d.breaks.filter((b) => b.afterPeriod !== period),
    }));
  }
  function addBreakAfter(afterPeriod: number, kind: BreakKind = "break") {
    setData((d) => ({
      ...d,
      breaks: [
        ...d.breaks,
        {
          id: newId(),
          afterPeriod,
          durationMin: kind === "lunch" ? 30 : 10,
          notes: {},
          kind,
          note: "",
          location: "",
          days: [],
        },
      ].sort((a, b) => a.afterPeriod - b.afterPeriod),
    }));
  }
  function updateBreakById(id: string, patch: Partial<RowBreak>) {
    setData((d) => ({
      ...d,
      breaks: d.breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }
  function removeBreakById(id: string) {
    setData((d) => ({ ...d, breaks: d.breaks.filter((b) => b.id !== id) }));
  }
  /** Ensure all existing breaks have an `id` for stable updates. */
  useEffect(() => {
    setData((d) => {
      let changed = false;
      const next = d.breaks.map((b) => {
        if (!b.id) {
          changed = true;
          return { ...b, id: newId() };
        }
        return b;
      });
      return changed ? { ...d, breaks: next } : d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stats badges
  const totalPersonal = currentLessons.length;
  const totalClass = visibleClassSlots.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-[1400px]">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Můj rozvrh</h1>
              <p className="text-sm text-muted-foreground">
                Vlastní hodiny i hodiny ze tříd na jednom místě. Klikni na hodinu pro úpravu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setParityMode("both")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                data.parityMode === "both"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Oba týdny stejné
            </button>
            <button
              onClick={() => setParityMode("odd")}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                data.parityMode !== "both"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Lichý / sudý zvlášť
            </button>
          </div>
        </div>

        {/* Sub-tabs for odd/even when parity mode is not "both" */}
        {data.parityMode !== "both" && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setActiveTab("odd")}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                activeTab === "odd"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              Lichý týden
            </button>
            <button
              onClick={() => setActiveTab("even")}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                activeTab === "even"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              Sudý týden
            </button>
            <p className="text-xs text-muted-foreground ml-2">
              Lichý a sudý týden jsou zcela nezávislé.
            </p>
          </div>
        )}

        {/* ───────── Unified card schedule ───────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="font-medium text-sm">Týdenní rozvrh</h2>
              <Badge variant="secondary" className="text-[10px]">
                {totalPersonal} vlastních
              </Badge>
              {totalClass > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Users className="w-2.5 h-2.5" /> {totalClass} ze tříd
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate("/ucitel/tridy")}
            >
              Spravovat třídy <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
            {[0, 1, 2, 3, 4].map((dayIdx) => {
              const items = cardsByDay.get(dayIdx) ?? [];
              return (
                <div key={dayIdx} className="p-3 min-h-[180px] flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <span className="md:hidden">{DAYS[dayIdx]}</span>
                      <span className="hidden md:inline">{DAYS_SHORT[dayIdx]}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {items.length}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {items.length === 0 && (
                      <div className="text-xs text-muted-foreground/60 italic py-2">Volno</div>
                    )}
                    {items.map((card, i) => {
                      if (card.kind === "personal") {
                        return (
                          <PersonalCard
                            key={`p-${card.lesson.id}`}
                            lesson={card.lesson}
                            time={card.time}
                            subjectStyles={subjectStyles}
                            parityMode={data.parityMode}
                            onClick={() => openEditLesson(card.lesson)}
                          />
                        );
                      }
                      if (card.kind === "class") {
                        return (
                          <ClassCard
                            key={`c-${card.slot.id}`}
                            slot={card.slot}
                            onClick={() => navigate("/ucitel/tridy")}
                          />
                        );
                      }
                      return (
                        <BreakCard
                          key={`b-${card.brk.id ?? card.brk.afterPeriod}-${i}`}
                          brk={card.brk}
                          periodTimes={data.periodTimes}
                        />
                      );
                    })}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 border border-dashed border-border"
                    onClick={() => openNewLesson(dayIdx)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Přidat hodinu
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          <span className="inline-flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Klikni na vlastní hodinu pro úpravu nebo smazání.
          </span>{" "}
          <span className="inline-flex items-center gap-1 ml-2">
            <Users className="w-3 h-3" /> Hodiny ze tříd uprav v sekci{" "}
            <button className="underline" onClick={() => navigate("/ucitel/tridy")}>
              Třídy
            </button>
            .
          </span>
        </p>

        {/* ───────── Settings: časy hodin + přestávky ───────── */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="mt-6">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Nastavení časů hodin a přestávek
              <ChevronDown
                className={`w-4 h-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-4">
            {/* Periods */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Časy hodin</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Definuj čas začátku a konce každé hodiny. Tyto časy se používají i v plánování hodin
                u tříd.
              </p>
              <div className="space-y-1.5">
                {data.periods.map((p) => {
                  const t = data.periodTimes[p];
                  return (
                    <div key={p} className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm w-16 shrink-0">{p}. hod</span>
                      <Input
                        type="time"
                        value={t?.start ?? ""}
                        onChange={(e) => updatePeriodTime(p, "start", e.target.value)}
                        className="h-8 w-28 text-xs font-mono"
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input
                        type="time"
                        value={t?.end ?? ""}
                        onChange={(e) => updatePeriodTime(p, "end", e.target.value)}
                        className="h-8 w-28 text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePeriod(p)}
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                        title="Odebrat hodinu"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
                <Button size="sm" variant="outline" onClick={addPeriod} className="mt-2">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Přidat hodinu
                </Button>
              </div>
            </div>

            {/* Breaks & blocks */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coffee className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Přestávky a další bloky</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Můžeš přidat přestávku, poradu, dozor, oběd nebo volno – buď pro všechny dny, nebo
                jen pro vybrané. Bloky lze vložit i před první hodinu (nultá hodina).
              </p>

              <div className="space-y-2">
                {data.breaks.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Zatím žádné přestávky ani bloky.
                  </p>
                )}
                {data.breaks
                  .slice()
                  .sort((a, b) => a.afterPeriod - b.afterPeriod)
                  .map((br) => (
                    <BreakSettingRow
                      key={br.id}
                      brk={br}
                      periods={data.periods}
                      onChange={(patch) => updateBreakById(br.id!, patch)}
                      onRemove={() => removeBreakById(br.id!)}
                    />
                  ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addBreakAfter(0, "break")}
                  title="Vlož blok před první hodinu"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Před 1. hodinu (nultá)
                </Button>
                {data.periods.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addBreakAfter(data.periods[Math.floor(data.periods.length / 2) - 1] ?? data.periods[0], "break")
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Přidat blok
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </main>

      <SiteFooter />

      {/* Lesson edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  {isNew ? "Nová hodina" : "Upravit hodinu"}
                </DialogTitle>
                <DialogDescription>
                  {isNew ? `${editing.period}. hodina` : `${DAYS[editing.day]} · ${editing.period}. hodina`}
                  {data.periodTimes[editing.period] &&
                    ` (${data.periodTimes[editing.period].start}–${data.periodTimes[editing.period].end})`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {/* Multi-day picker (new only) */}
                {isNew && (
                  <div className="space-y-1.5">
                    <Label>Dny v týdnu *</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d, i) => {
                        const active = editingDays.includes(i);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              setEditingDays((prev) =>
                                prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
                              )
                            }
                            className={`px-3 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card border-border hover:bg-muted"
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Hodina se vytvoří ve všech vybraných dnech.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="period">Číslo hodiny *</Label>
                  <select
                    id="period"
                    value={editing.period}
                    onChange={(e) => setEditing({ ...editing, period: parseInt(e.target.value, 10) })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {data.periods.map((p) => {
                      const t = data.periodTimes[p];
                      return (
                        <option key={p} value={p}>
                          {p}. hod{t ? ` (${t.start}–${t.end})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject">Předmět *</Label>
                  <Input
                    id="subject"
                    value={editing.subject}
                    onChange={(e) => {
                      const v = e.target.value;
                      const match = subjectSuggestions.find(
                        (s) => s.label.toLowerCase() === v.trim().toLowerCase(),
                      );
                      const existing = subjectStyles.get(v.trim());
                      setEditing({
                        ...editing,
                        subject: v,
                        color: existing?.color ?? match?.color ?? editing.color ?? colorForSubject(v),
                        abbreviation: existing?.abbreviation ?? match?.abbreviation ?? editing.abbreviation,
                      });
                    }}
                    placeholder="Např. Matematika"
                    list="schedule-subjects"
                  />
                  <datalist id="schedule-subjects">
                    {subjectSuggestions.map((s) => (
                      <option key={s.label} value={s.label}>
                        {s.abbreviation ? `${s.abbreviation} · ${s.label}` : s.label}
                      </option>
                    ))}
                  </datalist>
                  <p className="text-[11px] text-muted-foreground">
                    Návrhy zahrnují vaše učebnice i standardní předměty.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="abbr">Zkratka</Label>
                    <Input
                      id="abbr"
                      value={editing.abbreviation ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, abbreviation: e.target.value.toUpperCase().slice(0, 5) })
                      }
                      placeholder="MAT"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="class">Třída</Label>
                    <Input
                      id="class"
                      value={editing.className}
                      onChange={(e) => setEditing({ ...editing, className: e.target.value })}
                      placeholder="Např. 6. A"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="room">Místnost</Label>
                  <Input
                    id="room"
                    value={editing.room}
                    onChange={(e) => setEditing({ ...editing, room: e.target.value })}
                    placeholder="Např. 204"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Barva</Label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_COLORS.map((c) => {
                      const active = editing.color === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setEditing({ ...editing, color: c.value })}
                          className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                            active ? "border-foreground scale-110" : "border-border hover:scale-105"
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                          aria-label={c.label}
                        >
                          {active && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                    <input
                      type="color"
                      value={editing.color || "#6EC6D9"}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="w-8 h-8 rounded-full border border-border cursor-pointer p-0 bg-transparent"
                      title="Vlastní barva"
                      aria-label="Vlastní barva"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Stejný předmět má v rozvrhu i kalendáři stejnou barvu.
                  </p>
                </div>

                {data.parityMode !== "both" && (
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
                    <div className="space-y-0.5 pr-3">
                      <div className="text-sm font-medium">Propsat do obou týdnů</div>
                      <div className="text-xs text-muted-foreground">
                        Tato hodina se zobrazí v lichém i sudém týdnu zároveň.
                      </div>
                    </div>
                    <Switch
                      checked={!!editing.mirrorBoth}
                      onCheckedChange={(v) => setEditing({ ...editing, mirrorBoth: v })}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
                {!isNew ? (
                  <Button variant="outline" onClick={deleteLesson} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Smazat
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Zrušit
                  </Button>
                  <Button onClick={saveLesson}>Uložit</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── Card components ───────── */

function PersonalCard({
  lesson,
  time,
  subjectStyles,
  parityMode,
  onClick,
}: {
  lesson: LessonEntry;
  time: { start: string; end: string } | null;
  subjectStyles: Map<string, { color: string; abbreviation: string }>;
  parityMode: WeekParityMode;
  onClick: () => void;
}) {
  const style = subjectStyles.get(lesson.subject.trim());
  const color = lesson.color || style?.color || colorForSubject(lesson.subject);
  const abbr =
    lesson.abbreviation || style?.abbreviation || lesson.subject.slice(0, 3).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md p-2 transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 group"
      style={{ backgroundColor: `${color}26`, borderLeftColor: color }}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        <Clock className="w-3 h-3" />
        {time ? `${fmtTime(time.start)}–${fmtTime(time.end)}` : `${lesson.period}. hod`}
        <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span
          className="inline-flex items-center justify-center text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: color }}
        >
          {abbr}
        </span>
        <div className="font-semibold text-sm leading-tight truncate">{lesson.subject}</div>
      </div>
      {lesson.className && (
        <div className="text-xs text-muted-foreground truncate mt-0.5">{lesson.className}</div>
      )}
      {lesson.room && (
        <div className="text-[11px] text-muted-foreground truncate">📍 {lesson.room}</div>
      )}
      {lesson.mirrorBoth && parityMode !== "both" && (
        <div className="text-[10px] text-muted-foreground">↔ oba týdny</div>
      )}
    </button>
  );
}

function ClassCard({ slot, onClick }: { slot: ClassSlot; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md p-2 transition-all hover:shadow-md hover:-translate-y-0.5 border border-dashed border-border bg-background/60 group"
      title="Hodina ze třídy – uprav v sekci Třídy"
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        <Clock className="w-3 h-3" />
        {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
        {slot.week_parity !== "every" && (
          <span className="ml-1 text-[10px]">({slot.week_parity === "odd" ? "lichý" : "sudý"})</span>
        )}
        <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
      <div className="font-semibold text-sm leading-tight truncate mt-0.5">
        {slot.subject_label || "Hodina"}
      </div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
        <Users className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{slot.classes?.name}</span>
        {slot.room && <span className="shrink-0">· {slot.room}</span>}
      </div>
      {slot.textbook_id && (
        <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
          <BookOpen className="w-2.5 h-2.5" />
          <span className="truncate">propojeno s učebnicí</span>
        </div>
      )}
    </button>
  );
}

/* ───────── Break / block components ───────── */

function getBreakIcon(kind: BreakKind | undefined) {
  switch (kind) {
    case "meeting":
      return Users;
    case "duty":
      return ShieldCheck;
    case "lunch":
      return Utensils;
    case "free":
      return CircleSlash;
    case "break":
    default:
      return Coffee;
  }
}

function BreakCard({
  brk,
  periodTimes,
}: {
  brk: RowBreak;
  periodTimes: Record<number, { start: string; end: string }>;
}) {
  const kind: BreakKind = brk.kind ?? "break";
  const meta = BREAK_KIND_META[kind];
  const Icon = getBreakIcon(kind);
  let timeLabel = "";
  if (brk.afterPeriod === 0) {
    timeLabel = "před 1. hod";
  } else {
    const t = periodTimes[brk.afterPeriod];
    if (t) {
      const [h, m] = t.end.split(":").map((x) => parseInt(x, 10) || 0);
      const startTotal = h * 60 + m;
      const endTotal = startTotal + (brk.durationMin || 0);
      const fmt = (total: number) =>
        `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
      timeLabel = `${fmt(startTotal)}–${fmt(endTotal)}`;
    }
  }
  const title =
    kind === "meeting"
      ? brk.note?.trim() || "Porada"
      : kind === "duty"
        ? "Dozor"
        : meta.label;

  return (
    <div
      className="w-full rounded-md p-2 border border-dashed"
      style={{
        backgroundColor: `${meta.color}1A`,
        borderColor: `${meta.color}66`,
      }}
      title={meta.label}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        <Clock className="w-3 h-3" />
        {timeLabel}
        <span className="ml-auto text-[10px]">· {brk.durationMin} min</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded shrink-0"
          style={{ backgroundColor: meta.color }}
        >
          <Icon className="w-3 h-3 text-white" />
        </span>
        <div className="font-medium text-xs leading-tight truncate">{title}</div>
      </div>
      {kind === "duty" && brk.location && (
        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
          <MapPin className="w-2.5 h-2.5 shrink-0" /> {brk.location}
        </div>
      )}
      {kind !== "meeting" && brk.note && (
        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
          <StickyNote className="w-2.5 h-2.5 shrink-0" /> {brk.note}
        </div>
      )}
    </div>
  );
}

function BreakSettingRow({
  brk,
  periods,
  onChange,
  onRemove,
}: {
  brk: RowBreak;
  periods: number[];
  onChange: (patch: Partial<RowBreak>) => void;
  onRemove: () => void;
}) {
  const kind: BreakKind = brk.kind ?? "break";
  const meta = BREAK_KIND_META[kind];
  const Icon = getBreakIcon(kind);
  const days = brk.days ?? [];
  const allDays = days.length === 0;

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    onChange({ days: next });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded shrink-0"
          style={{ backgroundColor: meta.color }}
          title={meta.label}
        >
          <Icon className="w-3.5 h-3.5 text-white" />
        </span>

        <Label className="text-xs text-muted-foreground">Po hodině:</Label>
        <select
          value={brk.afterPeriod}
          onChange={(e) => onChange({ afterPeriod: parseInt(e.target.value, 10) })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value={0}>před 1. hod (nultá)</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              po {p}. hod
            </option>
          ))}
        </select>

        <Label className="text-xs text-muted-foreground ml-2">Typ:</Label>
        <select
          value={kind}
          onChange={(e) => onChange({ kind: e.target.value as BreakKind })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {(Object.keys(BREAK_KIND_META) as BreakKind[]).map((k) => (
            <option key={k} value={k}>
              {BREAK_KIND_META[k].label}
            </option>
          ))}
        </select>

        <Label className="text-xs text-muted-foreground ml-2">Délka:</Label>
        <Input
          type="number"
          min={1}
          max={240}
          value={brk.durationMin}
          onChange={(e) => onChange({ durationMin: parseInt(e.target.value, 10) || 0 })}
          className="h-8 w-16 text-xs"
        />
        <span className="text-xs text-muted-foreground">min</span>

        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="h-8 px-2 ml-auto text-muted-foreground hover:text-destructive"
          title="Odstranit"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground">Dny:</Label>
        <button
          type="button"
          onClick={() => onChange({ days: [] })}
          className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
            allDays
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border hover:bg-muted"
          }`}
        >
          Všechny dny
        </button>
        {DAYS.map((d, i) => {
          const active = !allDays && days.includes(i);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(i)}
              className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              {DAYS_SHORT[i]}
            </button>
          );
        })}
      </div>

      {kind === "meeting" && (
        <div className="space-y-1">
          <Label className="text-xs">Téma porady</Label>
          <Input
            value={brk.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Např. Pedagogická rada – výsledky 1. pololetí"
            className="h-8 text-xs"
          />
        </div>
      )}
      {kind === "duty" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Místo dozoru</Label>
            <Input
              value={brk.location ?? ""}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="Např. chodba 2. NP"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Poznámka</Label>
            <Input
              value={brk.note ?? ""}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Volitelné"
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
      {(kind === "break" || kind === "lunch" || kind === "free") && (
        <div className="space-y-1">
          <Label className="text-xs">Poznámka (volitelné)</Label>
          <Input
            value={brk.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Např. Velká přestávka"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
