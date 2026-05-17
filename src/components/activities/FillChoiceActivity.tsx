import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

interface FillChoiceToken {
  type: "text" | "blank";
  value?: string;
  answer?: string;
}

interface Props {
  tokens: FillChoiceToken[];
  options: string[];
  onComplete?: (score: number, maxScore: number) => void;
}

const DraggableWord = ({
  word,
  isUsed,
  isSelected,
  onSelect,
  disabled,
}: {
  word: string;
  isUsed: boolean;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `word-${word}`,
    data: { word },
    disabled: isUsed || disabled,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      disabled={isUsed || disabled}
      className={`inline-flex items-center justify-center px-3 h-9 rounded-lg border text-sm font-medium select-none transition-all ${
        isUsed
          ? "border-border bg-muted/30 text-muted-foreground opacity-40 cursor-not-allowed line-through"
          : isSelected
          ? "border-primary bg-primary text-primary-foreground shadow-md scale-105 cursor-grab"
          : "border-primary/60 bg-primary/10 text-foreground hover:bg-primary/20 cursor-grab active:cursor-grabbing"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      {word}
    </button>
  );
};

const DroppableBlank = ({
  id,
  answer,
  isCorrect,
  checked,
  onClick,
}: {
  id: string;
  answer: string | null;
  isCorrect?: boolean;
  checked: boolean;
  onClick: () => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      disabled={checked}
      className={`inline-flex items-center justify-center min-w-[80px] min-h-[36px] px-3 mx-1 rounded-lg border-2 border-dashed text-sm font-medium transition-all align-middle ${
        checked
          ? isCorrect
            ? "border-green-500 bg-green-500/10 text-green-500 border-solid"
            : "border-destructive bg-destructive/10 text-destructive border-solid"
          : isOver
          ? "border-primary bg-primary/10 scale-105"
          : answer
          ? "border-primary/60 bg-primary/5 text-foreground border-solid cursor-pointer hover:bg-destructive/5"
          : "border-border bg-muted/20 text-muted-foreground"
      }`}
    >
      {answer || "…"}
      {checked && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 inline" />}
      {checked && !isCorrect && <XCircle className="w-3.5 h-3.5 ml-1.5 inline" />}
    </button>
  );
};

const FillChoiceActivity = ({ tokens = [], options = [], onComplete }: Props) => {
  const blanks = useMemo(() => tokens.filter((t) => t.type === "blank"), [tokens]);
  const [answers, setAnswers] = useState<(string | null)[]>(() => blanks.map(() => null));
  const [checked, setChecked] = useState(false);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const shuffledOptions = useMemo(() => {
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join(",")]);

  const usedWords = new Set(answers.filter(Boolean) as string[]);

  const results = useMemo(() => {
    if (!checked) return null;
    return blanks.map(
      (blank, i) =>
        answers[i]?.trim().toLowerCase() === blank.answer?.trim().toLowerCase()
    );
  }, [checked, answers, blanks]);

  const correctCount = results?.filter(Boolean).length ?? 0;
  const total = blanks.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const placeWord = (idx: number, word: string) => {
    const next = [...answers];
    const existingIdx = next.indexOf(word);
    if (existingIdx !== -1) next[existingIdx] = null;
    next[idx] = word;
    setAnswers(next);
  };

  const removeAnswer = (idx: number) => {
    const next = [...answers];
    next[idx] = null;
    setAnswers(next);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveWord((event.active.data.current as any)?.word || null);
    setSelectedWord(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWord(null);
    const { over, active } = event;
    if (!over) return;
    const blankIdx = parseInt(over.id.toString().replace("blank-", ""), 10);
    if (isNaN(blankIdx)) return;
    const word = (active.data.current as any)?.word;
    if (!word) return;
    placeWord(blankIdx, word);
  };

  const reset = () => {
    setAnswers(blanks.map(() => null));
    setChecked(false);
    setSelectedWord(null);
  };

  if (!blanks.length)
    return <p className="text-muted-foreground text-sm">Žádné mezery k doplnění.</p>;

  let blankCounter = 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Results banner */}
        {checked && results && (
          <div
            className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm font-medium ${
              percentage === 100
                ? "bg-green-500/15 text-green-500 border border-green-500/30"
                : percentage >= 50
                ? "bg-yellow-500/15 text-yellow-500 border border-yellow-500/30"
                : "bg-destructive/15 text-destructive border border-destructive/30"
            }`}
          >
            {percentage === 100 ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>
              {correctCount} / {total} správně ({percentage} %)
            </span>
          </div>
        )}

        {/* Word bank */}
        <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-muted/20 print:hidden">
          {shuffledOptions.map((opt) => (
            <DraggableWord
              key={opt}
              word={opt}
              isUsed={usedWords.has(opt)}
              isSelected={selectedWord === opt}
              disabled={checked}
              onSelect={() => {
                if (checked || usedWords.has(opt)) return;
                setSelectedWord((curr) => (curr === opt ? null : opt));
              }}
            />
          ))}
        </div>

        {/* Text with blanks */}
        <div className="text-foreground leading-loose text-base flex flex-wrap items-baseline gap-y-2">
          {tokens.map((token, i) => {
            if (token.type === "text") return <span key={i}>{token.value}</span>;
            const idx = blankCounter++;
            const isCorrect = results?.[idx];
            return (
              <DroppableBlank
                key={i}
                id={`blank-${idx}`}
                answer={answers[idx]}
                isCorrect={isCorrect ?? undefined}
                checked={checked}
                onClick={() => {
                  if (checked) return;
                  if (selectedWord) {
                    placeWord(idx, selectedWord);
                    setSelectedWord(null);
                    return;
                  }
                  if (answers[idx]) removeAnswer(idx);
                }}
              />
            );
          })}
        </div>

        {/* Print-only hint */}
        <div className="hidden print:block text-sm text-foreground border-t border-border pt-2">
          <strong>Nápověda:</strong> {options.join(" · ")}
        </div>

        {/* Correct answers */}
        {checked && results && percentage < 100 && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {blanks.map((blank, i) =>
              !results[i] ? (
                <div key={i}>
                  Mezera {i + 1}: správně „
                  <span className="text-green-500">{blank.answer}</span>"
                  {answers[i] && (
                    <>
                      , tvá odpověď „
                      <span className="text-destructive">{answers[i]}</span>"
                    </>
                  )}
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2 pt-2 print:hidden">
          {!checked && (
            <Button
              size="sm"
              onClick={() => {
                setChecked(true);
                const correct = blanks.filter(
                  (b, i) =>
                    answers[i]?.trim().toLowerCase() === b.answer?.trim().toLowerCase()
                ).length;
                onComplete?.(correct, blanks.length);
              }}
              disabled={answers.some((a) => a === null)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Zkontrolovat
            </Button>
          )}
          {checked && (
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Zkusit znovu
            </Button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeWord ? (
          <div className="inline-flex items-center justify-center px-3 h-9 rounded-lg border-2 border-primary bg-primary text-primary-foreground text-sm font-medium shadow-lg cursor-grabbing">
            {activeWord}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default FillChoiceActivity;
