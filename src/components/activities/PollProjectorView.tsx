import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pollOptionId, type PollOption } from "@/lib/poll-options";

export type { PollOption } from "@/lib/poll-options";

interface Props {
  question: string;
  options: PollOption[];
  sessionId: string;
  questionIndex: number;
  totalPlayers?: number;
  darkMode?: boolean;
  /** Guest/student access token – guests cannot read the table directly. */
  joinToken?: string | null;
  /** Velké promítací rozvržení (projektor): vlastní světlá karta, písmo čitelné z dálky. */
  projector?: boolean;
}

const COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981"];

const PollProjectorView = ({
  question,
  options,
  sessionId,
  questionIndex,
  totalPlayers = 0,
  darkMode = false,
  joinToken,
  projector = false,
}: Props) => {
  const [votes, setVotes] = useState<Record<string, number>>({});

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase.rpc("get_activity_responses" as any, {
      _session_id: sessionId,
      _question_index: questionIndex,
      _join_token: joinToken || null,
    });

    const counts: Record<string, number> = {};
    options.forEach((option, index) => {
      counts[pollOptionId(option, index)] = 0;
    });
    ((data as any[]) || []).forEach((r: any) => {
      const selected: unknown[] = Array.isArray(r.answer?.selectedOptions)
        ? r.answer.selectedOptions
        : [];
      selected.forEach((id) => {
        if (id === null || id === undefined) return;
        const optionId = String(id);
        if (Object.prototype.hasOwnProperty.call(counts, optionId)) counts[optionId]++;
      });
    });
    setVotes(counts);
  }, [sessionId, questionIndex, options, joinToken]);

  useEffect(() => {
    fetchVotes();
    const channel = supabase
      .channel(`poll-${sessionId}-${questionIndex}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_responses",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const r = payload.new as any;
          if (r.question_index === questionIndex) fetchVotes();
        }
      )
      .subscribe();

    const interval = setInterval(fetchVotes, 2000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionId, questionIndex, fetchVotes]);

  const maxVotes = Math.max(...Object.values(votes), 1);
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  if (projector) {
    return (
      <div data-testid="poll-projector-results" className="flex min-h-0 w-full flex-1 items-center justify-center py-4">
        <div className="w-full max-w-[1300px] rounded-3xl bg-white/95 px-12 py-8 text-slate-900 shadow-2xl">
          <p className="mb-6 text-center text-[1.75rem] font-semibold text-slate-600">
            {totalVotes} hlasů{totalPlayers > 0 ? ` z ${totalPlayers} žáků` : ""}
          </p>
          <div className="space-y-5">
            {options.map((option, i) => {
              const optionId = pollOptionId(option, i);
              const count = votes[optionId] || 0;
              const widthPct = totalVotes > 0 ? (count / maxVotes) * 100 : 0;
              const sharePct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={optionId} data-testid="poll-projector-row">
                  <div className="mb-2 flex items-baseline justify-between gap-6 text-[2.25rem] font-bold leading-tight">
                    <span className="min-w-0 break-words">{option.text}</span>
                    <span className="shrink-0 tabular-nums">{sharePct} % <span className="text-[1.5rem] font-semibold text-slate-600">({count})</span></span>
                  </div>
                  <div className="h-12 overflow-hidden rounded-xl bg-slate-200">
                    <div className="h-full rounded-xl transition-all duration-500 ease-out motion-reduce:transition-none" style={{ width: `${widthPct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const titleColor = darkMode ? "#ffffff" : "hsl(var(--foreground))";
  const subColor = darkMode ? "rgba(255,255,255,0.7)" : "hsl(var(--muted-foreground))";
  const trackColor = darkMode ? "rgba(255,255,255,0.1)" : "hsl(var(--muted))";

  return (
    <div className="w-full max-w-4xl mx-auto">
      {question && (
        <h2
          className="text-2xl md:text-3xl font-bold mb-2 text-center"
          style={{ color: titleColor }}
        >
          {question}
        </h2>
      )}
      <p className="text-sm mb-6 text-center" style={{ color: subColor }}>
        {totalVotes} hlasů{totalPlayers > 0 ? ` z ${totalPlayers} žáků` : ""}
      </p>
      <div className="space-y-3">
        {options.map((option, i) => {
          const optionId = pollOptionId(option, i);
          const count = votes[optionId] || 0;
          const widthPct = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
          const sharePct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const color = COLORS[i % COLORS.length];
          return (
            <div key={optionId}>
              <div
                className="flex justify-between items-baseline mb-1.5 text-sm md:text-base font-medium"
                style={{ color: titleColor }}
              >
                <span>{option.text}</span>
                <span style={{ color: subColor }}>
                  {count} ({sharePct}%)
                </span>
              </div>
              <div
                className="h-8 rounded-lg overflow-hidden"
                style={{ background: trackColor }}
              >
                <div
                  className="h-full rounded-lg transition-all duration-500 ease-out"
                  style={{ width: `${widthPct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PollProjectorView;
