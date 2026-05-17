import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { WorksheetItemProps } from "./types";

/**
 * Interaktivní popis obrázku v digitální verzi pracovního listu.
 * - Žák ťukne na slovo v bance, pak ťukne na číslovaný bod.
 * - Hodnoty se ukládají jako JSON `{ [markerNumber]: label }` ve `value`.
 * - V `disabled` nebo `showResults` režimu je read-only s vyhodnocením.
 */
export default function ImageLabelPlayer({
  item,
  value,
  onChange,
  disabled,
  showResults,
}: WorksheetItemProps) {
  const labels = item.imageLabels ?? [];
  const shuffleWords = item.imageShuffleWords !== false;

  // Parse stored value
  const placed: Record<number, string> = useMemo(() => {
    if (typeof value !== "string" || !value) return {};
    try {
      const p = JSON.parse(value);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }, [value]);

  const [picked, setPicked] = useState<string | null>(null);

  // Shuffle word bank once per item
  const allLabels = labels.map((l) => l.answer).filter(Boolean);
  const [bank, setBank] = useState<string[]>(allLabels);
  useEffect(() => {
    const arr = [...allLabels];
    if (shuffleWords) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    setBank(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, labels.length, shuffleWords]);

  const usedLabels = Object.values(placed);
  const availableBank = bank.filter((l) => !usedLabels.includes(l));

  const updatePlaced = (next: Record<number, string>) => {
    onChange(JSON.stringify(next));
  };

  const placeOnMarker = (markerNumber: number) => {
    if (disabled || !picked) return;
    const next = { ...placed };
    // remove this label from any other marker
    for (const [k, v] of Object.entries(next)) {
      if (v === picked) delete next[Number(k)];
    }
    next[markerNumber] = picked;
    updatePlaced(next);
    setPicked(null);
  };

  const removeFromMarker = (markerNumber: number) => {
    if (disabled) return;
    const next = { ...placed };
    delete next[markerNumber];
    updatePlaced(next);
  };

  const handleReset = () => {
    if (disabled) return;
    updatePlaced({});
    setPicked(null);
  };

  const correctMap: Record<number, boolean> = {};
  labels.forEach((l) => {
    correctMap[l.number] = (placed[l.number] ?? "").trim().toLowerCase() === l.answer.trim().toLowerCase();
  });

  return (
    <div className="space-y-3">
      {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}

      <div className="relative inline-block max-w-full">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.imageAlt ?? ""}
            className="max-h-[420px] w-auto rounded border border-border block"
            draggable={false}
          />
        ) : (
          <div className="w-72 h-44 bg-muted grid place-items-center text-xs text-muted-foreground rounded border border-dashed border-border">
            Bez obrázku
          </div>
        )}
        {labels.map((m) => {
          const placedLabel = placed[m.number];
          const isCorrect = correctMap[m.number];
          return (
            <div
              key={m.number}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${m.xPercent}%`, top: `${m.yPercent}%` }}
            >
              {placedLabel ? (
                <button
                  type="button"
                  onClick={() => removeFromMarker(m.number)}
                  disabled={disabled}
                  className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap transition-colors ${
                    showResults
                      ? isCorrect
                        ? "bg-green-600/80 border-green-500 text-white"
                        : "bg-destructive/80 border-destructive text-white"
                      : "bg-primary/80 border-primary text-primary-foreground hover:bg-primary"
                  }`}
                >
                  {m.number}. {placedLabel}
                  {showResults &&
                    (isCorrect ? (
                      <CheckCircle2 className="inline w-3 h-3 ml-1" />
                    ) : (
                      <XCircle className="inline w-3 h-3 ml-1" />
                    ))}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => placeOnMarker(m.number)}
                  disabled={disabled}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                    picked
                      ? "border-primary bg-primary/30 text-primary scale-110 animate-pulse cursor-pointer"
                      : "border-muted-foreground/50 bg-background/70 text-muted-foreground"
                  }`}
                >
                  {m.number}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Word bank */}
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {availableBank.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setPicked(picked === label ? null : label)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                picked === label
                  ? "bg-primary text-primary-foreground border-primary scale-105 shadow"
                  : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          ))}
          {availableBank.length === 0 && (
            <span className="text-xs text-muted-foreground">Všechna slova jsou umístěna.</span>
          )}
        </div>
      )}

      {!disabled && Object.keys(placed).length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-3 h-3 mr-1" /> Začít znovu
        </Button>
      )}

      {showResults && (
        <p className="text-xs text-muted-foreground">
          Správně: {Object.values(correctMap).filter(Boolean).length} / {labels.length}
        </p>
      )}
    </div>
  );
}
