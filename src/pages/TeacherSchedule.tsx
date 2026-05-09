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
  AlertTriangle,
  Printer,
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
import LessonFormDialog from "@/components/schedule/LessonFormDialog";

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
  abbreviation: string | null;
  color: string | null;
  room: string | null;
  textbook_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
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
  const [teacherName, setTeacherName] = useState<string>("");

  useEffect(() => {
    if (!user) {
      setTeacherName("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,email")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const n = `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim();
      setTeacherName(n || data?.email || user.email || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist personal schedule
  useEffect(() => {
    saveSchedule(data);
  }, [data]);

  // Load class slots (synced from Třídy – also editable in place)
  const fetchClassSlots = async () => {
    if (!user) {
      setClassSlots([]);
      return;
    }
    const { data: ct } = await supabase
      .from("class_teachers")
      .select("class_id")
      .eq("user_id", user.id);
    const classIds = (ct ?? []).map((r: any) => r.class_id);
    if (classIds.length === 0) {
      setClassSlots([]);
      return;
    }
    const { data: slots } = await supabase
      .from("class_schedule_slots" as any)
      .select("*, classes(name)")
      .in("class_id", classIds)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    setClassSlots((slots as any) || []);
  };

  useEffect(() => {
    fetchClassSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [editing, setEditing] = useState<LessonEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [editingClassSlot, setEditingClassSlot] = useState<ClassSlot | null>(null);

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

  /** Visible periods – capped at 8 (max 8 vyučovacích hodin). */
  const visiblePeriods = useMemo(() => data.periods.slice(0, 8), [data.periods]);

  /** Build map (day, period) → personal lesson card. */
  const personalByDayPeriod = useMemo(() => {
    const m = new Map<string, { lesson: LessonEntry; time: { start: string; end: string } | null }>();
    for (const l of currentLessons) {
      if (!visiblePeriods.includes(l.period)) continue;
      m.set(`${l.day}-${l.period}`, { lesson: l, time: data.periodTimes[l.period] || null });
    }
    return m;
  }, [currentLessons, visiblePeriods, data.periodTimes]);

  /** Convert "HH:MM[:SS]" to total minutes. */
  const toMin = (t: string): number => {
    if (!t) return -1;
    const [h, m] = t.split(":").map((x) => parseInt(x, 10) || 0);
    return h * 60 + m;
  };

  /** Build map (day, period) → class slot[]. Match by closest period (slot.start within period range,
   *  or nearest by start time). Multiple slots per cell are allowed. */
  const classByDayPeriod = useMemo(() => {
    const m = new Map<string, ClassSlot[]>();
    const periodInfo = visiblePeriods
      .map((p) => {
        const t = data.periodTimes[p];
        if (!t) return null;
        return { period: p, start: toMin(t.start), end: toMin(t.end) };
      })
      .filter((x): x is { period: number; start: number; end: number } => x !== null);

    for (const s of visibleClassSlots) {
      const dayIdx = s.day_of_week - 1;
      if (dayIdx < 0 || dayIdx > 4) continue;
      const slotStart = toMin((s.start_time || "").slice(0, 5));
      if (slotStart < 0 || periodInfo.length === 0) continue;
      // Prefer period whose [start,end) contains slot start; otherwise nearest by |start diff|.
      let chosen = periodInfo.find((p) => slotStart >= p.start && slotStart < p.end);
      if (!chosen) {
        chosen = periodInfo.reduce((best, p) =>
          Math.abs(p.start - slotStart) < Math.abs(best.start - slotStart) ? p : best,
        periodInfo[0]);
      }
      const key = `${dayIdx}-${chosen.period}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    // Sort each cell by start_time for stable display
    for (const arr of m.values()) {
      arr.sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    }
    return m;
  }, [visibleClassSlots, visiblePeriods, data.periodTimes]);

  /** Detect time conflicts within current parity view. A conflict is when the
   *  teacher has 2+ items (personal lessons or class slots) at the same
   *  (day, period) cell. Class slots are already pre-filtered by parity tab,
   *  and personal lessons come from the active list, so any duplicate cell is
   *  a real overlap. */
  const conflicts = useMemo(() => {
    const personalByCell = new Map<string, LessonEntry[]>();
    for (const l of currentLessons) {
      if (!visiblePeriods.includes(l.period)) continue;
      const k = `${l.day}-${l.period}`;
      const arr = personalByCell.get(k) ?? [];
      arr.push(l);
      personalByCell.set(k, arr);
    }
    const conflictPersonalIds = new Set<string>();
    const conflictClassIds = new Set<string>();
    const conflictCells: { day: number; period: number; total: number }[] = [];
    const allKeys = new Set<string>([
      ...personalByCell.keys(),
      ...classByDayPeriod.keys(),
    ]);
    for (const k of allKeys) {
      const ps = personalByCell.get(k) ?? [];
      const cs = classByDayPeriod.get(k) ?? [];
      const total = ps.length + cs.length;
      if (total > 1) {
        ps.forEach((p) => conflictPersonalIds.add(p.id));
        cs.forEach((c) => conflictClassIds.add(c.id));
        const [d, p] = k.split("-").map((x) => parseInt(x, 10));
        conflictCells.push({ day: d, period: p, total });
      }
    }
    return { conflictPersonalIds, conflictClassIds, conflictCells };
  }, [currentLessons, classByDayPeriod, visiblePeriods]);

  /** Breaks visible per (afterPeriod, day). */
  const breaksByAfterDay = useMemo(() => {
    const m = new Map<string, RowBreak>();
    for (const br of data.breaks) {
      const wp = br.weekParity ?? "both";
      if (data.parityMode !== "both" && wp !== "both" && wp !== activeTab) continue;
      // Only show breaks that anchor to a visible period (or 0 = before first).
      if (br.afterPeriod !== 0 && !visiblePeriods.includes(br.afterPeriod)) continue;
      const days = br.days && br.days.length > 0 ? br.days : [0, 1, 2, 3, 4];
      for (const d of days) {
        if (d < 0 || d > 4) continue;
        const key = `${br.afterPeriod}-${d}`;
        // If multiple breaks target the same slot, prefer first (rare).
        if (!m.has(key)) m.set(key, br);
      }
    }
    return m;
  }, [data.breaks, data.parityMode, activeTab, visiblePeriods]);

  /** Which afterPeriod slots have at least one break (so we render that row). */
  const breakRowAfterPeriods = useMemo(() => {
    const set = new Set<number>();
    for (const key of breaksByAfterDay.keys()) {
      const ap = parseInt(key.split("-")[0], 10);
      set.add(ap);
    }
    return set;
  }, [breaksByAfterDay]);

  /** Ordered row schema: alternating period rows + active break rows. */
  const rowSchema = useMemo(() => {
    const rows: Array<{ kind: "break"; afterPeriod: number } | { kind: "period"; period: number }> = [];
    if (breakRowAfterPeriods.has(0)) rows.push({ kind: "break", afterPeriod: 0 });
    for (const p of visiblePeriods) {
      rows.push({ kind: "period", period: p });
      if (breakRowAfterPeriods.has(p)) rows.push({ kind: "break", afterPeriod: p });
    }
    return rows;
  }, [visiblePeriods, breakRowAfterPeriods]);

  function openNewLesson(day: number, presetPeriod?: number) {
    const used = new Set(currentLessons.filter((l) => l.day === day).map((l) => l.period));
    const period =
      presetPeriod ?? (visiblePeriods.find((p) => !used.has(p)) ?? visiblePeriods[0] ?? 1);
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
      if (d.periods.length >= 8) return d;
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
        <div className="bg-card border border-border rounded-xl overflow-hidden print-area">
          {/* Print-only header */}
          <div className="print-show px-4 py-3 border-b border-border">
            <h1 className="text-xl font-bold">Rozvrh hodin</h1>
            <div className="text-sm text-muted-foreground mt-1">
              {teacherName}
              {data.parityMode !== "both" && (
                <span> · {activeTab === "odd" ? "Lichý týden" : "Sudý týden"}</span>
              )}
              {data.parityMode === "both" && <span> · Oba týdny</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30 flex-wrap print-hide">
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => window.print()}
              >
                <Printer className="w-3 h-3" /> Tisk rozvrhu
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => navigate("/ucitel/tridy")}
              >
                Spravovat třídy <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>

          {conflicts.conflictCells.length > 0 && (
            <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Pozor:</strong> máte{" "}
                {conflicts.conflictCells.reduce((s, c) => s + c.total, 0)} hodiny
                ve stejnou dobu ({conflicts.conflictCells.length}{" "}
                {conflicts.conflictCells.length === 1 ? "konflikt" : "konflikty"}).
                Konfliktní hodiny jsou označeny červeným okrajem.
              </div>
            </div>
          )}

          {/* Aligned grid: rows = period/break slots, columns = days. */}
          <div className="w-full">
            <div
              className="grid w-full"
              style={{
                gridTemplateColumns: `44px repeat(5, minmax(0, 1fr))`,
              }}
            >
              {/* Header row */}
              <div className="bg-muted/30 border-b border-border" />
              {[0, 1, 2, 3, 4].map((dayIdx) => (
                <div
                  key={`h-${dayIdx}`}
                  className="bg-muted/30 border-b border-l border-border px-1 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center"
                >
                  <span className="lg:hidden">{DAYS_SHORT[dayIdx]}</span>
                  <span className="hidden lg:inline">{DAYS[dayIdx]}</span>
                </div>
              ))}

              {/* Body rows */}
              {rowSchema.map((row, rowIdx) => {
                if (row.kind === "period") {
                  const t = data.periodTimes[row.period];
                  return (
                    <div key={`row-${rowIdx}`} className="contents">
                      <div className="border-t border-border bg-muted/10 px-2 py-2 flex flex-col items-center justify-center text-center">
                        <span className="text-sm font-semibold leading-none">{row.period}.</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">hod</span>
                        {t && (
                          <span className="text-[10px] text-muted-foreground tabular-nums mt-1">
                            {fmtTime(t.start)}
                          </span>
                        )}
                      </div>
                      {[0, 1, 2, 3, 4].map((dayIdx) => {
                        const personalsAll = currentLessons.filter(
                          (l) => l.day === dayIdx && l.period === row.period,
                        );
                        const clsListAll =
                          classByDayPeriod.get(`${dayIdx}-${row.period}`) ?? [];
                        const hasAny = personalsAll.length + clsListAll.length > 0;
                        const isConflict =
                          personalsAll.length + clsListAll.length > 1;
                        return (
                          <div
                            key={`c-${rowIdx}-${dayIdx}`}
                            className="border-t border-l border-border p-1.5 min-h-[84px] flex"
                          >
                            {hasAny ? (
                              <div className="w-full flex flex-col gap-1">
                                {personalsAll.map((lesson) => (
                                  <PersonalCard
                                    key={lesson.id}
                                    lesson={lesson}
                                    time={data.periodTimes[lesson.period] || null}
                                    subjectStyles={subjectStyles}
                                    parityMode={data.parityMode}
                                    conflict={isConflict}
                                    onClick={() => openEditLesson(lesson)}
                                  />
                                ))}
                                {clsListAll.map((cls) => (
                                  <ClassCard
                                    key={cls.id}
                                    slot={cls}
                                    conflict={isConflict}
                                    onClick={() => setEditingClassSlot(cls)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <button
                                onClick={() => openNewLesson(dayIdx, row.period)}
                                className="w-full rounded-md border border-dashed border-border/70 hover:border-primary hover:bg-primary/5 text-muted-foreground/60 hover:text-primary text-xs flex items-center justify-center gap-1 transition-colors min-h-[72px]"
                                title={`Přidat ${row.period}. hodinu`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Přidat</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                // Break row – narrow strip
                return (
                  <div key={`row-${rowIdx}`} className="contents">
                    <div className="border-t border-border bg-muted/30 px-1 py-0.5 flex items-center justify-center">
                      <Coffee className="w-2.5 h-2.5 text-muted-foreground" />
                    </div>
                    {[0, 1, 2, 3, 4].map((dayIdx) => {
                      const br = breaksByAfterDay.get(`${row.afterPeriod}-${dayIdx}`);
                      return (
                        <div
                          key={`b-${rowIdx}-${dayIdx}`}
                          className="border-t border-l border-border px-0.5 py-0.5 bg-muted/20 flex items-center"
                        >
                          {br ? (
                            <div className="w-full">
                              <BreakStrip brk={br} periodTimes={data.periodTimes} />
                            </div>
                          ) : (
                            <div className="w-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
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

      {/* Unified lesson edit dialog */}
      <LessonFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        isNew={isNew}
        initial={
          editing
            ? {
                day: editing.day,
                period: editing.period,
                subject: editing.subject,
                abbreviation: editing.abbreviation,
                color: editing.color,
                classId: editing.classId ?? null,
                className: editing.className,
                room: editing.room,
                validFrom: editing.validFrom ?? null,
                validTo: editing.validTo ?? null,
                mirrorBoth: editing.mirrorBoth,
              }
            : null
        }
        periods={dialogPeriods}
        showMirrorSwitch={data.parityMode !== "both"}
        onDelete={!isNew ? deleteLesson : undefined}
        onSave={async ({ value, slots }) => {
          if (!editing) return;
          const base: LessonEntry = {
            ...editing,
            subject: value.subject,
            abbreviation: value.abbreviation,
            color: value.color,
            classId: value.classId ?? undefined,
            className: value.className,
            room: value.room,
            validFrom: value.validFrom ?? undefined,
            validTo: value.validTo ?? undefined,
            mirrorBoth: value.mirrorBoth,
          };
          applyLessonResult(slots, base);
          toast({
            title: isNew
              ? slots.length > 1
                ? `Přidáno do ${slots.length} dnů`
                : "Přidáno do rozvrhu"
              : "Uloženo",
          });
          setEditing(null);
        }}
      />

      {/* Edit dialog for a class-managed slot (DB-backed) */}
      <LessonFormDialog
        open={!!editingClassSlot}
        onOpenChange={(o) => !o && setEditingClassSlot(null)}
        isNew={false}
        initial={
          editingClassSlot
            ? (() => {
                const sStart = (editingClassSlot.start_time || "").slice(0, 5);
                const matchedPeriod =
                  data.periods.find((p) => data.periodTimes[p]?.start === sStart) ??
                  data.periods[0] ??
                  1;
                return {
                  day: editingClassSlot.day_of_week - 1,
                  period: matchedPeriod,
                  subject: editingClassSlot.subject_label ?? "",
                  abbreviation: editingClassSlot.abbreviation ?? "",
                  color: editingClassSlot.color ?? undefined,
                  classId: editingClassSlot.class_id,
                  className: editingClassSlot.classes?.name ?? "",
                  room: editingClassSlot.room ?? "",
                  validFrom: editingClassSlot.valid_from ?? null,
                  validTo: editingClassSlot.valid_to ?? null,
                  weekParity: editingClassSlot.week_parity ?? "every",
                };
              })()
            : null
        }
        periods={dialogPeriods}
        showMirrorSwitch
        title="Upravit hodinu třídy"
        onDelete={async () => {
          if (!editingClassSlot) return;
          const { error } = await supabase
            .from("class_schedule_slots" as any)
            .delete()
            .eq("id", editingClassSlot.id);
          if (error) {
            toast({ title: "Chyba", description: error.message, variant: "destructive" });
            return;
          }
          toast({ title: "Smazáno" });
          setEditingClassSlot(null);
          fetchClassSlots();
        }}
        onSave={async ({ value, slots }) => {
          if (!editingClassSlot) return;
          const s = slots[0];
          if (!s) return;
          const { error } = await supabase
            .from("class_schedule_slots" as any)
            .update({
              class_id: value.classId ?? editingClassSlot.class_id,
              subject_label: value.subject,
              abbreviation: value.abbreviation || null,
              color: value.color || null,
              room: value.room,
              valid_from: value.validFrom,
              valid_to: value.validTo,
              week_parity: value.mirrorBoth ? "every" : value.weekParity,
              day_of_week: s.day + 1,
              start_time: s.start,
              end_time: s.end,
            })
            .eq("id", editingClassSlot.id);
          if (error) {
            toast({ title: "Chyba", description: error.message, variant: "destructive" });
            return;
          }
          toast({ title: "Uloženo" });
          setEditingClassSlot(null);
          fetchClassSlots();
        }}
      />
    </div>
  );
}

/* ───────── Card components ───────── */

function PersonalCard({
  lesson,
  time,
  subjectStyles,
  parityMode,
  conflict,
  onClick,
}: {
  lesson: LessonEntry;
  time: { start: string; end: string } | null;
  subjectStyles: Map<string, { color: string; abbreviation: string }>;
  parityMode: WeekParityMode;
  conflict?: boolean;
  onClick: () => void;
}) {
  const style = subjectStyles.get(lesson.subject.trim());
  const color = lesson.color || style?.color || colorForSubject(lesson.subject);
  const abbr =
    lesson.abbreviation || style?.abbreviation || lesson.subject.slice(0, 3).toUpperCase();

  return (
    <button
      onClick={onClick}
      title={`${conflict ? "⚠ Konflikt v rozvrhu · " : ""}${lesson.subject || "Hodina"}${lesson.className ? ` · ${lesson.className}` : ""}${lesson.room ? ` · ${lesson.room}` : ""}${time ? ` · ${fmtTime(time.start)}–${fmtTime(time.end)}` : ""}`}
      className={`w-full text-left rounded-md p-2 transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 group ${conflict ? "ring-2 ring-destructive ring-offset-1" : ""}`}
      style={{ backgroundColor: `${color}26`, borderLeftColor: color }}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        <Clock className="w-3 h-3" />
        {time ? `${fmtTime(time.start)}–${fmtTime(time.end)}` : `${lesson.period}. hod`}
        <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
      <div className="mt-0.5">
        <span
          className="inline-flex items-center justify-center text-xs font-bold text-white px-2 py-0.5 rounded shrink-0"
          style={{ backgroundColor: color }}
        >
          {abbr}
        </span>
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

function ClassCard({ slot, conflict, onClick }: { slot: ClassSlot; conflict?: boolean; onClick: () => void }) {
  const subject = slot.subject_label || "Hodina";
  const color = slot.color || colorForSubject(subject);
  const abbr = (slot.abbreviation || subject.slice(0, 3)).toUpperCase();
  const className = slot.classes?.name ?? "";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md p-2 transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 group ${conflict ? "ring-2 ring-destructive ring-offset-1" : ""}`}
      style={{ backgroundColor: `${color}26`, borderLeftColor: color }}
      title={`${conflict ? "⚠ Konflikt v rozvrhu · " : ""}${subject}${className ? ` · ${className}` : ""}${slot.room ? ` · ${slot.room}` : ""} · ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)}${slot.week_parity !== "every" ? ` (${slot.week_parity === "odd" ? "lichý" : "sudý"} týden)` : ""}`}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        <Clock className="w-3 h-3" />
        {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
        {slot.week_parity !== "every" && (
          <span className="ml-1 text-[10px]">({slot.week_parity === "odd" ? "lichý" : "sudý"})</span>
        )}
        <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
      <div className="mt-0.5">
        <span
          className="inline-flex items-center justify-center text-xs font-bold text-white px-2 py-0.5 rounded shrink-0"
          style={{ backgroundColor: color }}
        >
          {abbr}
        </span>
      </div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
        <Users className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{className}</span>
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

/* Compact narrow strip used in break rows. */
function BreakStrip({
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
    timeLabel = "před 1.";
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
        ? brk.location?.trim() || "Dozor"
        : meta.label;

  return (
    <div
      className="w-full rounded-sm px-1 py-0.5 flex items-center gap-1 leading-tight overflow-hidden"
      style={{ backgroundColor: `${meta.color}1A` }}
      title={`${meta.label}${brk.note ? ` · ${brk.note}` : ""} · ${timeLabel} (${brk.durationMin} min)`}
    >
      <span
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded shrink-0"
        style={{ backgroundColor: meta.color }}
      >
        <Icon className="w-2 h-2 text-white" />
      </span>
      <span className="text-[10px] font-medium truncate">{title}</span>
      <span className="text-[9px] text-muted-foreground tabular-nums ml-auto shrink-0">
        {brk.durationMin}′
      </span>
    </div>
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

      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground">Týden:</Label>
        {([
          { v: "both", label: "Oba týdny" },
          { v: "odd", label: "Lichý týden" },
          { v: "even", label: "Sudý týden" },
        ] as const).map((opt) => {
          const current = brk.weekParity ?? "both";
          const active = current === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange({ weekParity: opt.v })}
              className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              {opt.label}
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
