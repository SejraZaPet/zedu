import { Trophy, Users } from "lucide-react";
import ActivityTaskPreview from "@/components/live/ActivityTaskPreview";
import { McqCountdown } from "@/components/live/LiveMcqWidgets";
import { soloRoundItemLabel, soloRoundTeamScores, summarizeSoloRound } from "@/lib/solo-round";

interface Props {
  session: any;
  currentSlide: any;
  currentIndex: number;
  players: any[];
  responses: any[];
}

/** Společný projekční průběh a hromadný výsledek samostatného kola. */
export default function SoloRoundProjector({ session, currentSlide, currentIndex, players, responses }: Props) {
  const spec = currentSlide.activitySpec;
  const current = responses.filter((r) => r.question_index === currentIndex);
  const results = session?.status === "question_results";
  const race = session?.settings?.gameMode === "race";
  const stats = summarizeSoloRound(current, players.length);
  const leaderboard = [...players].sort((a, b) => b.total_score - a.total_score).slice(0, 5);
  const teamsActive = (session?.settings?.teamModeKind ?? "none") !== "none" && currentSlide?.gameSettings?.teamMode !== "none";
  const teams = teamsActive ? soloRoundTeamScores(session?.teams?.teams ?? [], players, current) : [];

  if (!results) {
    return (
      <div className="flex w-full max-w-6xl flex-col items-center gap-5 px-6">
        <div className="rounded-full bg-primary/15 px-5 py-2 font-heading text-xl font-semibold text-primary">Samostatné kolo</div>
        <div className="w-full rounded-2xl border border-border bg-card/90 p-6">
          <ActivityTaskPreview spec={spec} />
        </div>
        {!race && session?.status === "playing" && <div className="w-full max-w-md"><McqCountdown session={session} active size="lg" /></div>}
        <p className="text-2xl font-semibold">Pracujte na telefonu</p>
        <p className="text-xl text-muted-foreground" aria-live="polite">{stats.answeredCount} z {stats.playerCount} hotovo</p>
        {race && <p className="text-sm text-muted-foreground">Závod pokračuje vlastním tempem žáků.</p>}
      </div>
    );
  }

  return (
    <div className="grid max-h-full w-full max-w-7xl grid-cols-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-border bg-card/95 p-5 text-card-foreground">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Průměrná úspěšnost třídy</p>
          <p className="text-5xl font-bold text-primary">{stats.averageSuccessRate ?? 0} %</p>
          <p className="text-sm text-muted-foreground">{stats.answeredCount} z {stats.playerCount} odeslalo</p>
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold">Nejčastější chyby</h2>
          {stats.mostMissed.length ? (
            <ol className="mt-2 space-y-1 text-sm">
              {stats.mostMissed.map((item) => <li key={item.index}>{soloRoundItemLabel(spec, item.index)} <span className="text-muted-foreground">· {item.count}×</span></li>)}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Žádné chybné položky.</p>}
        </div>
        {spec.showSolution !== false && (
          <div className="space-y-2 border-t border-border pt-3">
            <h2 className="font-heading text-lg font-semibold">Správné řešení</h2>
            <ActivityTaskPreview spec={spec} showSolution />
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card/95 p-5 text-card-foreground">
        {teamsActive ? (
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Users className="h-5 w-5" /> Týmový žebříček</h2>
            <ol className="mt-3 space-y-2">
              {teams.map((row, index) => {
                const team = (session?.teams?.teams ?? []).find((t: any) => String(t.id) === row.teamId);
                return (
                  <li key={row.teamId} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                    <span className="w-6 font-bold">{index + 1}.</span>
                    <span className="flex-1 font-medium">{team?.name ?? "Tým"}</span>
                    <span className="text-primary">+{row.roundScore}</span>
                    <span className="font-mono font-bold">{row.totalScore}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Za kolo a celkem; vždy průměr na člena týmu.</p>
          </div>
        ) : (
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Trophy className="h-5 w-5" /> Žebříček s přičtenými body</h2>
            <ol className="mt-3 space-y-2">
              {leaderboard.map((player, index) => {
                const answer = current.find((r) => r.player_id === player.id);
                return (
                  <li key={player.id} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                    <span className="w-6 font-bold">{index + 1}.</span>
                    <span className="flex-1 truncate font-medium">{player.nickname}</span>
                    <span className="text-primary">+{Number(answer?.score) || 0}</span>
                    <span className="font-mono font-bold">{player.total_score}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
