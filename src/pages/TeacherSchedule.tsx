import { useMemo, useState } from "react";
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
import { Coffee, Plus, Pencil, Trash2, CalendarDays } from "lucide-react";

type EntryType = "lesson" | "break";

interface BaseEntry {
  id: string;
  type: EntryType;
  day: number; // 0=Po … 4=Pá
  period: number; // 1..10
  startTime: string;
  endTime: string;
}

interface LessonEntry extends BaseEntry {
  type: "lesson";
  subject: string;
  className: string;
  room: string;
}

interface BreakEntry extends BaseEntry {
  type: "break";
  durationMin: number;
  note: string;
}

type Entry = LessonEntry | BreakEntry;

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

const DEFAULT_TIMES: Record<number, { start: string; end: string }> = {
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

const newId = () => Math.random().toString(36).slice(2, 10);

const emptyLesson = (day: number, period: number): LessonEntry => ({
  id: newId(),
  type: "lesson",
  day,
  period,
  startTime: DEFAULT_TIMES[period].start,
  endTime: DEFAULT_TIMES[period].end,
  subject: "",
  className: "",
  room: "",
});

const emptyBreak = (day: number, period: number): BreakEntry => ({
  id: newId(),
  type: "break",
  day,
  period,
  startTime: DEFAULT_TIMES[period].end,
  endTime: DEFAULT_TIMES[period + 1]?.start ?? DEFAULT_TIMES[period].end,
  durationMin: 10,
  note: "",
});

export default function TeacherSchedule() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [isNew, setIsNew] = useState(false);

  const grid = useMemo(() => {
    const map = new Map<string, Entry>();
    entries.forEach((e) => map.set(`${e.day}-${e.period}`, e));
    return map;
  }, [entries]);

  function openNew(day: number, period: number, type: EntryType) {
    const e = type === "lesson" ? emptyLesson(day, period) : emptyBreak(day, period);
    setEditing(e);
    setIsNew(true);
  }

  function openEdit(entry: Entry) {
    setEditing({ ...entry });
    setIsNew(false);
  }

  function saveEntry() {
    if (!editing) return;
    if (editing.type === "lesson" && !editing.subject.trim()) {
      toast({ title: "Předmět je povinný", variant: "destructive" });
      return;
    }
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== editing.id);
      return [...filtered, editing];
    });
    toast({ title: isNew ? "Přidáno do rozvrhu" : "Uloženo" });
    setEditing(null);
  }

  function deleteEntry() {
    if (!editing) return;
    setEntries((prev) => prev.filter((e) => e.id !== editing.id));
    toast({ title: "Smazáno" });
    setEditing(null);
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
                Týdenní rozvrh hodin – klikni na buňku pro přidání či úpravu.
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
                  <th className="p-2 border-b border-r border-border text-xs font-medium text-muted-foreground w-16 text-left sticky left-0 bg-muted/50">
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
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td className="p-2 border-b border-r border-border text-xs text-muted-foreground align-top sticky left-0 bg-card">
                      <div className="font-semibold text-foreground">{period}.</div>
                      <div className="font-mono">{DEFAULT_TIMES[period].start}</div>
                      <div className="font-mono">{DEFAULT_TIMES[period].end}</div>
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
                              onClick={() => openEdit(entry)}
                              className={`w-full h-full text-left rounded-md p-2 transition-colors ${
                                entry.type === "lesson"
                                  ? "bg-primary/10 hover:bg-primary/20"
                                  : "bg-muted hover:bg-muted/80"
                              }`}
                            >
                              {entry.type === "lesson" ? (
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
                                  <div className="text-[10px] font-mono text-muted-foreground">
                                    {entry.startTime}–{entry.endTime}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-xs font-medium">
                                    <Coffee className="w-3 h-3" />
                                    Přestávka
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {entry.durationMin} min
                                  </div>
                                  {entry.note && (
                                    <div className="text-[11px] text-muted-foreground line-clamp-2">
                                      {entry.note}
                                    </div>
                                  )}
                                </div>
                              )}
                            </button>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => openNew(dayIdx, period, "lesson")}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Hodina
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => openNew(dayIdx, period, "break")}
                              >
                                <Coffee className="w-3 h-3 mr-1" /> Přestávka
                              </Button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Tip: Najeď myší na prázdnou buňku pro přidání hodiny nebo přestávky.
        </p>
      </main>

      <SiteFooter />

      {/* Dialog úpravy */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {editing.type === "lesson" ? (
                    <>
                      <Pencil className="w-4 h-4" />
                      {isNew ? "Nová hodina" : "Upravit hodinu"}
                    </>
                  ) : (
                    <>
                      <Coffee className="w-4 h-4" />
                      {isNew ? "Nová přestávka" : "Upravit přestávku"}
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {DAYS[editing.day]} · {editing.period}. hodina
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start">Začátek</Label>
                    <Input
                      id="start"
                      type="time"
                      value={editing.startTime}
                      onChange={(e) =>
                        setEditing({ ...editing, startTime: e.target.value } as Entry)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end">Konec</Label>
                    <Input
                      id="end"
                      type="time"
                      value={editing.endTime}
                      onChange={(e) =>
                        setEditing({ ...editing, endTime: e.target.value } as Entry)
                      }
                    />
                  </div>
                </div>

                {editing.type === "lesson" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">Předmět *</Label>
                      <Input
                        id="subject"
                        value={editing.subject}
                        onChange={(e) =>
                          setEditing({ ...editing, subject: e.target.value })
                        }
                        placeholder="Např. Matematika"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="class">Třída</Label>
                      <Input
                        id="class"
                        value={editing.className}
                        onChange={(e) =>
                          setEditing({ ...editing, className: e.target.value })
                        }
                        placeholder="Např. 6. A"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="room">Místnost</Label>
                      <Input
                        id="room"
                        value={editing.room}
                        onChange={(e) =>
                          setEditing({ ...editing, room: e.target.value })
                        }
                        placeholder="Např. 204"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="duration">Délka (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={1}
                        max={120}
                        value={editing.durationMin}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            durationMin: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="note">Poznámka</Label>
                      <Textarea
                        id="note"
                        value={editing.note}
                        onChange={(e) =>
                          setEditing({ ...editing, note: e.target.value })
                        }
                        placeholder="Např. Dozor na chodbě"
                        rows={2}
                      />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
                {!isNew ? (
                  <Button variant="outline" onClick={deleteEntry} className="text-destructive">
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
                  <Button onClick={saveEntry}>Uložit</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
