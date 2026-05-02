import { Fragment, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Coffee, Plus, Pencil, Trash2, CalendarDays, X, Check } from "lucide-react";
import {
  DEFAULT_PERIOD_TIMES,
  loadSchedule,
  saveSchedule,
  buildSubjectStyleMap,
  colorForSubject,
  SUBJECT_COLORS,
  type LessonEntry,
  type RowBreak,
  type TeacherScheduleData,
  type WeekParityMode,
} from "@/lib/teacher-schedule-store";
import ClassScheduleSummary from "@/components/ClassScheduleSummary";

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];

const newId = () => Math.random().toString(36).slice(2, 10);

type ParityTab = "both" | "odd" | "even";

export default function TeacherSchedule() {
  const [data, setData] = useState<TeacherScheduleData>(() => loadSchedule());
  const [activeTab, setActiveTab] = useState<ParityTab>(data.parityMode === "both" ? "both" : "odd");

  // Persist
  useEffect(() => {
    saveSchedule(data);
  }, [data]);

  const [editing, setEditing] = useState<LessonEntry | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Which lesson list is currently shown / edited
  const currentLessons = useMemo(() => {
    if (data.parityMode === "both") return data.lessonsBoth;
    return activeTab === "odd" ? data.lessonsOdd : data.lessonsEven;
  }, [data, activeTab]);

  const setCurrentLessons = (updater: (prev: LessonEntry[]) => LessonEntry[]) => {
    setData((d) => {
      if (d.parityMode === "both") return { ...d, lessonsBoth: updater(d.lessonsBoth) };
      if (activeTab === "odd") return { ...d, lessonsOdd: updater(d.lessonsOdd) };
      return { ...d, lessonsEven: updater(d.lessonsEven) };
    });
  };

  const grid = useMemo(() => {
    const m = new Map<string, LessonEntry>();
    currentLessons.forEach((e) => m.set(`${e.day}-${e.period}`, e));
    return m;
  }, [currentLessons]);

  const breakByPeriod = useMemo(() => {
    const m = new Map<number, RowBreak>();
    data.breaks.forEach((b) => m.set(b.afterPeriod, b));
    return m;
  }, [data.breaks]);

  function openNewLesson(day: number, period: number) {
    setEditing({ id: newId(), day, period, subject: "", className: "", room: "" });
    setIsNew(true);
  }
  function openEditLesson(entry: LessonEntry) {
    setEditing({ ...entry });
    setIsNew(false);
  }
  function saveLesson() {
    if (!editing) return;
    if (!editing.subject.trim()) {
      toast({ title: "Předmět je povinný", variant: "destructive" });
      return;
    }
    const e = editing;
    setData((d) => {
      // "both" mode: simple list
      if (d.parityMode === "both") {
        return {
          ...d,
          lessonsBoth: [...d.lessonsBoth.filter((x) => x.id !== e.id), e],
        };
      }

      // odd/even mode
      const otherSide: "odd" | "even" = activeTab === "odd" ? "even" : "odd";
      const thisListKey = activeTab === "odd" ? "lessonsOdd" : "lessonsEven";
      const otherListKey = otherSide === "odd" ? "lessonsOdd" : "lessonsEven";

      if (e.mirrorBoth) {
        // ensure a stable mirrorKey
        const mirrorKey = e.mirrorKey ?? newId();
        const thisEntry: LessonEntry = { ...e, mirrorBoth: true, mirrorKey };
        // find existing twin in other list (by mirrorKey)
        const otherList = d[otherListKey].filter((x) => x.mirrorKey !== mirrorKey);
        const twin: LessonEntry = { ...thisEntry, id: newId() };
        return {
          ...d,
          [thisListKey]: [...d[thisListKey].filter((x) => x.id !== e.id), thisEntry],
          [otherListKey]: [...otherList, twin],
        } as TeacherScheduleData;
      }

      // mirror is OFF — if it had a mirrorKey, drop the twin from other side
      const cleanedOther = e.mirrorKey
        ? d[otherListKey].filter((x) => x.mirrorKey !== e.mirrorKey)
        : d[otherListKey];
      const cleanedThis: LessonEntry = { ...e, mirrorBoth: false, mirrorKey: undefined };
      return {
        ...d,
        [thisListKey]: [...d[thisListKey].filter((x) => x.id !== e.id), cleanedThis],
        [otherListKey]: cleanedOther,
      } as TeacherScheduleData;
    });
    toast({ title: isNew ? "Přidáno do rozvrhu" : "Uloženo" });
    setEditing(null);
  }
  function deleteLesson() {
    if (!editing) return;
    const e = editing;
    setData((d) => {
      if (d.parityMode === "both") {
        return { ...d, lessonsBoth: d.lessonsBoth.filter((x) => x.id !== e.id) };
      }
      // remove from current list and twin from other list (if mirrored)
      return {
        ...d,
        lessonsOdd: d.lessonsOdd.filter((x) => x.id !== e.id && (!e.mirrorKey || x.mirrorKey !== e.mirrorKey)),
        lessonsEven: d.lessonsEven.filter((x) => x.id !== e.id && (!e.mirrorKey || x.mirrorKey !== e.mirrorKey)),
      };
    });
    toast({ title: "Smazáno" });
    setEditing(null);
  }

  function updatePeriodTime(period: number, field: "start" | "end", value: string) {
    setData((d) => ({
      ...d,
      periodTimes: { ...d.periodTimes, [period]: { ...d.periodTimes[period], [field]: value } },
    }));
  }

  function addPeriod(where: "end" | "start" = "end") {
    setData((d) => {
      if (where === "start") {
        const first = d.periods[0] ?? 1;
        const next = first - 1; // can be 0, then -1, …
        const firstTime = d.periodTimes[first] ?? { start: "07:55", end: "08:40" };
        return {
          ...d,
          periods: [next, ...d.periods],
          periodTimes: {
            ...d.periodTimes,
            [next]: { start: "07:10", end: firstTime.start || "07:55" },
          },
        };
      }
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

  function addBreakAfter(afterPeriod: number) {
    setData((d) => ({
      ...d,
      breaks: [...d.breaks, { afterPeriod, durationMin: 10, notes: {} }].sort(
        (a, b) => a.afterPeriod - b.afterPeriod,
      ),
    }));
  }
  function addLeadingBreak() {
    setData((d) => {
      if (d.periods.length === 0) return d;
      const key = d.periods[0] - 1;
      if (d.breaks.some((b) => b.afterPeriod === key)) return d;
      return {
        ...d,
        breaks: [...d.breaks, { afterPeriod: key, durationMin: 10, notes: {} }].sort(
          (a, b) => a.afterPeriod - b.afterPeriod,
        ),
      };
    });
  }
  function updateBreak(afterPeriod: number, patch: Partial<RowBreak>) {
    setData((d) => ({
      ...d,
      breaks: d.breaks.map((b) => (b.afterPeriod === afterPeriod ? { ...b, ...patch } : b)),
    }));
  }
  function removeBreak(afterPeriod: number) {
    setData((d) => ({ ...d, breaks: d.breaks.filter((b) => b.afterPeriod !== afterPeriod) }));
  }

  function setParityMode(mode: WeekParityMode) {
    // Lichý a sudý jsou zcela nezávislé — žádné automatické kopírování mezi nimi.
    setData((d) => ({ ...d, parityMode: mode }));
    setActiveTab(mode === "both" ? "both" : "odd");
  }

  // Build column descriptors: alternating period / break.
  // A break with afterPeriod = (firstPeriod - 1) is rendered BEFORE the first period.
  const columns = useMemo(() => {
    const cols: Array<
      | { kind: "period"; period: number }
      | { kind: "break"; afterPeriod: number }
    > = [];
    if (data.periods.length === 0) return cols;
    const leadingKey = data.periods[0] - 1;
    if (breakByPeriod.has(leadingKey)) {
      cols.push({ kind: "break", afterPeriod: leadingKey });
    }
    data.periods.forEach((p, i) => {
      cols.push({ kind: "period", period: p });
      if (i < data.periods.length - 1 && breakByPeriod.has(p)) {
        cols.push({ kind: "break", afterPeriod: p });
      }
    });
    return cols;
  }, [data.periods, breakByPeriod]);

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
                Hodiny vlevo–vpravo, dny shora dolů. Hodiny se automaticky zobrazí v kalendáři.
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

        {/* Hodiny ze tříd – synchronizováno z Třídy → ikona hodin */}
        <div className="mb-6">
          <ClassScheduleSummary />
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
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-2 border-b border-r border-border text-xs font-medium text-muted-foreground w-32 text-left align-bottom">
                    <div className="flex flex-col gap-1">
                      <span>Den</span>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => addPeriod("start")}
                          title="Přidat hodinu před první (např. nultá)"
                        >
                          <Plus className="w-3 h-3 mr-0.5" />
                          hod.
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={addLeadingBreak}
                          disabled={
                            data.periods.length === 0 ||
                            breakByPeriod.has(data.periods[0] - 1)
                          }
                          title="Vložit přestávku před první hodinu"
                        >
                          <Coffee className="w-3 h-3 mr-0.5" />+
                        </Button>
                      </div>
                    </div>
                  </th>
                  {columns.map((col) => {
                    if (col.kind === "period") {
                      const t = data.periodTimes[col.period];
                      return (
                        <th
                          key={`h-p-${col.period}`}
                          className="p-2 border-b border-l border-border min-w-[140px]"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-semibold text-foreground text-sm">
                              {col.period}. hod
                            </span>
                            <button
                              onClick={() => removePeriod(col.period)}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                              aria-label={`Odebrat ${col.period}. hodinu`}
                              title="Odebrat hodinu"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Input
                              type="time"
                              value={t?.start ?? ""}
                              onChange={(e) => updatePeriodTime(col.period, "start", e.target.value)}
                              className="h-7 px-1 text-xs font-mono"
                            />
                            <Input
                              type="time"
                              value={t?.end ?? ""}
                              onChange={(e) => updatePeriodTime(col.period, "end", e.target.value)}
                              className="h-7 px-1 text-xs font-mono"
                            />
                          </div>
                        </th>
                      );
                    }
                    const br = breakByPeriod.get(col.afterPeriod)!;
                    return (
                      <th
                        key={`h-b-${col.afterPeriod}`}
                        className="p-1 border-b border-l border-border bg-muted/30 w-14 align-top"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => removeBreak(col.afterPeriod)}
                            className="self-end text-muted-foreground hover:text-destructive p-0.5"
                            aria-label="Odebrat přestávku"
                            title="Odebrat přestávku"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <Coffee className="w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            value={br.durationMin}
                            onChange={(e) =>
                              updateBreak(col.afterPeriod, {
                                durationMin: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="h-6 px-1 text-[11px] w-11 text-center"
                            title="Délka přestávky v minutách"
                          />
                          <span className="text-[9px] text-muted-foreground -mt-0.5">min</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-2 border-b border-l border-border w-16 align-middle">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addPeriod("end")}
                      className="h-8 w-full px-2"
                      title="Přidat hodinu"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dayIdx) => (
                  <Fragment key={day}>
                    <tr>
                      <td className="p-2 border-b border-r border-border align-middle font-medium text-sm bg-muted/20">
                        {day}
                      </td>
                      {columns.map((col) => {
                        if (col.kind === "period") {
                          const entry = grid.get(`${dayIdx}-${col.period}`);
                          return (
                            <td
                              key={`c-${dayIdx}-${col.period}`}
                              className="p-1 border-b border-l border-border align-top h-20"
                            >
                              {entry ? (
                                <button
                                  onClick={() => openEditLesson(entry)}
                                  className="w-full h-full text-left rounded-md p-2 transition-colors bg-primary/10 hover:bg-primary/20"
                                >
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-sm leading-tight truncate">
                                      {entry.subject}
                                    </div>
                                    {entry.className && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        {entry.className}
                                      </div>
                                    )}
                                    {entry.room && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        📍 {entry.room}
                                      </div>
                                    )}
                                    {entry.mirrorBoth && data.parityMode !== "both" && (
                                      <div className="text-[10px] text-muted-foreground">
                                        ↔ oba týdny
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="w-full h-full justify-center text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => openNewLesson(dayIdx, col.period)}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                </Button>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={`bc-${dayIdx}-${col.afterPeriod}`}
                            className="border-b border-l border-border bg-muted/10"
                          />
                        );
                      })}
                      <td className="border-b border-l border-border" />
                    </tr>
                  </Fragment>
                ))}

                {/* Row to add break between periods */}
                <tr className="bg-muted/10">
                  <td className="p-2 border-r border-border text-xs text-muted-foreground">
                    Vložit přestávku
                  </td>
                  {columns.map((col, idx) => {
                    if (col.kind === "break") {
                      return <td key={`add-b-${idx}`} className="border-l border-border" />;
                    }
                    const isLast = idx === columns.length - 1;
                    const nextIsBreak = !isLast && columns[idx + 1]?.kind === "break";
                    if (isLast || nextIsBreak) {
                      return <td key={`add-b-${idx}`} className="border-l border-border" />;
                    }
                    return (
                      <td key={`add-b-${idx}`} className="p-1 border-l border-border text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => addBreakAfter(col.period)}
                          title="Vložit přestávku za tuto hodinu"
                        >
                          <Coffee className="w-3 h-3 mr-1" />+
                        </Button>
                      </td>
                    );
                  })}
                  <td className="border-l border-border" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Tip: Tlačítkem <Plus className="inline w-3 h-3" /> vpravo přidáš hodinu, vlevo můžeš přidat nultou hodinu nebo přestávku před první hodinou.
          Hodiny se automaticky propíší do tvého kalendáře.
        </p>
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
                  {DAYS[editing.day]} · {editing.period}. hodina
                  {data.periodTimes[editing.period] &&
                    ` (${data.periodTimes[editing.period].start}–${data.periodTimes[editing.period].end})`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Předmět *</Label>
                  <Input
                    id="subject"
                    value={editing.subject}
                    onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                    placeholder="Např. Matematika"
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
                <div className="space-y-1.5">
                  <Label htmlFor="room">Místnost</Label>
                  <Input
                    id="room"
                    value={editing.room}
                    onChange={(e) => setEditing({ ...editing, room: e.target.value })}
                    placeholder="Např. 204"
                  />
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
                      onCheckedChange={(v) =>
                        setEditing({ ...editing, mirrorBoth: v })
                      }
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
