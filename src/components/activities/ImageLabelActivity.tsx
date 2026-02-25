import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Marker {
  x: number; // percentage 0-100
  y: number;
  label: string;
}

interface Props {
  imageUrl: string;
  markers: Marker[];
  tolerance?: number; // percentage radius
  shuffleWords?: boolean;
}

const ImageLabelActivity = ({ imageUrl, markers = [], tolerance = 5, shuffleWords = true }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [showSolution, setShowSolution] = useState(false);

  const allLabels = markers.map((m) => m.label);
  const [shuffled, setShuffled] = useState<string[]>([]);

  useEffect(() => {
    const arr = [...allLabels];
    if (shuffleWords) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    setShuffled(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers.length]);

  const usedLabels = Object.values(placed);
  const availableLabels = shuffled.filter((l) => !usedLabels.includes(l));

  const handleDrop = useCallback(
    (markerIdx: number) => {
      if (!dragging) return;
      // Remove this label from any other marker
      const next = { ...placed };
      for (const [k, v] of Object.entries(next)) {
        if (v === dragging) delete next[Number(k)];
      }
      next[markerIdx] = dragging;
      setPlaced(next);
      setDragging(null);
      setChecked(false);
    },
    [dragging, placed]
  );

  const removeFromMarker = (idx: number) => {
    const next = { ...placed };
    delete next[idx];
    setPlaced(next);
    setChecked(false);
  };

  const handleCheck = () => {
    const res: Record<number, boolean> = {};
    markers.forEach((m, i) => {
      res[i] = placed[i] === m.label;
    });
    setResults(res);
    setChecked(true);
  };

  const handleReset = () => {
    setPlaced({});
    setResults({});
    setChecked(false);
    setShowSolution(false);
  };

  const handleShowSolution = () => {
    const next: Record<number, string> = {};
    markers.forEach((m, i) => { next[i] = m.label; });
    setPlaced(next);
    const res: Record<number, boolean> = {};
    markers.forEach((_, i) => { res[i] = true; });
    setResults(res);
    setChecked(true);
    setShowSolution(true);
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const percentage = markers.length > 0 ? Math.round((correctCount / markers.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Image with markers */}
      <div ref={containerRef} className="relative inline-block w-full">
        <img src={imageUrl} alt="Aktivita" className="w-full rounded-lg" draggable={false} />
        {markers.map((marker, i) => (
          <div
            key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
          >
            {placed[i] ? (
              <button
                onClick={() => !checked && removeFromMarker(i)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                  checked
                    ? results[i]
                      ? "bg-green-600/80 border-green-500 text-white"
                      : "bg-destructive/80 border-destructive text-white"
                    : "bg-primary/80 border-primary text-primary-foreground hover:bg-primary"
                }`}
              >
                {placed[i]}
                {checked && (results[i] ? <CheckCircle2 className="inline w-3 h-3 ml-1" /> : <XCircle className="inline w-3 h-3 ml-1" />)}
              </button>
            ) : (
              <button
                onClick={() => dragging && handleDrop(i)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                  dragging
                    ? "border-primary bg-primary/30 text-primary scale-110 animate-pulse cursor-pointer"
                    : "border-muted-foreground/50 bg-background/70 text-muted-foreground"
                }`}
              >
                {i + 1}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Word bank */}
      <div className="flex flex-wrap gap-2">
        {availableLabels.map((label) => (
          <button
            key={label}
            onClick={() => setDragging(dragging === label ? null : label)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all cursor-pointer ${
              dragging === label
                ? "bg-primary text-primary-foreground border-primary scale-105 shadow-lg"
                : "bg-muted/50 text-foreground border-border hover:border-primary/50"
            }`}
          >
            {label}
          </button>
        ))}
        {availableLabels.length === 0 && !checked && (
          <span className="text-xs text-muted-foreground">Všechna slova jsou umístěna.</span>
        )}
      </div>

      {/* Results banner */}
      {checked && (
        <div className={`rounded-lg p-3 flex items-center gap-3 ${
          percentage === 100
            ? "bg-green-600/20 border border-green-500/40"
            : percentage >= 50
              ? "bg-yellow-600/20 border border-yellow-500/40"
              : "bg-destructive/20 border border-destructive/40"
        }`}>
          {percentage === 100 ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
          )}
          <span className="text-sm font-medium">
            {showSolution ? "Zobrazeno řešení" : `${correctCount}/${markers.length} správně (${percentage} %)`}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {!checked && (
          <Button
            onClick={handleCheck}
            disabled={Object.keys(placed).length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Zkontrolovat odpovědi
          </Button>
        )}
        {checked && !showSolution && (
          <Button variant="outline" onClick={handleShowSolution}>
            Zobrazit řešení
          </Button>
        )}
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Zkusit znovu
        </Button>
      </div>
    </div>
  );
};

export default ImageLabelActivity;
