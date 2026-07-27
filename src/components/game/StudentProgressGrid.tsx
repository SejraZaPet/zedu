import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { GamePlayer, GameResponse } from "@/lib/game-types";

interface SlideLike {
  type?: string;
  projector?: { headline?: string };
  activitySpec?: { activityType?: string; type?: string };
}

interface Props {
  slides: SlideLike[];
  players: GamePlayer[];
  responses: GameResponse[];
  pacingMode?: "teacher" | "student";
  sortBy?: "nickname" | "score";
}

/**
 * Grid of students × slides showing per-question answer state.
 * Green = correct, red = wrong, gray = not answered yet.
 * In student pacing mode, highlights each student's current position.
 */
const StudentProgressGrid = ({
  slides,
  players,
  responses,
  pacingMode,
  sortBy = "nickname",
}: Props) => {
  const slideCount = slides.length;

  // Precompute response map: `${player_id}:${question_index}` -> response
  const respMap = useMemo(() => {
    const m = new Map<string, GameResponse>();
    for (const r of responses) {
      m.set(`${r.player_id}:${r.question_index}`, r);
    }
    return m;
  }, [responses]);

  const sortedPlayers = useMemo(() => {
    const arr = [...players];
    if (sortBy === "score") {
      arr.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    } else {
      arr.sort((a, b) => (a.nickname || "").localeCompare(b.nickname || ""));
    }
    return arr;
  }, [players, sortBy]);

  if (slideCount === 0) {
    return <p className="text-sm text-muted-foreground italic">Žádné slidy.</p>;
  }
  if (sortedPlayers.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Zatím se nikdo nepřipojil.</p>;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="sticky left-0 z-20 bg-muted text-left px-3 py-2 font-semibold border-b border-border min-w-[140px]">
                Žák
              </th>
              {slides.map((s, i) => {
                const isActivity = s.type === "activity";
                return (
                  <th
                    key={i}
                    className="px-1 py-2 font-semibold text-center border-b border-border min-w-[28px]"
                    title={
                      s.projector?.headline ||
                      s.activitySpec?.activityType ||
                      s.type ||
                      `Slide ${i + 1}`
                    }
                  >
                    <span className={cn(!isActivity && "text-muted-foreground/60")}>
                      {i + 1}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p) => {
              const currentIdx =
                pacingMode === "student" && typeof p.student_index === "number"
                  ? p.student_index
                  : null;
              return (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="sticky left-0 z-10 bg-background hover:bg-muted/40 px-3 py-1.5 border-b border-border truncate max-w-[180px]">
                    <span className="font-medium">{p.nickname}</span>
                  </td>
                  {slides.map((s, i) => {
                    const isActivity = s.type === "activity";
                    const r = respMap.get(`${p.id}:${i}`);
                    const isCurrent = currentIdx === i;

                    let cellClass = "bg-muted/30";
                    let label = "";
                    if (!isActivity) {
                      cellClass = "bg-transparent";
                    } else if (r) {
                      if (r.is_correct) {
                        cellClass = "bg-green-500/80";
                        label = "✓";
                      } else {
                        cellClass = "bg-red-500/80";
                        label = "✕";
                      }
                    }

                    return (
                      <td
                        key={i}
                        className="p-0.5 border-b border-border text-center align-middle"
                      >
                        <div
                          className={cn(
                            "w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] font-bold text-white",
                            cellClass,
                            isCurrent &&
                              "ring-2 ring-primary ring-offset-1 ring-offset-background",
                          )}
                          title={
                            !isActivity
                              ? `Slide ${i + 1} (bez odpovědi)`
                              : r
                                ? `Slide ${i + 1}: ${r.is_correct ? "správně" : "špatně"} · ${r.score ?? 0}`
                                : `Slide ${i + 1}: bez odpovědi${isCurrent ? " (aktuální pozice)" : ""}`
                          }
                        >
                          {label}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500/80" /> správně
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/80" /> špatně
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-muted-foreground/30" /> bez odpovědi
        </span>
        {pacingMode === "student" && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded ring-2 ring-primary" /> aktuální pozice
          </span>
        )}
      </div>
    </div>
  );
};

export default StudentProgressGrid;
