import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, BookOpen, Printer, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import UpcomingScheduleChanges from "@/components/calendar/UpcomingScheduleChanges";
import { DEFAULT_PERIOD_TIMES } from "@/lib/teacher-schedule-store";
import {
  getSubjectAbbreviation,
  getSubjectColor,
  getSubjectName,
} from "@/lib/subject-appearance";

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const DAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá"];

type ParityTab = "both" | "odd" | "even";

interface ClassSlot {
  id: string;
  class_id: string | null;
  group_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  subject_label: string | null;
  abbreviation: string | null;
  color: string | null;
  room: string | null;
  textbook_id: string | null;
  classes?: { name: string } | null;
  subject_groups?: { name?: string | null } | null;
  subjects?: { name?: string | null; color?: string | null; abbreviation?: string | null } | null;
}

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${parseInt(h, 10)}:${m}`;
};

const toMin = (t: string): number => {
  if (!t) return -1;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};

export default function StudentSchedule() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ParityTab>("both");
  const [mobileDay, setMobileDay] = useState(() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? d - 1 : 0;
  });
  const [studentName, setStudentName] = useState("");
  const [classNames, setClassNames] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name,last_name,email")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        const n = `${prof?.first_name ?? ""} ${prof?.last_name ?? ""}`.trim();
        setStudentName(n || prof?.email || user.email || "");
      }

      const [{ data: members }, { data: gm }] = await Promise.all([
        supabase.from("class_members").select("class_id").eq("user_id", user.id),
        supabase
          .from("subject_group_members")
          .select("group_id")
          .eq("student_id", user.id),
      ]);
      const classIds = (members ?? []).map((r: any) => r.class_id);
      const groupIds = (gm ?? []).map((r: any) => r.group_id);
      if (classIds.length === 0 && groupIds.length === 0) {
        if (!cancelled) {
          setSlots([]);
          setClassNames([]);
          setLoading(false);
        }
        return;
      }

      const select =
        "*, classes(name), subjects(name, color, abbreviation), subject_groups(name)";
      const [classSlotsRes, groupSlotsRes] = await Promise.all([
        classIds.length
          ? supabase
              .from("class_schedule_slots" as any)
              .select(select)
              .in("class_id", classIds)
          : Promise.resolve({ data: [] as any[] }),
        groupIds.length
          ? supabase
              .from("class_schedule_slots" as any)
              .select(select)
              .in("group_id", groupIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (cancelled) return;
      const merged = [
        ...(((classSlotsRes as any).data as any[]) ?? []),
        ...(((groupSlotsRes as any).data as any[]) ?? []),
      ];
      const byId = new Map<string, any>();
      for (const r of merged) byId.set(r.id, r);
      const list = Array.from(byId.values()).sort(
        (a, b) =>
          a.day_of_week - b.day_of_week ||
          toMin((a.start_time || "").slice(0, 5)) -
            toMin((b.start_time || "").slice(0, 5)),
      ) as ClassSlot[];
      setSlots(list);
      const names = Array.from(
        new Set(
          list
            .map((s) => s.classes?.name ?? (s as any).subject_groups?.name)
            .filter(Boolean) as string[],
        ),
      );
      setClassNames(names);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleSlots = useMemo(() => {
    if (activeTab === "both") return slots;
    return slots.filter((s) => s.week_parity === "every" || s.week_parity === activeTab);
  }, [slots, activeTab]);

  const periods = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);

  const slotsByCell = useMemo(() => {
    const m = new Map<string, ClassSlot[]>();
    const periodInfo = periods.map((p) => {
      const t = DEFAULT_PERIOD_TIMES[p];
      return { period: p, start: toMin(t.start), end: toMin(t.end) };
    });
    for (const s of visibleSlots) {
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
    for (const arr of m.values()) {
      arr.sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    }
    return m;
  }, [visibleSlots, periods]);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center justify-between mb-6 print-hide">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Rozvrh hodin</h1>
              <p className="text-sm text-muted-foreground">
                {classNames.length > 0
                  ? `Tvůj rozvrh ze tříd: ${classNames.join(", ")}`
                  : "Nejsi zatím v žádné třídě."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" /> Tisk rozvrhu
          </Button>
        </div>

        <div className="print-hide"><UpcomingScheduleChanges slots={slots} /></div>

        {/* Parity tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap print-hide">
          {(["both", "odd", "even"] as ParityTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              }`}
            >
              {tab === "both" ? "Oba týdny" : tab === "odd" ? "Lichý týden" : "Sudý týden"}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden print-area">
          <div className="print-show px-4 py-3 border-b border-border">
            <h2 className="text-xl font-bold">Rozvrh hodin</h2>
            <div className="text-sm text-muted-foreground mt-1">
              {studentName}
              {activeTab !== "both" && (
                <span> · {activeTab === "odd" ? "Lichý týden" : "Sudý týden"}</span>
              )}
              {activeTab === "both" && <span> · Oba týdny</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 print-hide">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="font-medium text-sm">Týdenní rozvrh</h2>
            <Badge variant="secondary" className="text-[10px]">
              {visibleSlots.length} hodin
            </Badge>
          </div>

          {/* Mobil: jeden den jako seznam, přepínač dne */}
          <div className="md:hidden print-hide" data-testid="schedule-mobile-day">
            <div role="tablist" aria-label="Den v týdnu" className="grid grid-cols-5 gap-1 p-2 border-b border-border">
              {DAYS_SHORT.map((d, i) => (
                <button key={d} type="button" role="tab" aria-selected={mobileDay === i} aria-label={DAYS[i]}
                  onClick={() => setMobileDay(i)}
                  className={`min-h-11 rounded-md text-sm font-semibold border transition-colors ${mobileDay === i ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                  {d}
                </button>
              ))}
            </div>
            <h3 className="px-3 pt-3 text-sm font-semibold">{DAYS[mobileDay]}</h3>
            <ul className="p-3 space-y-2">
              {periods.flatMap((period) => (slotsByCell.get(`${mobileDay}-${period}`) ?? []).map((slot) => (
                <li key={slot.id} className="flex gap-2">
                  <span className="w-8 shrink-0 pt-2 text-sm font-semibold text-muted-foreground">{period}.</span>
                  <div className="min-w-0 flex-1"><ReadOnlyClassCard slot={slot} navigate={navigate} wide /></div>
                </li>
              )))}
              {periods.every((p) => !(slotsByCell.get(`${mobileDay}-${p}`)?.length)) && (
                <li className="text-sm text-muted-foreground">Tento den nemáš žádné hodiny.</li>
              )}
            </ul>
          </div>

          <div className="w-full hidden md:block print:block">
            <div
              className="grid w-full"
              style={{ gridTemplateColumns: `44px repeat(5, minmax(0, 1fr))` }}
            >
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

              {periods.map((period) => {
                const t = DEFAULT_PERIOD_TIMES[period];
                return (
                  <div key={`row-${period}`} className="contents">
                    <div className="border-t border-border bg-muted/10 px-2 py-2 flex flex-col items-center justify-center text-center">
                      <span className="text-sm font-semibold leading-none">{period}.</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        hod
                      </span>
                      {t && (
                        <span className="text-[10px] text-muted-foreground tabular-nums mt-1">
                          {fmtTime(t.start)}
                        </span>
                      )}
                    </div>
                    {[0, 1, 2, 3, 4].map((dayIdx) => {
                      const list = slotsByCell.get(`${dayIdx}-${period}`) ?? [];
                      return (
                        <div
                          key={`c-${period}-${dayIdx}`}
                          className="border-t border-l border-border p-1.5 min-h-[84px] flex"
                        >
                          {list.length > 0 ? (
                            <div className="w-full flex flex-col gap-1">
                              {list.map((slot) => (
                                <ReadOnlyClassCard key={slot.id} slot={slot} navigate={navigate} />
                              ))}
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

        {!loading && slots.length === 0 && (
          <p className="text-sm text-muted-foreground mt-6 text-center">
            Tvoje třída zatím nemá žádný rozvrh. Zeptej se učitele.
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ReadOnlyClassCard({
  slot,
  navigate,
  wide = false,
}: {
  slot: ClassSlot;
  navigate: (path: string) => void;
  wide?: boolean;
}) {
  const canonical = slot.subjects ?? null;
  const subject = getSubjectName(slot, canonical, "Hodina");
  const color = getSubjectColor(slot, canonical, subject);
  const abbr = getSubjectAbbreviation(slot, canonical, subject);
  const className = slot.classes?.name ?? slot.subject_groups?.name ?? "";
  const canNavigate = !!slot.subject_label && !!(slot.group_id || slot.class_id);
  return (
    <button
      type="button"
      disabled={!canNavigate}
      onClick={() =>
        canNavigate &&
        navigate(
          slot.group_id
            ? `/student/predmet/${encodeURIComponent(slot.subject_label!)}/skupina/${slot.group_id}`
            : `/student/predmet/${encodeURIComponent(slot.subject_label!)}/trida/${slot.class_id}`,
        )
      }
      className={`w-full min-w-0 overflow-hidden text-left rounded-md p-2 border-l-4 transition-all ${
        canNavigate ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
      }`}
      style={{ backgroundColor: `${color}26`, borderLeftColor: color }}
      title={`${subject}${className ? ` · ${className}` : ""}${slot.room ? ` · ${slot.room}` : ""} · ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)}${slot.week_parity !== "every" ? ` (${slot.week_parity === "odd" ? "lichý" : "sudý"} týden)` : ""}`}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
        <Clock className="w-3 h-3 shrink-0" />
        {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
      </div>
      {slot.week_parity !== "every" && (
        <div className="mt-0.5">
          <span className="inline-block rounded border border-border bg-card px-1 text-[10px] leading-4 text-muted-foreground">
            {slot.week_parity === "odd" ? "lichý" : "sudý"}
          </span>
        </div>
      )}
      <div className="mt-0.5 min-w-0">
        <span
          className="inline-flex max-w-full items-center justify-center text-xs font-bold text-white px-2 py-0.5 rounded"
          style={{ backgroundColor: color }}
        >
          <span className="truncate">{abbr}</span>
        </span>
        <span className={`${wide ? "ml-1 inline" : "hidden xl:block mt-0.5 truncate"} text-xs font-medium`}>{subject}</span>
      </div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
        <Users className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{className}</span>
        {slot.room && <span className="shrink-0">· {slot.room}</span>}
      </div>
      {slot.textbook_id && (
        <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
          <BookOpen className="w-2.5 h-2.5" />
          <span className="truncate">učebnice propojena</span>
        </div>
      )}
    </button>
  );
}
