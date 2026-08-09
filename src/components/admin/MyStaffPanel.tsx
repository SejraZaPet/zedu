import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { toast } from "@/hooks/use-toast";
import { STAFF_MODULES } from "@/lib/staff-modules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import ColorSwatchPicker from "./ColorSwatchPicker";
import { DEFAULT_STAFF_COLOR, RECURRENCE_OPTIONS, REMINDER_OPTIONS } from "@/lib/staff-colors";

import StaffTaskDialog, { TASK_PRIORITIES, TASK_STATUSES } from "./StaffTaskDialog";
import { CalendarPlus, CalendarDays, CheckCircle2, ListChecks, Plus, Trash2, ArrowRight, ChevronLeft, ChevronRight, Rss, Copy, StickyNote, Sparkles, Bell, Repeat } from "lucide-react";


interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  assigned_by: string;
  assigned_to: string;
  color: string | null;
}

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  created_by: string;
  color: string | null;
  all_day: boolean;
  recurrence_rule: string | null;
  recurrence_group_id: string | null;
  reminder_minutes: number[] | null;
}


/** Moduly oprávnění → záložka administrace */
const MODULE_TAB: Record<string, string> = {
  crm: "crm",
  users: "users",
  schools: "users",
  school_licenses: "licenses",
  textbook_overview: "textbook-overview",
  academy: "academy",
  avatar_manager: "avatars",
  notifications: "notifications",
  landing: "landing",
  templates: "templates",
  audit: "audit",
  stats: "stats",
  billing: "market-economics",
};

const priorityLabel = (v: string) => TASK_PRIORITIES.find((p) => p.value === v)?.label ?? v;

/** Lokální klíč dne YYYY-MM-DD (bez posunu časovou zónou). */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });


const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface Props {
  onNavigate?: (tab: string) => void;
}

