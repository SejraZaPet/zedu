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
    <div className="mt-6 space-y-2">
      <p className="text-sm font-medium text-foreground">Odpovědi spolužáků</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {responses.map((r) => (
          <div
            key={r.id}
            className="bg-muted/50 border border-border rounded-lg p-3"
          >
            <p className="text-sm text-foreground leading-relaxed">{r.text}</p>
            {r.nickname && (
              <p className="text-xs text-muted-foreground mt-1">— {r.nickname}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WallResponsesList;
