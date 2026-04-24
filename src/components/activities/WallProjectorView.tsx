import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Response {
  id: string;
  text: string;
  nickname?: string;
  created_at: string;
}

interface Props {
  sessionId: string;
  questionIndex: number;
  anonymous: boolean;
  published?: boolean;
}

const WallProjectorView = ({ sessionId, questionIndex, anonymous, published = false }: Props) => {
  const [responses, setResponses] = useState<Response[]>([]);

  const loadResponses = useCallback(async () => {
    const { data } = await supabase
      .from("game_responses")
      .select("id, answer, created_at, player_id, game_players(nickname)")
      .eq("session_id", sessionId)
      .eq("question_index", questionIndex);

    if (data) {
      setResponses(
        data
          .map((r: any) => ({
            id: r.id,
            text: (r.answer as any)?.text || "",
            nickname: anonymous ? undefined : r.game_players?.nickname,
            created_at: r.created_at,
          }))
          .filter((r) => r.text)
      );
    }
  }, [sessionId, questionIndex, anonymous]);

  useEffect(() => {
    loadResponses();

    const channel = supabase
      .channel(`wall-${sessionId}-${questionIndex}`)
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
          if (r.question_index === questionIndex && (r.answer as any)?.text) {
            // Reload to get nickname from joined player
            loadResponses();
          }
        }
      )
      .subscribe();

    // Polling fallback every 2 seconds
    const interval = setInterval(loadResponses, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionId, questionIndex, loadResponses]);

  if (!published) {
    return (
      <div className="w-full max-w-6xl text-center">
        <p className="text-2xl text-gray-300">
          Učitel zobrazí odpovědi ({responses.length} odpovědí přijato)
        </p>
      </div>
    );
  }

  const bubbleStyles = [
    { background: "rgba(147, 51, 234, 0.15)", border: "2px solid rgba(147, 51, 234, 0.4)", color: "#6b21a8" },
    { background: "rgba(59, 130, 246, 0.15)", border: "2px solid rgba(59, 130, 246, 0.4)", color: "#1d4ed8" },
    { background: "rgba(16, 185, 129, 0.15)", border: "2px solid rgba(16, 185, 129, 0.4)", color: "#065f46" },
    { background: "rgba(245, 158, 11, 0.15)", border: "2px solid rgba(245, 158, 11, 0.4)", color: "#92400e" },
    { background: "rgba(236, 72, 153, 0.15)", border: "2px solid rgba(236, 72, 153, 0.4)", color: "#9d174d" },
    { background: "rgba(99, 102, 241, 0.15)", border: "2px solid rgba(99, 102, 241, 0.4)", color: "#3730a3" },
    { background: "rgba(20, 184, 166, 0.15)", border: "2px solid rgba(20, 184, 166, 0.4)", color: "#134e4a" },
    { background: "rgba(249, 115, 22, 0.15)", border: "2px solid rgba(249, 115, 22, 0.4)", color: "#7c2d12" },
  ];
  const rotations = [-2, 1, -1, 2, 0, -2, 1, -1];

  return (
    <div className="w-full max-w-6xl">
      {responses.length === 0 ? (
        <p className="text-2xl text-gray-300 text-center">Čekám na odpovědi žáků...</p>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {responses.map((r, i) => {
            const style = bubbleStyles[i % bubbleStyles.length];
            const rotation = rotations[i % rotations.length];
            return (
              <div
                key={r.id}
                style={{
                  background: style.background,
                  border: style.border,
                  color: style.color,
                  transform: `rotate(${rotation}deg)`,
                  borderRadius: "16px",
                  padding: "20px 24px",
                  maxWidth: "320px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                }}
              >
                <p style={{ fontSize: "18px", fontWeight: 500, lineHeight: 1.5 }}>{r.text}</p>
                {r.nickname && (
                  <p style={{ fontSize: "14px", opacity: 0.7, marginTop: "8px" }}>— {r.nickname}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WallProjectorView;
