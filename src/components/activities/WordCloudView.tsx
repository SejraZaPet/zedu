import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { activityCardStyle, hasActivityColors, resolveActivityColors } from "@/lib/activity-colors";

interface Props {
  sessionId: string;
  questionIndex: number;
  published?: boolean;
  darkMode?: boolean;
  /** Barvy skutečné karty aktivity; bez nich se použije podklad darkMode. */
  colors?: unknown;
  /** Velká varianta vyplní zbývající plochu projektorového slidu. */
  projector?: boolean;
  /** Guest/student access token – guests cannot read the table directly. */
  joinToken?: string | null;
}

interface WordEntry {
  text: string;
  count: number;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const WordCloudView = ({ sessionId, questionIndex, published = true, darkMode = false, colors, projector = false, joinToken }: Props) => {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const loadResponses = useCallback(async () => {
    const { data } = await supabase.rpc("get_activity_responses" as any, {
      _session_id: sessionId,
      _question_index: questionIndex,
      _join_token: joinToken || null,
    });

    if (data) {
      const counts = new Map<string, { text: string; count: number }>();
      let total = 0;
      for (const r of (data as any[]) || []) {
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
  }, [sessionId, questionIndex, joinToken]);

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

  const customSurface = hasActivityColors(colors);
  const resolvedSurface = resolveActivityColors(colors);
  const surfaceDark = customSurface ? resolvedSurface.dark : darkMode;
  const textColor = customSurface
    ? resolvedSurface.text
    : darkMode
      ? "hsl(var(--primary-foreground))"
      : "hsl(var(--foreground))";
  const surfaceStyle = customSurface ? activityCardStyle(colors) : { color: textColor };

  const styled = useMemo(() => {
    const palette = surfaceDark
      ? ["hsl(184 65% 72%)", "hsl(272 70% 80%)", "hsl(199 78% 75%)", "hsl(292 65% 80%)", "hsl(220 75% 80%)", "hsl(252 70% 82%)"]
      : ["hsl(184 75% 25%)", "hsl(272 58% 38%)", "hsl(199 78% 30%)", "hsl(292 58% 36%)", "hsl(220 68% 38%)", "hsl(252 60% 40%)"];
    const maxCount = Math.max(1, ...words.map((w) => w.count));
    const fit = projector && words.length > 12 ? Math.sqrt(12 / words.length) : 1;
    return words.map((w, i) => {
      const ratio = Math.sqrt(w.count / maxCount);
      const fontSize = projector
        ? Math.max(32, Math.round((32 + 96 * ratio) * fit))
        : Math.round(18 + 30 * ratio);
      return {
        ...w,
        fontSize,
        fontWeight: w.count === maxCount ? 700 : 600,
        color: palette[i % palette.length],
      };
    });
  }, [words, projector, surfaceDark]);

  const frameClass = projector ? "min-h-0 w-full flex-1" : "w-full max-w-6xl";

  if (!published) {
    return (
      <div className={`${frameClass} flex flex-col items-center justify-center text-center ${projector ? "rounded-3xl px-10 py-6" : ""} ${customSurface && projector ? "border-4 shadow-2xl" : ""}`} style={surfaceStyle}>
        <p className={projector ? "text-[2.5rem] font-semibold leading-tight" : "text-2xl"}>
          Učitel zobrazí mrak ({totalCount} příspěvků přijato)
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={projector ? "wordcloud-projector" : undefined}
      className={`${frameClass} flex flex-col items-center justify-center text-center ${projector ? "overflow-hidden rounded-3xl px-10 py-6" : ""} ${customSurface && projector ? "border-4 shadow-2xl" : ""}`}
      style={surfaceStyle}
    >
      {words.length === 0 ? (
        <div>
          <p className={projector ? "text-[2.75rem] font-semibold leading-tight" : "text-2xl"}>
            Čekám na příspěvky žáků…
          </p>
          <p className={projector ? "mt-4 text-[1.5rem] font-medium" : "mt-2 text-base"}>
            {totalCount} příspěvků přijato
          </p>
        </div>
      ) : (
        <div className={`flex min-h-0 w-full flex-wrap content-center items-center justify-center ${projector ? "max-h-full gap-x-8 gap-y-4 overflow-hidden" : "gap-x-6 gap-y-3 py-4"}`}>
          {styled.map((w) => (
            <span
              key={w.text}
              className="max-w-full break-words [overflow-wrap:anywhere] text-center leading-[1.05] animate-in fade-in zoom-in-95 transition-all duration-300 motion-reduce:animate-none motion-reduce:transition-none"
              style={{ color: w.color, fontSize: w.fontSize, fontWeight: w.fontWeight }}
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
