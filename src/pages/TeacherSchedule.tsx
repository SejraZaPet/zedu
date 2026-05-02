import { Fragment, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface LessonEntry {
  id: string;
  day: number; // 0=Po … 4=Pá
  period: number; // 1..10
  subject: string;
  className: string;
  room: string;
}

interface PeriodTime {
  start: string;
  end: string;
}

interface RowBreak {
  // přestávka mezi periodou N a N+1 (afterPeriod = N), platí pro celý týden
  afterPeriod: number;
  durationMin: number;
  note: string;
}

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

const DEFAULT_PERIOD_TIMES: Record<number, PeriodTime> = {
  1: { start: "08:00", end: "08:45" },
  2: { start: "08:55", end: "09:40" },
  3: { start: "09:50", end: "10:35" },
  4: { start: "10:55", end: "11:40" },
  5: { start: "11:50", end: "12:35" },
  6: { start: "12:45", end: "13:30" },
  7: { start: "13:40", end: "14:25" },
  8: { start: "14:35", end: "15:20" },
  9: { start: "15:30", end: "16:15" },
  10: { start: "16:25", end: "17:10" },
};

const DEFAULT_BREAKS: RowBreak[] = [
  { afterPeriod: 3, durationMin: 20, note: "Velká přestávka" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

export default function TeacherSchedule() {
  const [lessons, setLessons] = useState<LessonEntry[]>([]);
  const [periodTimes, setPeriodTimes] = useState<Record<number, PeriodTime>>(DEFAULT_PERIOD_TIMES);
  const [rowBreaks, setRowBreaks] = useState<RowBreak[]>(DEFAULT_BREAKS);

  const [editing, setEditing] = useState<LessonEntry | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [editingBreak, setEditingBreak] = useState<RowBreak | null>(null);
  const [isNewBreak, setIsNewBreak] = useState(false);

  const grid = useMemo(() => {
    const map = new Map<string, LessonEntry>();
    lessons.forEach((e) => map.set(`${e.day}-${e.period}`, e));
    return map;
  }, [lessons]);

  const breakByPeriod = useMemo(() => {
    const m = new Map<number, RowBreak>();
    rowBreaks.forEach((b) => m.set(b.afterPeriod, b));
    return m;
  }, [rowBreaks]);

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
    setLessons((prev) => {
      const filtered = prev.filter((e) => e.id !== editing.id);
      return [...filtered, editing];
    });
    toast({ title: isNew ? "Přidáno do rozvrhu" : "Uloženo" });
    setEditing(null);
  }

  function deleteLesson() {
    if (!editing) return;
    setLessons((prev) => prev.filter((e) => e.id !== editing.id));
    toast({ title: "Smazáno" });
    setEditing(null);
  }

  function updatePeriodTime(period: number, field: "start" | "end", value: string) {
    setPeriodTimes((prev) => ({
      ...prev,
      [period]: { ...prev[period], [field]: value },
    }));
  }

  function openNewBreak(afterPeriod: number) {
    setEditingBreak({ afterPeriod, durationMin: 10, note: "" });
    setIsNewBreak(true);
  }

  function openEditBreak(b: RowBreak) {
    setEditingBreak({ ...b });
    setIsNewBreak(false);
  }

  function saveBreak() {
    if (!editingBreak) return;
    setRowBreaks((prev) => {
      const filtered = prev.filter((b) => b.afterPeriod !== editingBreak.afterPeriod);
      return [...filtered, editingBreak].sort((a, b) => a.afterPeriod - b.afterPeriod);
    });
    toast({ title: isNewBreak ? "Přestávka přidána" : "Přestávka uložena" });
    setEditingBreak(null);
  }

  function deleteBreak() {
    if (!editingBreak) return;
    setRowBreaks((prev) => prev.filter((b) => b.afterPeriod !== editingBreak.afterPeriod));
    toast({ title: "Přestávka smazána" });
    setEditingBreak(null);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-6xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Můj rozvrh</h1>
              <p className="text-sm text-muted-foreground">
                Týdenní rozvrh – uprav časy hodin v prvním sloupci, mezi hodiny vlož přestávku.
              </p>
            </div>
          </div>
        </div>

        {/* Mřížka rozvrhu */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-2 border-b border-r border-border text-xs font-medium text-muted-foreground w-32 text-left">
                    Hodina
                  </th>
                  {DAYS.map((d) => (
                    <th
                      key={d}
                      className="p-2 border-b border-border text-xs font-medium text-foreground"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => {
                  const t = periodTimes[period];
                  const br = breakByPeriod.get(period);
                  return (
                    <Fragment key={`row-${period}`}>
                      <tr>
                        <td className="p-2 border-b border-r border-border align-top w-32">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground text-sm">{period}.</span>
                            <span className="text-[10px] text-muted-foreground">hodina</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Input
                              type="time"
                              value={t.start}
                              onChange={(e) => updatePeriodTime(period, "start", e.target.value)}
                              className="h-7 px-2 text-xs font-mono"
                              aria-label={`Začátek ${period}. hodiny`}
                            />
                            <Input
                              type="time"
                              value={t.end}
                              onChange={(e) => updatePeriodTime(period, "end", e.target.value)}
                              className="h-7 px-2 text-xs font-mono"
                              aria-label={`Konec ${period}. hodiny`}
                            />
                          </div>
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          const entry = grid.get(`${dayIdx}-${period}`);
                          return (
                            <td
                              key={dayIdx}
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
                                  onClick={() => openNewLesson(dayIdx, period)}
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Hodina
                                </Button>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Řádek mezi hodinami: přestávka pro celý týden */}
                      {period < PERIODS.length && (
                        <tr className="bg-muted/20">
                          <td className="px-2 py-1 border-b border-r border-border align-middle">
                            {br ? (
                              <div className="flex items-center gap-1">
                                <Coffee className="w-3 h-3 text-muted-foreground shrink-0" />
                                <Input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={br.durationMin}
                                  onChange={(e) =>
                                    updateBreak(period, {
                                      durationMin: parseInt(e.target.value, 10) || 0,
                                    })
                                  }
                                  className="h-7 px-2 text-xs w-14"
                                  aria-label="Délka přestávky v minutách"
                                />
                                <span className="text-[10px] text-muted-foreground">min</span>
                                <button
                                  onClick={() => removeBreak(period)}
                                  className="ml-auto text-muted-foreground hover:text-destructive p-1"
                                  aria-label="Smazat přestávku"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-full px-2 text-xs justify-start text-muted-foreground hover:text-foreground"
                                onClick={() => addBreak(period)}
                              >
                                <Coffee className="w-3 h-3 mr-1" /> Přestávka
                              </Button>
                            )}
                          </td>
                          <td colSpan={DAYS.length} className="px-3 py-1 border-b border-l border-border">
                            {br ? (
                              <Input
                                value={br.note}
                                onChange={(e) => updateBreak(period, { note: e.target.value })}
                                placeholder="Poznámka (např. Velká přestávka, Dozor na chodbě)"
                                className="h-7 text-xs bg-transparent border-transparent hover:border-border focus:border-input"
                              />
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">
                                — bez přestávky —
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Tip: Časy hodin uprav přímo v prvním sloupci. Přestávky vlož mezi hodiny – platí pro celý týden.
        </p>
      </main>

      <SiteFooter />

      {/* Dialog úpravy hodiny */}
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
                  {DAYS[editing.day]} · {editing.period}. hodina ({periodTimes[editing.period].start}–{periodTimes[editing.period].end})
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

      {/* Dialog úpravy přestávky */}
      <Dialog open={!!editingBreak} onOpenChange={(o) => !o && setEditingBreak(null)}>
        <DialogContent className="max-w-md">
          {editingBreak && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Coffee className="w-4 h-4" />
                  {isNewBreak ? "Nová přestávka" : "Upravit přestávku"}
                </DialogTitle>
                <DialogDescription>
                  Mezi {editingBreak.afterPeriod}. a {editingBreak.afterPeriod + 1}. hodinou (platí pro celý týden)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="duration">Délka (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={120}
                    value={editingBreak.durationMin}
                    onChange={(e) =>
                      setEditingBreak({
                        ...editingBreak,
                        durationMin: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Poznámka</Label>
                  <Textarea
                    id="note"
                    value={editingBreak.note}
                    onChange={(e) => setEditingBreak({ ...editingBreak, note: e.target.value })}
                    placeholder="Např. Dozor na chodbě"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
                {!isNewBreak ? (
                  <Button variant="outline" onClick={deleteBreak} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Smazat
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditingBreak(null)}>
                    Zrušit
                  </Button>
                  <Button onClick={saveBreak}>Uložit</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