/** Osobní pracovní prostředí člena týmu ZEdu: úkoly, sdílený kalendář, rychlé odkazy. */
const MyStaffPanel = ({ onNavigate }: Props) => {
  const { user } = useAuth();
  const { permissions, isAdmin } = useStaffPermissions();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  
  const [feedOpen, setFeedOpen] = useState(false);
  const [loading, setLoading] = useState(true);


  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: taskData }, { data: eventData }] = await Promise.all([
      supabase
        .from("staff_tasks")
        .select("id, title, description, due_date, status, priority, assigned_by, assigned_to, color")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("staff_calendar_events")
        .select("id, title, description, start_time, end_time, created_by, color, all_day, recurrence_rule, recurrence_group_id, reminder_minutes")

        .order("start_time", { ascending: true }),
    ]);
    setTasks((taskData ?? []) as TaskRow[]);
    setEvents((eventData ?? []) as EventRow[]);

    const ids = Array.from(
      new Set([
        ...(taskData ?? []).map((t: any) => t.assigned_by),
        ...(eventData ?? []).map((e: any) => e.created_by),
      ]),
    ).filter(Boolean);
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => {
        map[p.id] = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
      });
      setNames(map);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const visibleTasks = useMemo(() => {
    if (statusFilter === "all") return tasks;
    if (statusFilter === "open") return tasks.filter((t) => t.status !== "done");
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const quickLinks = useMemo(() => {
    const allowed = STAFF_MODULES.filter((m) => (isAdmin ? true : permissions[m.id]?.can_view));
    return allowed.filter((m) => MODULE_TAB[m.id]);
  }, [permissions, isAdmin]);

  const setStatus = async (task: TaskRow, status: string) => {
    const { error } = await supabase
      .from("staff_tasks")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", task.id);
    if (error) {
      toast({ title: "Stav nelze změnit", description: error.message, variant: "destructive" });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
  };

  /** Události seskupené podle dne (lokální YYYY-MM-DD). */
  const eventsByDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    events.forEach((e) => {
      const key = dayKey(new Date(e.start_time));
      (map[key] ??= []).push(e);
    });
    // Celodenní události vždy nahoře, pak časované podle času začátku.
    Object.values(map).forEach((list) =>
      list.sort((a, b) =>
        a.all_day === b.all_day
          ? a.start_time.localeCompare(b.start_time)
          : a.all_day
            ? -1
            : 1,
      ),
    );

    return map;
  }, [events]);

  /** Pondělí zobrazeného týdne podle posunu. */
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const dayEvents = eventsByDay[selectedDate] ?? [];



  const deleteEvent = async (ev: EventRow, scope: "one" | "series" = "one") => {
    const query = supabase.from("staff_calendar_events").delete();
    const { error } =
      scope === "series" && ev.recurrence_group_id
        ? await query.eq("recurrence_group_id", ev.recurrence_group_id)
        : await query.eq("id", ev.id);
    if (error) {
      toast({ title: "Událost nelze smazat", description: error.message, variant: "destructive" });
      return;
    }
    setEvents((prev) =>
      scope === "series" && ev.recurrence_group_id
        ? prev.filter((e) => e.recurrence_group_id !== ev.recurrence_group_id)
        : prev.filter((e) => e.id !== ev.id),
    );
    setDeleteTarget(null);
  };

  const requestDelete = (ev: EventRow) => {
    if (ev.recurrence_group_id) {
      setDeleteTarget(ev);
      return;
    }
    void deleteEvent(ev, "one");
  };


  if (loading) return <p className="text-muted-foreground p-4">Načítání panelu…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="w-4 h-4" /> Moje úkoly
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Nevyřešené</SelectItem>
                <SelectItem value="all">Všechny</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setTaskOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nový úkol
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {visibleTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné úkoly v tomto filtru.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleTasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color || "hsl(var(--muted))" }}
                    />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">

                      <span className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                        {t.title}
                      </span>
                      {t.priority !== "normal" && (
                        <Badge variant={t.priority === "high" ? "destructive" : "secondary"}>
                          {priorityLabel(t.priority)}
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t.due_date ? `Termín ${fmtDate(t.due_date)} · ` : ""}
                      {t.assigned_by === user?.id ? "vlastní úkol" : `zadal ${names[t.assigned_by] ?? "—"}`}
                    </p>
                  </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={t.status} onValueChange={(v) => void setStatus(t, v)}>
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {t.status !== "done" && (
                      <Button size="sm" variant="outline" onClick={() => void setStatus(t, "done")}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Pracovní kalendář</CardTitle>
            <p className="text-sm text-muted-foreground capitalize">
              {selectedDate === dayKey(new Date()) ? "Dnes · " : ""}
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("cs-CZ", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setCalendarOpen(true)}>
              <CalendarDays className="w-4 h-4 mr-1" /> Otevřít kalendář
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFeedOpen(true)}>
              <Rss className="w-4 h-4 mr-1" /> Odebírat v kalendáři
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEventOpen(true)}>
              <CalendarPlus className="w-4 h-4 mr-1" /> Přidat událost
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Denní agenda */}
          {dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedDate === dayKey(new Date()) ? "Žádné události na dnešek." : "Žádné události v tento den."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {dayEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-4 py-3">
                  <div className="w-20 shrink-0 text-sm font-medium tabular-nums">
                    {fmtTime(e.start_time)}
                    {e.end_time && (
                      <div className="text-xs font-normal text-muted-foreground">{fmtTime(e.end_time)}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{e.title}</div>
                    {e.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{e.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{names[e.created_by] ?? "—"}</p>
                  </div>
                  {(isAdmin || e.created_by === user?.id) && (
                    <Button size="sm" variant="ghost" onClick={() => void deleteEvent(e.id)} aria-label="Smazat událost">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Týdenní pruh */}
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setWeekOffset((o) => o - 1)} aria-label="Předchozí týden">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="grid flex-1 grid-cols-7 gap-1">
              {weekDays.map((d, i) => {
                const key = dayKey(d);
                const count = eventsByDay[key]?.length ?? 0;
                const isToday = key === dayKey(new Date());
                const isSel = key === selectedDate;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    aria-label={`${WEEKDAYS[i]} ${d.getDate()}. ${d.getMonth() + 1}. — ${count} událostí`}
                    aria-current={isSel ? "date" : undefined}
                    className={`flex flex-col items-center gap-0.5 rounded-md border py-2 text-xs transition-colors ${
                      isSel
                        ? "border-primary bg-primary text-primary-foreground"
                        : isToday
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="opacity-80">{WEEKDAYS[i]}</span>
                    <span className="text-sm font-semibold">{d.getDate()}</span>
                    {count > 0 ? (
                      <Badge variant={isSel ? "secondary" : "default"} className="h-4 px-1 text-[10px]">{count}</Badge>
                    ) : (
                      <span className="h-4" />
                    )}
                  </button>
                );
              })}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setWeekOffset((o) => o + 1)} aria-label="Další týden">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rychlé odkazy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quickLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím nemáte přiřazený žádný modul administrace.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {quickLinks.map((m) => (
                <Button
                  key={m.id}
                  variant="outline"
                  className="justify-between"
                  onClick={() => onNavigate?.(MODULE_TAB[m.id])}
                >
                  {m.label}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              className="justify-between"
              onClick={() => window.location.assign("/avatar")}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Upravit avatara
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>

      </Card>

      {user && (
        <StaffTaskDialog
          open={taskOpen}
          onOpenChange={setTaskOpen}
          assignedTo={user.id}
          assignedBy={user.id}
          onCreated={() => void load()}
        />
      )}
      <StaffEventDialog open={eventOpen} onOpenChange={setEventOpen} onCreated={() => void load()} />
      <CalendarBrowserDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        eventsByDay={eventsByDay}
        initialDay={selectedDate}
        onPickDay={(key) => {
          setSelectedDate(key);
          const picked = new Date(`${key}T00:00:00`);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const mondayNow = new Date(today);
          mondayNow.setDate(today.getDate() - ((today.getDay() + 6) % 7));
          const mondayPicked = new Date(picked);
          mondayPicked.setDate(picked.getDate() - ((picked.getDay() + 6) % 7));
          setWeekOffset(Math.round((mondayPicked.getTime() - mondayNow.getTime()) / (7 * 86400000)));
          setCalendarOpen(false);
        }}
      />
      <CalendarFeedDialog open={feedOpen} onOpenChange={setFeedOpen} />
    </div>
  );
};

/** Měsíční mřížka sdílených událostí + osobní poznámky k vybranému dni. */
const CalendarBrowserDialog = ({
  open,
  onOpenChange,
  eventsByDay,
  initialDay,
  onPickDay,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventsByDay: Record<string, EventRow[]>;
  initialDay: string;
  onPickDay: (key: string) => void;
}) => {
  const { user } = useAuth();
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(`${initialDay}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [activeDay, setActiveDay] = useState(initialDay);
  const [note, setNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveDay(initialDay);
    const d = new Date(`${initialDay}T00:00:00`);
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [open, initialDay]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setNoteLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("staff_calendar_notes")
        .select("content")
        .eq("author_id", user.id)
        .eq("note_date", activeDay)
        .maybeSingle();
      if (cancelled) return;
      setNote((data as any)?.content ?? "");
      setNoteLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, activeDay]);

  const grid = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [monthCursor]);

  const saveNote = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("staff_calendar_notes")
      .upsert(
        { author_id: user.id, note_date: activeDay, content: note },
        { onConflict: "author_id,note_date" },
      );
    setSaving(false);
    if (error) {
      toast({ title: "Poznámku nelze uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Poznámka uložena" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Kalendář</DialogTitle>
          <DialogDescription>
            Kliknutím na den ho otevřete v denním přehledu. Poznámky jsou osobní, jen pro vás.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Předchozí měsíc"
                onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium capitalize">
                {monthCursor.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Další měsíc"
                onClick={() => setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d) => {
                const key = dayKey(d);
                const count = eventsByDay[key]?.length ?? 0;
                const inMonth = d.getMonth() === monthCursor.getMonth();
                const isToday = key === dayKey(new Date());
                return (
                  <div key={key} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setActiveDay(key)}
                      onDoubleClick={() => onPickDay(key)}
                      aria-label={`${d.getDate()}. ${d.getMonth() + 1}. — ${count} událostí`}
                      className={`flex h-14 flex-col items-center justify-center rounded-md border text-sm transition-colors ${
                        activeDay === key ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                      } ${inMonth ? "" : "opacity-40"} ${isToday ? "font-bold" : ""}`}
                    >
                      <span>{d.getDate()}</span>
                      {count > 0 && (
                        <span className="mt-1 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span className="text-[10px] text-muted-foreground">{count}</span>
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Události {fmtDate(activeDay)}</h4>
                <Button size="sm" variant="outline" onClick={() => onPickDay(activeDay)}>
                  Otevřít v denním přehledu
                </Button>
              </div>
              {(eventsByDay[activeDay] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné události.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {(eventsByDay[activeDay] ?? []).map((e) => (
                    <li key={e.id}>
                      <span className="tabular-nums text-muted-foreground">{fmtTime(e.start_time)}</span> · {e.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <StickyNote className="w-4 h-4" /> Poznámky · {fmtDate(activeDay)}
            </h4>
            <Textarea
              rows={10}
              value={note}
              disabled={noteLoading}
              placeholder={noteLoading ? "Načítám…" : "Rychlá osobní poznámka k tomuto dni…"}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button size="sm" className="w-full" disabled={saving || noteLoading} onClick={() => void saveNote()}>
              {saving ? "Ukládám…" : "Uložit poznámku"}
            </Button>
            <p className="text-xs text-muted-foreground">Poznámky vidíte jen vy, na rozdíl od sdílených událostí.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Jednosměrný odběr pracovního kalendáře přes iCal (.ics) feed. */
const CalendarFeedDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || url || loading) return;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.functions.invoke("staff-calendar-feed", { method: "POST" });
      setLoading(false);
      if (error || !(data as any)?.url) {
        toast({
          title: "Odkaz nelze vytvořit",
          description: error?.message ?? "Zkuste to prosím znovu.",
          variant: "destructive",
        });
        return;
      }
      setUrl((data as any).url as string);
    })();
  }, [open, url, loading]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Odkaz zkopírován" });
    } catch {
      toast({ title: "Kopírování nelze provést", description: "Zkopírujte odkaz ručně.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Odebírat pracovní kalendář</DialogTitle>
          <DialogDescription>
            Tento odkaz vložte do Google Calendar (Přidat kalendář → Ze zdroje URL) nebo Apple Calendar
            (Soubor → Nový odběr kalendáře).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {loading && !url ? (
            <p className="text-sm text-muted-foreground">Připravuji odkaz…</p>
          ) : url ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => void copy()} aria-label="Kopírovat odkaz">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Odkaz se nepodařilo připravit.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Odběr je <strong>jednosměrný</strong> (ZEdu → váš kalendář). Úpravy provedené v Google nebo Apple
            Calendar se do aplikace nepropíšou. Odkaz je osobní a tajný — nesdílejte ho.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};


const StaffEventDialog = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    const t = title.trim();
    if (!t || !start) {
      toast({ title: "Vyplňte název a začátek", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("staff_calendar_events").insert({
      title: t,
      description: description.trim() || null,
      start_time: new Date(start).toISOString(),
      end_time: end ? new Date(end).toISOString() : null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Událost nelze uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Událost přidána" });
    setTitle(""); setDescription(""); setStart(""); setEnd("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nová událost v pracovním kalendáři</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ev-title">Název</Label>
            <Input id="ev-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-desc">Popis</Label>
            <Textarea id="ev-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ev-start">Začátek</Label>
              <Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-end">Konec</Label>
              <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" disabled={saving} onClick={() => void save()}>
            {saving ? "Ukládám…" : "Přidat událost"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyStaffPanel;
