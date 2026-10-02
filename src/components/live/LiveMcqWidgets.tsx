/**
 * Živá hra – MCQ: odpočet, pořadí za otázku a průběžný žebříček.
 * Čistě prezentační; data přicházejí z useGameSession.
 */
import { useEffect, useState } from "react";
import { Timer, Trophy } from "lucide-react";
import { serverTsToClientMs } from "@/lib/clock-sync";
import { liveQuestionTimeLimitMs } from "@/lib/live-mcq";

export const useMcqCountdown = (session: any, active: boolean) => {
  const limit = liveQuestionTimeLimitMs(session?.settings);
  const startedIso = session?.question_started_at as string | undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !limit || !startedIso) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active, limit, startedIso]);
  if (!active || !limit || !startedIso) return null;
  const end = serverTsToClientMs(startedIso) + limit;
  return { remainingMs: Math.max(0, end - now), limitMs: limit };
};

export const McqCountdown = ({
  session,
  active,
  size = "md",
}: {
  session: any;
  active: boolean;
  size?: "md" | "lg";
}) => {
  const cd = useMcqCountdown(session, active);
  if (!cd) return null;
  const sec = Math.ceil(cd.remainingMs / 1000);
  const pct = (cd.remainingMs / cd.limitMs) * 100;
  const urgent = sec <= 5;
  return (
    <div className="w-full space-y-1.5" role="timer" aria-live="off" aria-label={`Zbývá ${sec} sekund`}>
      <div className={`flex items-center justify-center gap-2 font-bold tabular-nums ${size === "lg" ? "text-4xl" : "text-2xl"} ${urgent ? "text-destructive" : "text-foreground"}`}>
        <Timer className={size === "lg" ? "h-9 w-9" : "h-6 w-6"} aria-hidden />
        {sec} s
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${urgent ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

interface BoardProps {
  players: any[];
  responses: any[];
  questionIndex: number;
  slides: any[];
}

/** Pořadí za aktuální otázku + průběžný žebříček napříč MCQ otázkami. */
export const McqResultsBoard = ({ players, responses, questionIndex, slides }: BoardProps) => {
  const name = (pid: string) => players.find((p) => p.id === pid)?.nickname || "Žák";
  const mcqIdx = new Set(
    slides.map((s, i) => (s?.type === "activity" && s?.activitySpec?.activityType === "mcq" ? i : -1)).filter((i) => i >= 0),
  );

  const round = responses
    .filter((r) => r.question_index === questionIndex)
    .sort((a, b) => {
      if (!!b.is_correct !== !!a.is_correct) return b.is_correct ? 1 : -1;
      return (a.response_time_ms ?? Infinity) - (b.response_time_ms ?? Infinity);
    })
    .slice(0, 5);

  const totals = new Map<string, number>();
  players.forEach((p) => totals.set(p.id, 0));
  responses
    .filter((r) => mcqIdx.has(r.question_index) && r.question_index <= questionIndex)
    .forEach((r) => totals.set(r.player_id, (totals.get(r.player_id) || 0) + (r.score || 0)));
  const overall = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="grid w-full max-w-5xl gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur">
        <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
          <Timer className="h-5 w-5 text-primary" aria-hidden /> Tahle otázka
        </h3>
        {round.length === 0 ? (
          <p className="text-muted-foreground">Nikdo neodpověděl.</p>
        ) : (
          <ol className="space-y-1.5">
            {round.map((r, i) => (
              <li key={r.id ?? i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5 text-lg">
                <span className="truncate font-semibold text-foreground">
                  {i + 1}. {name(r.player_id)}
                </span>
                <span className={`shrink-0 tabular-nums ${r.is_correct ? "text-primary" : "text-destructive"}`}>
                  {r.is_correct ? "✓" : "✗"} {((r.response_time_ms ?? 0) / 1000).toFixed(1)} s
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur">
        <h3 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
          <Trophy className="h-5 w-5 text-primary" aria-hidden /> Celkové pořadí
        </h3>
        {overall.length === 0 ? (
          <p className="text-muted-foreground">Zatím bez bodů.</p>
        ) : (
          <ol className="space-y-1.5">
            {overall.map(([pid, pts], i) => (
              <li key={pid} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5 text-lg">
                <span className="truncate font-semibold text-foreground">
                  {i + 1}. {name(pid)}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">{pts} b.</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
