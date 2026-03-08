import { useState, useMemo, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemoryPair {
  left: string;
  right: string;
}

interface Props {
  pairs: MemoryPair[];
}

interface Card {
  id: number;
  text: string;
  pairIndex: number;
  side: "left" | "right";
}

const MemoryGameActivity = ({ pairs = [] }: Props) => {
  const cards = useMemo(() => {
    const all: Card[] = [];
    pairs.forEach((p, i) => {
      all.push({ id: i * 2, text: p.left, pairIndex: i, side: "left" });
      all.push({ id: i * 2 + 1, text: p.right, pairIndex: i, side: "right" });
    });
    // Shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map((p) => p.left + p.right).join(",")]);

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const lockRef = useRef(false);

  const finished = matched.size === cards.length;

  // Timer
  useEffect(() => {
    if (!startTime || finished) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime, finished]);

  const handleClick = (cardId: number) => {
    if (lockRef.current) return;
    if (matched.has(cardId)) return;
    if (flipped.includes(cardId)) return;

    if (!startTime) setStartTime(Date.now());

    const next = [...flipped, cardId];
    setFlipped(next);

    if (next.length === 2) {
      setAttempts((a) => a + 1);
      const [first, second] = next;
      const c1 = cards.find((c) => c.id === first)!;
      const c2 = cards.find((c) => c.id === second)!;

      if (c1.pairIndex === c2.pairIndex && c1.side !== c2.side) {
        // Match!
        setMatched((prev) => new Set([...prev, first, second]));
        setFlipped([]);
      } else {
        // No match – flip back after delay
        lockRef.current = true;
        setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 800);
      }
    }
  };

  const reset = () => {
    setFlipped([]);
    setMatched(new Set());
    setAttempts(0);
    setStartTime(null);
    setElapsed(0);
    lockRef.current = false;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!pairs.length) return null;

  const cols = cards.length <= 8 ? "grid-cols-2 sm:grid-cols-4" : cards.length <= 12 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6";

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Pokusy: <span className="text-foreground font-medium">{attempts}</span></span>
        <span>Čas: <span className="text-foreground font-medium">{formatTime(elapsed)}</span></span>
        <span>Nalezeno: <span className="text-foreground font-medium">{matched.size / 2}/{pairs.length}</span></span>
      </div>

      {/* Cards grid */}
      <div className={`grid gap-2 ${cols}`}>
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.id);
          const isMatched = matched.has(card.id);
          const showFace = isFlipped || isMatched;

          return (
            <button
              key={card.id}
              onClick={() => handleClick(card.id)}
              disabled={isMatched}
              className={`relative aspect-[3/4] rounded-lg border-2 text-sm font-medium transition-all duration-300 flex items-center justify-center p-2 text-center ${
                isMatched
                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                  : isFlipped
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-md cursor-pointer"
              }`}
            >
              {showFace ? (
                <span className="animate-in fade-in duration-200">{card.text}</span>
              ) : (
                <span className="text-2xl text-muted-foreground/40">?</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Finished */}
      {finished && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm space-y-1">
          <p className="text-green-400 font-medium">
            ✓ Výborně! Všechny páry nalezeny!
          </p>
          <p className="text-muted-foreground">
            {attempts} pokusů · {formatTime(elapsed)}
          </p>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={reset}>
        <RotateCcw className="w-4 h-4 mr-1" />
        {finished ? "Hrát znovu" : "Začít znovu"}
      </Button>
    </div>
  );
};

export default MemoryGameActivity;
