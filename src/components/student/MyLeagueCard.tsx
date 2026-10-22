import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tierName, weekEnd } from "@/lib/league-rules";

interface Row { status: string; rank: number | null; is_me: boolean | null; tier: number | null; group_size: number | null; week_start: string }

const countdown = (end: Date) => {
  const ms = Math.max(0, end.getTime() - Date.now());
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
};

/** Malá karta ligy; bez zapnuté ligy, v demu nebo po odhlášení se nevykreslí. */
const MyLeagueCard = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.rpc("school_league_week" as any).then(({ data, error }) => {
      if (alive) setRows(error ? [] : ((data as Row[]) ?? []));
    });
    return () => { alive = false; };
  }, []);

  if (!rows || rows[0]?.status !== "ok") return null;
  const me = rows.find((r) => r.is_me);
  if (!me) return null;

  return (
    <Link
      to="/student/zebricek"
      className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Trophy className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-medium">Moje liga: {tierName(me.tier ?? 0)}</span>
        <span className="text-muted-foreground"> · {me.rank}. místo z {me.group_size}</span>
      </div>
      <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" /> konec za {countdown(weekEnd(me.week_start))}
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
};

export default MyLeagueCard;
