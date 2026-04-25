import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PollOption {
  id: string;
  text: string;
}

interface Props {
  question: string;
  options: PollOption[];
  sessionId: string;
  questionIndex: number;
  totalPlayers?: number;
  darkMode?: boolean;
}

const COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981"];

const PollProjectorView = ({
  question,
  options,
  sessionId,
  questionIndex,
  totalPlayers = 0,
  darkMode = false,
}: Props) => {
  const [votes, setVotes] = useState<Record<string, number>>({});

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from("game_responses")
      .select("answer")
      .eq("session_id", sessionId)
      .eq("question_index", questionIndex);

    const counts: Record<string, number> = {};
    options.forEach((o) => (counts[o.id] = 0));
    (data || []).forEach((r: any) => {
      const selected: string[] = r.answer?.selectedOptions || [];
      selected.forEach((id) => {
        if (counts[id] !== undefined) counts[id]++;
      });
    });
    setVotes(counts);
  }, [sessionId, questionIndex, options]);

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
          const count = votes[option.id] || 0;
          const widthPct = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
          const sharePct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const color = COLORS[i % COLORS.length];
          return (
            <div key={option.id}>
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
