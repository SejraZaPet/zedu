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

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Odpovědi spolužáků:</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {responses.map((r, i) => {
          const colors = [
            "bg-purple-100 border-purple-300 text-purple-800",
            "bg-blue-100 border-blue-300 text-blue-800",
            "bg-green-100 border-green-300 text-green-800",
            "bg-yellow-100 border-yellow-300 text-yellow-800",
            "bg-pink-100 border-pink-300 text-pink-800",
            "bg-indigo-100 border-indigo-300 text-indigo-800",
            "bg-teal-100 border-teal-300 text-teal-800",
            "bg-orange-100 border-orange-300 text-orange-800",
          ];
          const color = colors[i % colors.length];
          const rotations = [-2, 1, -1, 2, 0, -2, 1, -1];
          const rotation = rotations[i % rotations.length];
          return (
            <div
              key={r.id}
              className={`${color} border-2 rounded-lg px-3 py-2 shadow-sm max-w-xs`}
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <p className="text-sm leading-snug break-words">{r.text}</p>
              {r.nickname && (
                <p className="text-xs opacity-70 mt-1">— {r.nickname}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WallResponsesList;
