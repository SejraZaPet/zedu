import { useEffect, useState } from "react";
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
}

const WallProjectorView = ({ sessionId, questionIndex, anonymous }: Props) => {
  const [responses, setResponses] = useState<Response[]>([]);

  useEffect(() => {
    const loadResponses = async () => {
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
    };

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
            setResponses((prev) => [
              ...prev,
              {
                id: r.id,
                text: (r.answer as any).text,
                nickname: undefined,
                created_at: r.created_at,
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, questionIndex, anonymous]);

  return (
    <div className="w-full max-w-6xl">
      {responses.length === 0 ? (
        <p className="text-2xl text-gray-300 text-center">Čekám na odpovědi žáků...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {responses.map((r) => (
            <div
              key={r.id}
              className="bg-white/10 border border-white/20 rounded-xl p-5 backdrop-blur-sm"
            >
              <p className="text-lg text-white leading-relaxed">{r.text}</p>
              {r.nickname && (
                <p className="text-sm text-purple-300 mt-3">— {r.nickname}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WallProjectorView;
