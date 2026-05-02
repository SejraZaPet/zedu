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
import { Coffee, Plus, Pencil, Trash2, CalendarDays, X } from "lucide-react";
import {
  DEFAULT_PERIOD_TIMES,
  loadSchedule,
  saveSchedule,
  type LessonEntry,
  type RowBreak,
  type TeacherScheduleData,
  type WeekParityMode,
} from "@/lib/teacher-schedule-store";

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
    setCurrentLessons((prev) => [...prev.filter((e) => e.id !== editing.id), editing]);
    toast({ title: isNew ? "Přidáno do rozvrhu" : "Uloženo" });
    setEditing(null);
  }
  function deleteLesson() {
    if (!editing) return;
    setCurrentLessons((prev) => prev.filter((e) => e.id !== editing.id));
    toast({ title: "Smazáno" });
    setEditing(null);
  }

  function updatePeriodTime(period: number, field: "start" | "end", value: string) {
    setData((d) => ({
      ...d,
      periodTimes: { ...d.periodTimes, [period]: { ...d.periodTimes[period], [field]: value } },
    }));
  }

  function addPeriod() {
    setData((d) => {
      const next = (d.periods[d.periods.length - 1] ?? 0) + 1;
      const last = d.periodTimes[d.periods[d.periods.length - 1]] ?? { start: "08:00", end: "08:45" };
      return {
        ...d,
        periods: [...d.periods, next],
        periodTimes: {
          ...d.periodTimes,
          [next]: DEFAULT_PERIOD_TIMES[next] ?? { start: last.end, end: last.end },
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
  function updateBreak(afterPeriod: number, patch: Partial<RowBreak>) {
    setData((d) => ({
      ...d,
      breaks: d.breaks.map((b) => (b.afterPeriod === afterPeriod ? { ...b, ...patch } : b)),
    }));
  }
  function updateBreakNote(afterPeriod: number, dayIdx: number, value: string) {
    setData((d) => ({
      ...d,
      breaks: d.breaks.map((b) =>
        b.afterPeriod === afterPeriod
          ? { ...b, notes: { ...(b.notes ?? {}), [dayIdx]: value } }
          : b,
      ),
    }));
  }
  function removeBreak(afterPeriod: number) {
    setData((d) => ({ ...d, breaks: d.breaks.filter((b) => b.afterPeriod !== afterPeriod) }));
  }

  function setParityMode(mode: WeekParityMode) {
    setData((d) => {
      // when switching from "both" to per-parity, seed both lists from lessonsBoth if empty
      if (mode !== "both" && d.parityMode === "both") {
        return {
          ...d,
          parityMode: mode,
          lessonsOdd: d.lessonsOdd.length ? d.lessonsOdd : d.lessonsBoth.map((l) => ({ ...l, id: newId() })),
          lessonsEven: d.lessonsEven.length ? d.lessonsEven : d.lessonsBoth.map((l) => ({ ...l, id: newId() })),
        };
      }
      return { ...d, parityMode: mode };
    });
    setActiveTab(mode === "both" ? "both" : "odd");
  }

  // Build column descriptors: alternating period / break
  const columns = useMemo(() => {
    const cols: Array<
      | { kind: "period"; period: number }
      | { kind: "break"; afterPeriod: number }
    > = [];
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
                  <th className="p-2 border-b border-r border-border text-xs font-medium text-muted-foreground w-24 text-left">
                    Den
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
                        className="p-2 border-b border-l border-border bg-muted/30 w-32"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1">
                            <Coffee className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">přestávka</span>
                          </div>
                          <button
                            onClick={() => removeBreak(col.afterPeriod)}
                            className="text-muted-foreground hover:text-destructive p-0.5"
                            aria-label="Odebrat přestávku"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
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
                            className="h-7 px-1 text-xs w-14"
                          />
                          <span className="text-[10px] text-muted-foreground">min</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-2 border-b border-l border-border w-16 align-middle">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={addPeriod}
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
                        const br = breakByPeriod.get(col.afterPeriod)!;
                        return (
                          <td
                            key={`bc-${dayIdx}-${col.afterPeriod}`}
                            className="p-1 border-b border-l border-border bg-muted/10 align-middle"
                          >
                            <Input
                              value={br.notes?.[dayIdx] ?? ""}
                              onChange={(e) => updateBreakNote(col.afterPeriod, dayIdx, e.target.value)}
                              placeholder="Poznámka…"
                              className="h-7 text-xs bg-transparent border-transparent hover:border-border"
                            />
                          </td>
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
                    // Show "+ break" button only if not the last period and no break already exists after it
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
          Tip: Tlačítkem <Plus className="inline w-3 h-3" /> vpravo přidáš hodinu. Pomocí <Minus className="inline w-3 h-3" /> v hlavičce ji odebereš.
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
