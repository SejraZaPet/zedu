import { Link } from "react-router-dom";
import { Trophy, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyLeague } from "@/hooks/useMyLeague";
import { tierName, weekEnd } from "@/lib/league-rules";

const LEAGUE_HREF = "/student/zebricek?tab=liga";

const countdown = (end: Date) => {
  const ms = Math.max(0, end.getTime() - Date.now());
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
};

/** Karta „Moje liga"; vykreslí se jen se zapnutou ligou (u opted_out jen krátký text). */
const MyLeagueCard = () => {
  const { user } = useAuth();
  const { rows, status } = useMyLeague(user?.id);

  if (!rows || !status) return null;

  if (status === "opted_out") {
    return (
      <p className="mb-6 text-sm text-muted-foreground">
        Liga je vypnutá, zapnout ji můžeš v{" "}
        <Link to={LEAGUE_HREF} className="underline underline-offset-2 hover:text-foreground">záložce Liga</Link>.
      </p>
    );
  }
  if (status !== "ok") return null;
  const me = rows.find((r) => r.is_me);
  if (!me) return null;

  return (
    <Link
      to={LEAGUE_HREF}
      aria-label={`Moje liga: ${tierName(me.tier ?? 0)}, ${me.rank}. místo z ${me.group_size}, ${me.xp ?? 0} XP tento týden`}
      className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 min-h-[44px] hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Trophy className="w-5 h-5 text-primary shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-medium">Moje liga: {tierName(me.tier ?? 0)}</span>
        <span className="text-muted-foreground"> · {me.rank}. místo z {me.group_size} · {me.xp ?? 0} XP tento týden</span>
      </div>
      <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" aria-hidden /> konec za {countdown(weekEnd(me.week_start))}
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden />
    </Link>
  );
};

export default MyLeagueCard;
