import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  sessionId: string;
  questionIndex: number;
  published?: boolean;
  darkMode?: boolean;
}

interface WordEntry {
  text: string;
  count: number;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const WordCloudView = ({ sessionId, questionIndex, published = true, darkMode = false }: Props) => {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const loadResponses = useCallback(async () => {
    const { data } = await supabase
      .from("game_responses")
      .select("id, answer")
      .eq("session_id", sessionId)
      .eq("question_index", questionIndex);

    if (data) {
      const counts = new Map<string, { text: string; count: number }>();
      let total = 0;
      for (const r of data as any[]) {
        const raw = (r.answer as any)?.text;
        if (typeof raw !== "string") continue;
        const key = normalize(raw);
        if (!key) continue;
        total += 1;
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { text: raw.trim(), count: 1 });
      }
      setWords(Array.from(counts.values()).sort((a, b) => b.count - a.count));
      setTotalCount(total);
    }
  }, [sessionId, questionIndex]);

  useEffect(() => {
    loadResponses();
    const channel = supabase
      .channel(`wordcloud-${sessionId}-${questionIndex}`)
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
          if (r.question_index === questionIndex) loadResponses();
        }
      )
      .subscribe();
    const interval = setInterval(loadResponses, 2000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionId, questionIndex, loadResponses]);

  const styled = useMemo(() => {
    // Map count → font size class + color
    const palette = [
      "hsl(184 55% 60%)", // teal
      "hsl(272 55% 65%)", // lavender
      "hsl(199 70% 65%)",
      "hsl(292 45% 65%)",
      "hsl(220 60% 70%)",
      "hsl(252 60% 70%)",
    ];
    return words.map((w, i) => {
      let sizeClass = "text-base";
      if (w.count >= 6) sizeClass = "text-5xl font-bold";
      else if (w.count >= 4) sizeClass = "text-3xl font-bold";
      else if (w.count >= 2) sizeClass = "text-2xl font-semibold";
      else sizeClass = "text-lg font-medium";
      return { ...w, sizeClass, color: palette[i % palette.length] };
    });
  }, [words]);

  if (!published) {
    return (
      <div className="w-full max-w-6xl text-center">
        <p className={`text-2xl ${darkMode ? "text-gray-300" : "text-muted-foreground"}`}>
          Učitel zobrazí mrak ({totalCount} příspěvků přijato)
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      {words.length === 0 ? (
        <p className={`text-2xl text-center ${darkMode ? "text-gray-300" : "text-muted-foreground"}`}>
          Čekám na příspěvky žáků...
        </p>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-3 justify-center items-center py-4">
          {styled.map((w) => (
            <span
              key={w.text}
              className={`${w.sizeClass} leading-tight transition-all`}
              style={{ color: w.color }}
              title={`${w.text} · ${w.count}×`}
            >
              {w.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default WordCloudView;
