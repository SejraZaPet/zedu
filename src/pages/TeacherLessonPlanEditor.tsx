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
import { ArrowLeft, Clock, Save, CalendarDays } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadSchedule, expandTeacherSchedule } from "@/lib/teacher-schedule-store";
import { expandScheduleSlots, formatTime } from "@/lib/calendar-utils";

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

interface PhaseValue {
  timeMin: string;
  description: string;
}

type PhasesState = Record<string, PhaseValue>;

const emptyPhases = (): PhasesState =>
  PHASES.reduce((acc, p) => {
    acc[p.key] = { timeMin: "", description: "" };
    return acc;
  }, {} as PhasesState);

interface ScheduledOccurrence {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string;
  className?: string;
  room?: string;
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
    searchParams.get("start") ? `${searchParams.get("start")}-${searchParams.get("end") ?? ""}` : "",
  );

  const [dbSlots, setDbSlots] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("class_schedule_slots" as any)
      .select("*, classes(name)")
      .then(({ data }) => setDbSlots((data as any[]) ?? []));
  }, [user]);

  /** All upcoming occurrences (next 8 weeks) for the chosen subject */
  const occurrences = useMemo<ScheduledOccurrence[]>(() => {
    if (!subject) return [];
    const from = startOfDay(new Date());
    const to = addDays(from, 8 * 7);
    const personal = expandTeacherSchedule(loadSchedule(), from, to);
    const dbExpanded = expandScheduleSlots(dbSlots as any, from, to);
    const all = [...personal, ...dbExpanded].filter(
      (e) => (e.subject ?? "").trim().toLowerCase() === subject.trim().toLowerCase(),
    );
    const seen = new Set<string>();
    const list: ScheduledOccurrence[] = [];
    for (const e of all.sort((a, b) => a.start.getTime() - b.start.getTime())) {
      const key = `${format(e.start, "yyyy-MM-dd")}-${formatTime(e.start)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        date: format(e.start, "yyyy-MM-dd"),
        start: formatTime(e.start),
        end: formatTime(e.end),
        className: e.className,
        room: e.room,
      });
    }
    return list;
  }, [subject, dbSlots]);

  /** Distinct dates available for the chosen subject */
  const availableDates = useMemo(() => {
    const set = new Map<string, ScheduledOccurrence>();
    for (const o of occurrences) if (!set.has(o.date)) set.set(o.date, o);
    return Array.from(set.keys());
  }, [occurrences]);

  /** Time slots for the selected date */
  const timeSlotsForDate = useMemo(
    () => occurrences.filter((o) => o.date === linkedDate),
    [occurrences, linkedDate],
  );

  // Pre-fill abbreviation/colors not needed here. Auto-set title from subject if untouched.
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

  function handleSave() {
    toast({
      title: "Plán uložen",
      description: subject
        ? `Předmět: ${subject}${linkedDate ? `, ${format(new Date(linkedDate), "d. M. yyyy", { locale: cs })}` : ""}${linkedTime ? `, ${linkedTime.replace("-", " – ")}` : ""}`
        : "Ukládání do databáze bude doplněno.",
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        {/* Top bar */}
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

          {/* Předmět */}
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
            <p className="text-xs text-muted-foreground">
              Plán bude propojený s tímto předmětem v rozvrhu i v kalendáři.
            </p>
          </div>

          {/* Propojení s konkrétní hodinou v rozvrhu */}
          {subject && (
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
                      placeholder={
                        linkedDate ? "Vyber čas…" : "Nejprve vyber datum"
                      }
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
              </div>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
