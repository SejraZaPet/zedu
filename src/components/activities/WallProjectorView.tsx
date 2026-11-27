import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { wallNoteSizing } from "@/lib/projector-compact-layout";

interface Response {
  id: string;
  text: string;
  nickname?: string;
  player_id: string;
  created_at: string;
}

interface Props {
  sessionId: string;
  questionIndex: number;
  anonymous: boolean;
  published?: boolean;
  /** When provided, replaces nicknames with stable "Žák N" labels (session-wide anonymous mode). */
  anonymousLabelMap?: Record<string, string>;
  /** Guest/student access token – guests cannot read the table directly. */
  joinToken?: string | null;
  /** Projektorové rozvržení: hlavní plocha, velikost lístků podle počtu. */
  projector?: boolean;
  darkMode?: boolean;
}

const WallProjectorView = ({ sessionId, questionIndex, anonymous, published = false, anonymousLabelMap, joinToken, projector = false, darkMode = true }: Props) => {
  const [responses, setResponses] = useState<Response[]>([]);
  const sessionAnonymous = !!anonymousLabelMap;
  const effectiveAnonymous = anonymous || sessionAnonymous;

  const loadResponses = useCallback(async () => {
    const { data } = await supabase.rpc("get_activity_responses" as any, {
      _session_id: sessionId,
      _question_index: questionIndex,
      _join_token: joinToken || null,
    });

    if (data) {
      setResponses(
        (data as any[])
          .map((r: any) => ({
            id: r.id,
            text: (r.answer as any)?.text || "",
            nickname: effectiveAnonymous ? undefined : r.nickname,
            player_id: r.player_id,
            created_at: r.created_at,
          }))
          .filter((r) => r.text)
      );
    }
  }, [sessionId, questionIndex, effectiveAnonymous, joinToken]);

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
        <p className="inline-block rounded-full bg-black/55 px-6 py-2 text-2xl font-medium text-white">
          Učitel zobrazí odpovědi ({responses.length} odpovědí přijato)
        </p>
      </div>
    );
  }

  // Plné pastelové lístky s tmavým textem: čitelné na světlém i tmavém podkladu.
  const bubbleStyles = [
    { background: "#fef3c7", border: "2px solid #f59e0b" },
    { background: "#ede9fe", border: "2px solid #8b5cf6" },
    { background: "#dbeafe", border: "2px solid #3b82f6" },
    { background: "#d1fae5", border: "2px solid #10b981" },
    { background: "#ffedd5", border: "2px solid #f97316" },
    { background: "#fce7f3", border: "2px solid #ec4899" },
    { background: "#cffafe", border: "2px solid #06b6d4" },
    { background: "#ffffff", border: "2px solid #94a3b8" },
  ];
  const rotations = [-2, 1, -1, 2, 0, -2, 1, -1];
  const sizing = projector ? wallNoteSizing(responses.length) : { fontSize: 20, maxWidth: 280, padding: "16px 24px", gap: 16 };
  const scrollable = projector && responses.length > 30;

  return (
    <div
      data-testid="wall-projector-area"
      className={projector ? `flex w-full max-w-[1500px] min-h-0 flex-1 ${scrollable ? "items-start overflow-y-auto" : "items-center overflow-hidden"} justify-center py-4` : "w-full max-w-6xl"}
    >
      {responses.length === 0 ? (
        <p className={projector ? `text-[2.75rem] font-semibold text-center ${darkMode ? "text-white/85" : "text-slate-800"}` : "text-2xl text-gray-300 text-center"}>
          Čekám na odpovědi žáků…
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-center content-center" style={{ gap: sizing.gap }}>
          {responses.map((r, i) => {
            const style = bubbleStyles[i % bubbleStyles.length];
            const rotation = rotations[i % rotations.length];
            const metaSize = Math.max(14, Math.round(sizing.fontSize * 0.55));
            return (
              <div key={r.id} style={{ transform: `rotate(${rotation}deg)` }}>
                <div
                  data-testid="wall-note"
                  className="animate-in fade-in zoom-in-90 duration-500 motion-reduce:animate-none"
                  style={{
                    background: style.background,
                    border: style.border,
                    color: "#1e1b2e",
                    borderRadius: "16px",
                    padding: sizing.padding,
                    maxWidth: `${sizing.maxWidth}px`,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    overflowWrap: "anywhere",
                  }}
                >
                  <p style={{ fontSize: `${sizing.fontSize}px`, fontWeight: 600, lineHeight: 1.3 }}>{r.text}</p>
                  {sessionAnonymous ? (
                    <p style={{ fontSize: `${metaSize}px`, opacity: 0.7, marginTop: "8px" }}>
                      — {anonymousLabelMap?.[r.player_id] ?? "Žák"}
                    </p>
                  ) : (
                    r.nickname && (
                      <p style={{ fontSize: `${metaSize}px`, opacity: 0.7, marginTop: "8px" }}>— {r.nickname}</p>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WallProjectorView;
