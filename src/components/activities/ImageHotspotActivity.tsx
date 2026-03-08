import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from "lucide-react";

interface Hotspot {
  x: number; // percentage 0-100
  y: number;
  radius: number; // percentage radius
  label: string;
}

interface Props {
  imageUrl: string;
  hotspots: Hotspot[];
}

const ImageHotspotActivity = ({ imageUrl, hotspots = [] }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);

  const current = hotspots[currentQuestion];

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (answered || finished || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setClickPos({ x, y });

      // Check if click is within the correct hotspot radius
      const dx = x - current.x;
      const dy = y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isCorrect = dist <= (current.radius || 8);

      setResults((prev) => ({ ...prev, [currentQuestion]: isCorrect }));
      setAnswered(true);
    },
    [answered, finished, current, currentQuestion]
  );

  const handleNext = () => {
    if (currentQuestion < hotspots.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setClickPos(null);
      setAnswered(false);
    } else {
      setFinished(true);
    }
  };

  const handleReset = () => {
    setCurrentQuestion(0);
    setClickPos(null);
    setResults({});
    setAnswered(false);
    setFinished(false);
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const total = hotspots.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  if (!hotspots.length || !imageUrl) return null;

  return (
    <div className="space-y-4">
      {/* Question prompt */}
      {!finished && (
        <div className="flex items-center justify-between">
          <div className="rounded-md bg-muted/30 px-4 py-2.5">
            <span className="text-sm text-muted-foreground mr-2">{currentQuestion + 1}/{total}</span>
            <span className="text-sm font-medium text-foreground">{current.label}</span>
          </div>
        </div>
      )}

      {/* Image */}
      <div
        ref={containerRef}
        className={`relative inline-block w-full ${!answered && !finished ? "cursor-crosshair" : ""}`}
        onClick={handleClick}
      >
        <img src={imageUrl} alt="Aktivita" className="w-full rounded-lg" draggable={false} />

        {/* Show correct zone when answered */}
        {answered && (
          <div
            className={`absolute rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all ${
              results[currentQuestion]
                ? "border-green-500 bg-green-500/20"
                : "border-primary bg-primary/20"
            }`}
            style={{
              left: `${current.x}%`,
              top: `${current.y}%`,
              width: `${(current.radius || 8) * 2}%`,
              height: `${(current.radius || 8) * 2}%`,
            }}
          />
        )}

        {/* Show click position */}
        {clickPos && answered && (
          <div
            className={`absolute w-5 h-5 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none ${
              results[currentQuestion]
                ? "border-green-500 bg-green-500/60"
                : "border-destructive bg-destructive/60"
            }`}
            style={{ left: `${clickPos.x}%`, top: `${clickPos.y}%` }}
          >
            {results[currentQuestion] ? (
              <CheckCircle2 className="w-full h-full text-green-300" />
            ) : (
              <XCircle className="w-full h-full text-destructive-foreground" />
            )}
          </div>
        )}

        {/* Show all answered hotspots in finished mode */}
        {finished &&
          hotspots.map((hs, i) => (
            <div
              key={i}
              className={`absolute rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center ${
                results[i]
                  ? "border-green-500 bg-green-500/20"
                  : "border-destructive bg-destructive/20"
              }`}
              style={{
                left: `${hs.x}%`,
                top: `${hs.y}%`,
                width: `${(hs.radius || 8) * 2}%`,
                height: `${(hs.radius || 8) * 2}%`,
              }}
            >
              <span className="text-xs font-bold text-foreground bg-background/70 px-1.5 py-0.5 rounded whitespace-nowrap">
                {hs.label}
              </span>
            </div>
          ))}
      </div>

      {/* Feedback */}
      {answered && !finished && (
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              results[currentQuestion]
                ? "bg-green-500/10 text-green-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {results[currentQuestion] ? "✓ Správně!" : "✗ Špatně – správná oblast je vyznačena."}
          </div>
          <Button onClick={handleNext} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            {currentQuestion < hotspots.length - 1 ? (
              <>Další <ChevronRight className="w-4 h-4 ml-1" /></>
            ) : (
              "Zobrazit výsledky"
            )}
          </Button>
        </div>
      )}

      {/* Final results */}
      {finished && (
        <div className="space-y-3">
          <div
            className={`rounded-lg p-3 flex items-center gap-3 ${
              percentage === 100
                ? "bg-green-600/20 border border-green-500/40"
                : percentage >= 50
                ? "bg-yellow-600/20 border border-yellow-500/40"
                : "bg-destructive/20 border border-destructive/40"
            }`}
          >
            {percentage === 100 ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive shrink-0" />
            )}
            <span className="text-sm font-medium">
              {correctCount}/{total} správně ({percentage} %)
            </span>
          </div>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Zkusit znovu
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageHotspotActivity;
