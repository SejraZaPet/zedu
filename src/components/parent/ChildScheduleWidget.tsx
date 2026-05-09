import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Clock } from "lucide-react";
import { DEFAULT_PERIOD_TIMES, colorForSubject } from "@/lib/teacher-schedule-store";

const DAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá"];

interface MiniSlot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  subject_label: string | null;
  abbreviation: string | null;
  color: string | null;
}

interface Props {
  studentIds: string[];
  studentNames: Record<string, string>;
}

const toMin = (t: string): number => {
  if (!t) return -1;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${parseInt(h, 10)}:${m}`;
};

const ChildScheduleWidget = ({ studentIds, studentNames }: Props) => {
  const [activeChild, setActiveChild] = useState<string>(studentIds[0] || "");
  const [slots, setSlots] = useState<MiniSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentIds.includes(activeChild)) {
      setActiveChild(studentIds[0] || "");
    }
  }, [studentIds, activeChild]);

  useEffect(() => {
    if (!activeChild) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", activeChild);
      const classIds = (members ?? []).map((m: any) => m.class_id);
      if (classIds.length === 0) {
        if (!cancelled) {
          setSlots([]);
          setLoading(false);
        }
        return;
      }
      const { data: rows } = await supabase
        .from("class_schedule_slots" as any)
        .select("id, class_id, day_of_week, start_time, end_time, week_parity, subject_label, abbreviation, color")
        .in("class_id", classIds)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (!cancelled) {
        setSlots(((rows as any) || []) as MiniSlot[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeChild]);

  const periods = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);

  const slotsByCell = useMemo(() => {
    const m = new Map<string, MiniSlot[]>();
    const periodInfo = periods.map((p) => {
      const t = DEFAULT_PERIOD_TIMES[p];
      return { period: p, start: toMin(t.start), end: toMin(t.end) };
    });
    for (const s of slots) {
      const dayIdx = s.day_of_week - 1;
      if (dayIdx < 0 || dayIdx > 4) continue;
      const slotStart = toMin((s.start_time || "").slice(0, 5));
      if (slotStart < 0) continue;
      let chosen = periodInfo.find((p) => slotStart >= p.start && slotStart < p.end);
      if (!chosen) {
        chosen = periodInfo.reduce(
          (best, p) =>
            Math.abs(p.start - slotStart) < Math.abs(best.start - slotStart) ? p : best,
          periodInfo[0],
        );
      }
      const key = `${dayIdx}-${chosen.period}`;
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return m;
  }, [slots, periods]);

  const usedPeriods = useMemo(() => {
    let last = 0;
    for (const key of slotsByCell.keys()) {
      const p = parseInt(key.split("-")[1], 10);
      if (p > last) last = p;
    }
    const max = Math.max(last, 5);
    return periods.filter((p) => p <= max);
  }, [slotsByCell, periods]);

  if (studentIds.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-foreground leading-tight">
              Rozvrh dítěte
            </h3>
            <p className="text-[11px] text-muted-foreground">Týdenní přehled hodin</p>
          </div>
        </div>

        {studentIds.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {studentIds.map((sid) => (
              <button
                key={sid}
                onClick={() => setActiveChild(sid)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  activeChild === sid
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`}
              >
                {studentNames[sid] || "Dítě"}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Načítám rozvrh…</p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Pro vybrané dítě zatím není dostupný žádný rozvrh.
        </p>
      ) : (
        <div className="overflow-hidden border border-border rounded-lg">
          <div
            className="grid w-full"
            style={{ gridTemplateColumns: `28px repeat(5, minmax(0, 1fr))` }}
          >
            <div className="bg-muted/30 border-b border-border" />
            {[0, 1, 2, 3, 4].map((dayIdx) => (
              <div
                key={`h-${dayIdx}`}
                className="bg-muted/30 border-b border-l border-border px-1 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center"
              >
                {DAYS_SHORT[dayIdx]}
              </div>
            ))}

            {usedPeriods.map((period) => {
              const t = DEFAULT_PERIOD_TIMES[period];
              return (
                <div key={`row-${period}`} className="contents">
                  <div className="border-t border-border bg-muted/10 px-0.5 py-1 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-semibold leading-none">{period}.</span>
                    {t && (
                      <span className="text-[9px] text-muted-foreground tabular-nums leading-tight">
                        {fmtTime(t.start).split(":")[0]}h
                      </span>
                    )}
                  </div>
                  {[0, 1, 2, 3, 4].map((dayIdx) => {
                    const list = slotsByCell.get(`${dayIdx}-${period}`) ?? [];
                    return (
                      <div
                        key={`c-${period}-${dayIdx}`}
                        className="border-t border-l border-border p-0.5 min-h-[36px] flex"
                      >
                        {list.length > 0 ? (
                          <div className="w-full flex flex-col gap-0.5">
                            {list.map((slot) => {
                              const subject = slot.subject_label || "—";
                              const color = slot.color || colorForSubject(subject);
                              const abbr = (slot.abbreviation || subject.slice(0, 3)).toUpperCase();
                              return (
                                <div
                                  key={slot.id}
                                  className="rounded text-center text-[10px] font-bold text-white px-1 py-0.5 leading-tight"
                                  style={{ backgroundColor: color }}
                                  title={`${subject} · ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)}${
                                    slot.week_parity !== "every"
                                      ? ` (${slot.week_parity === "odd" ? "lichý" : "sudý"} týden)`
                                      : ""
                                  }`}
                                >
                                  {abbr}
                                </div>
                              );
                            })}
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
      )}

      {slots.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Zkratky předmětů a barvy podle nastavení třídy.
        </p>
      )}
    </div>
  );
};

export default ChildScheduleWidget;
