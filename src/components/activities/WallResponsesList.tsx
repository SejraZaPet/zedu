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
  darkMode?: boolean;
}

const WallResponsesList = ({ sessionId, questionIndex, anonymous, darkMode = false }: Props) => {
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
      <div
        className="mt-6 p-4 border rounded-lg text-center text-sm"
        style={
          darkMode
            ? { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }
            : undefined
        }
      >
        Zatím žádné odpovědi.
      </div>
    );
  }

  const lightBubbleStyles = [
    { background: "#f3e8ff", border: "2px solid #c084fc", color: "#6b21a8" },
    { background: "#dbeafe", border: "2px solid #60a5fa", color: "#1e40af" },
    { background: "#dcfce7", border: "2px solid #4ade80", color: "#166534" },
    { background: "#fef9c3", border: "2px solid #facc15", color: "#854d0e" },
    { background: "#ffe4e6", border: "2px solid #fb7185", color: "#9f1239" },
    { background: "#e0e7ff", border: "2px solid #818cf8", color: "#3730a3" },
    { background: "#ccfbf1", border: "2px solid #2dd4bf", color: "#134e4a" },
    { background: "#ffedd5", border: "2px solid #fb923c", color: "#7c2d12" },
  ];
  const darkBubbleStyles = [
    { background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.4)", color: "#ffffff" },
    { background: "rgba(167, 139, 250, 0.3)", border: "2px solid rgba(167, 139, 250, 0.6)", color: "#ede9fe" },
    { background: "rgba(96, 165, 250, 0.3)", border: "2px solid rgba(96, 165, 250, 0.6)", color: "#dbeafe" },
    { background: "rgba(52, 211, 153, 0.3)", border: "2px solid rgba(52, 211, 153, 0.6)", color: "#d1fae5" },
    { background: "rgba(251, 191, 36, 0.3)", border: "2px solid rgba(251, 191, 36, 0.6)", color: "#fef3c7" },
    { background: "rgba(249, 115, 22, 0.3)", border: "2px solid rgba(249, 115, 22, 0.6)", color: "#ffedd5" },
    { background: "rgba(236, 72, 153, 0.3)", border: "2px solid rgba(236, 72, 153, 0.6)", color: "#fce7f3" },
    { background: "rgba(34, 211, 238, 0.3)", border: "2px solid rgba(34, 211, 238, 0.6)", color: "#cffafe" },
  ];
  const bubbleStyles = darkMode ? darkBubbleStyles : lightBubbleStyles;
  const rotations = [-2, 1, -1, 2, 0, -2, 1, -1];

  return (
    <div className="mt-4">
      <p
        className="text-sm font-medium mb-3"
        style={darkMode ? { color: "rgba(255,255,255,0.8)" } : { color: "hsl(var(--muted-foreground))" }}
      >
        Odpovědi spolužáků:
      </p>
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
                borderRadius: darkMode ? "16px" : "12px",
                padding: darkMode ? "16px 24px" : "10px 16px",
                maxWidth: darkMode ? "280px" : "200px",
                boxShadow: darkMode ? "0 4px 16px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <p
                style={{
                  fontSize: darkMode ? "20px" : "14px",
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                {r.text}
              </p>
              {r.nickname && (
                <p style={{ fontSize: darkMode ? "14px" : "12px", opacity: 0.7, marginTop: "4px" }}>— {r.nickname}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WallResponsesList;
