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
    { background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.4)", color: "#ffffff" },
    { background: "rgba(167, 139, 250, 0.3)", border: "2px solid rgba(167, 139, 250, 0.6)", color: "#ede9fe" },
    { background: "rgba(96, 165, 250, 0.3)", border: "2px solid rgba(96, 165, 250, 0.6)", color: "#dbeafe" },
    { background: "rgba(52, 211, 153, 0.3)", border: "2px solid rgba(52, 211, 153, 0.6)", color: "#d1fae5" },
    { background: "rgba(251, 191, 36, 0.3)", border: "2px solid rgba(251, 191, 36, 0.6)", color: "#fef3c7" },
    { background: "rgba(249, 115, 22, 0.3)", border: "2px solid rgba(249, 115, 22, 0.6)", color: "#ffedd5" },
    { background: "rgba(236, 72, 153, 0.3)", border: "2px solid rgba(236, 72, 153, 0.6)", color: "#fce7f3" },
    { background: "rgba(34, 211, 238, 0.3)", border: "2px solid rgba(34, 211, 238, 0.6)", color: "#cffafe" },
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
                  padding: "16px 24px",
                  maxWidth: "280px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                  fontSize: "20px",
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                <p style={{ fontSize: "20px", fontWeight: 500, lineHeight: 1.4 }}>{r.text}</p>
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
