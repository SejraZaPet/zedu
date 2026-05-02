import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Clock, ExternalLink } from "lucide-react";

const DAY_LABELS = ["", "Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

interface SlotRow {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  subject_label: string | null;
  room: string | null;
  textbook_id: string | null;
  textbook_type: string | null;
  classes?: { name: string } | null;
}

const fmt = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${parseInt(h, 10)}:${m}`;
};

/**
 * Read-only panel showing all class lessons (across all teacher's classes)
 * synchronized from class_schedule_slots. Editing happens in the class
 * schedule dialog (Třídy → ikona hodin).
 */
const ClassScheduleSummary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Get classes the teacher belongs to
      const { data: ct } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("user_id", user.id);
      const classIds = (ct ?? []).map((r: any) => r.class_id);
      if (classIds.length === 0) {
        if (!cancelled) {
          setSlots([]);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("class_schedule_slots" as any)
        .select("*, classes(name)")
        .in("class_id", classIds)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (!cancelled) {
        setSlots((data as any) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const byDay = useMemo(() => {
    const m = new Map<number, SlotRow[]>();
    for (let d = 1; d <= 5; d++) m.set(d, []);
    for (const s of slots) {
      if (s.day_of_week < 1 || s.day_of_week > 5) continue;
      m.get(s.day_of_week)!.push(s);
    }
    return m;
  }, [slots]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
        Načítání hodin tříd…
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-medium text-sm">Hodiny z mých tříd</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Zatím nemáte naplánované žádné hodiny ve třídách. Přidejte je v sekci{" "}
          <button
            className="text-primary underline underline-offset-2"
            onClick={() => navigate("/ucitel/tridy")}
          >
            Třídy
          </button>{" "}
          přes ikonu hodin.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-medium text-sm">Hodiny z mých tříd</h2>
          <Badge variant="secondary" className="text-[10px]">
            {slots.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => navigate("/ucitel/tridy")}
        >
          Spravovat <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
        {[1, 2, 3, 4, 5].map((d) => {
          const dayItems = byDay.get(d) ?? [];
          return (
            <div key={d} className="p-3 min-h-[80px]">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {DAY_LABELS[d]}
              </div>
              {dayItems.length === 0 ? (
                <div className="text-xs text-muted-foreground/60">—</div>
              ) : (
                <div className="space-y-1.5">
                  {dayItems.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md border border-border/60 bg-background/50 p-1.5 text-xs"
                      title={`${s.classes?.name ?? ""} · ${s.subject_label ?? ""}`}
                    >
                      <div className="flex items-center gap-1 text-muted-foreground tabular-nums">
                        <Clock className="w-3 h-3" />
                        {fmt(s.start_time)}–{fmt(s.end_time)}
                        {s.week_parity !== "every" && (
                          <span className="ml-1 text-[10px]">
                            ({s.week_parity === "odd" ? "lichý" : "sudý"})
                          </span>
                        )}
                      </div>
                      <div className="font-medium truncate mt-0.5">
                        {s.subject_label || "Hodina"}
                      </div>
                      <div className="text-muted-foreground truncate flex items-center gap-1">
                        <span className="truncate">{s.classes?.name}</span>
                        {s.room && <span className="shrink-0">· {s.room}</span>}
                      </div>
                      {s.textbook_id && (
                        <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
                          <BookOpen className="w-2.5 h-2.5" />
                          <span className="truncate">propojeno s učebnicí</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClassScheduleSummary;
