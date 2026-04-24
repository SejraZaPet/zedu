import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Response {
  id: string;
  text: string;
  nickname?: string;
}

interface Props {
  sessionId: string;
  questionIndex: number;
  anonymous: boolean;
}

const WallResponsesList = ({ sessionId, questionIndex, anonymous }: Props) => {
  const [responses, setResponses] = useState<Response[]>([]);

  const load = useCallback(async () => {
    if (!sessionId) return;
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
          }))
          .filter((r) => r.text)
      );
    }
  }, [sessionId, questionIndex, anonymous]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  if (responses.length === 0) {
    return (
      <div className="mt-6 p-4 border border-border rounded-lg text-center text-sm text-muted-foreground">
        Zatím žádné odpovědi.
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
    <div className="mt-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Odpovědi spolužáků:</p>
      <div className="flex flex-wrap gap-2 justify-center">
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
                borderRadius: "12px",
                padding: "10px 16px",
                maxWidth: "200px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <p style={{ fontSize: "14px", fontWeight: 500, lineHeight: 1.4 }}>{r.text}</p>
              {r.nickname && (
                <p style={{ fontSize: "12px", opacity: 0.6, marginTop: "4px" }}>— {r.nickname}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WallResponsesList;
