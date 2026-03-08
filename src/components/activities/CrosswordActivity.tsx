import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Eye } from "lucide-react";
import { generateCrosswordGrid, type CrosswordEntry, type PlacedWord } from "@/lib/crossword-engine";

interface Props {
  entries: CrosswordEntry[];
}

const CrosswordActivity = ({ entries = [] }: Props) => {
  const grid = useMemo(() => generateCrosswordGrid(entries), [entries]);

  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [activeWord, setActiveWord] = useState<PlacedWord | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Initialize user grid
  useEffect(() => {
    if (!grid) return;
    setUserGrid(
      Array.from({ length: grid.height }, (_, r) =>
        Array.from({ length: grid.width }, (_, c) =>
          grid.cells[r][c] !== null ? "" : ""
        )
      )
    );
    setChecked(false);
    setShowSolution(false);
    setActiveWord(null);
    setActiveCell(null);
  }, [grid]);

  const handleCellChange = useCallback(
    (row: number, col: number, value: string) => {
      if (checked) return;
      const char = value.slice(-1).toUpperCase();
      setUserGrid((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = char;
        return next;
      });

      // Auto-advance to next cell in active word
      if (char && activeWord) {
        const { direction } = activeWord;
        const nextRow = direction === "down" ? row + 1 : row;
        const nextCol = direction === "across" ? col + 1 : col;
        const key = `${nextRow}-${nextCol}`;
        const nextInput = inputRefs.current.get(key);
        if (nextInput && grid?.cells[nextRow]?.[nextCol] !== null) {
          nextInput.focus();
          setActiveCell({ row: nextRow, col: nextCol });
        }
      }
    },
    [checked, activeWord, grid]
  );

  const handleKeyDown = useCallback(
    (row: number, col: number, e: React.KeyboardEvent) => {
      if (checked) return;
      if (e.key === "Backspace" && !userGrid[row]?.[col]) {
        // Move back
        if (activeWord) {
          const prevRow = activeWord.direction === "down" ? row - 1 : row;
          const prevCol = activeWord.direction === "across" ? col - 1 : col;
          const key = `${prevRow}-${prevCol}`;
          const prevInput = inputRefs.current.get(key);
          if (prevInput && grid?.cells[prevRow]?.[prevCol] !== null) {
            prevInput.focus();
            setActiveCell({ row: prevRow, col: prevCol });
          }
        }
      }
    },
    [checked, activeWord, userGrid, grid]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      setActiveCell({ row, col });
      // Find words that pass through this cell
      if (!grid) return;
      const wordsAtCell = grid.words.filter((w) => {
        if (w.direction === "across") {
          return row === w.row && col >= w.col && col < w.col + w.answer.length;
        } else {
          return col === w.col && row >= w.row && row < w.row + w.answer.length;
        }
      });
      if (wordsAtCell.length === 0) return;

      // Toggle direction if clicking same cell
      if (activeWord && wordsAtCell.length > 1 && activeCell?.row === row && activeCell?.col === col) {
        const other = wordsAtCell.find((w) => w.direction !== activeWord.direction);
        if (other) {
          setActiveWord(other);
          return;
        }
      }
      setActiveWord(wordsAtCell[0]);
    },
    [grid, activeWord, activeCell]
  );

  const selectWord = (word: PlacedWord) => {
    setActiveWord(word);
    setActiveCell({ row: word.row, col: word.col });
    const key = `${word.row}-${word.col}`;
    inputRefs.current.get(key)?.focus();
  };

  const isCellInActiveWord = (row: number, col: number) => {
    if (!activeWord) return false;
    if (activeWord.direction === "across") {
      return row === activeWord.row && col >= activeWord.col && col < activeWord.col + activeWord.answer.length;
    }
    return col === activeWord.col && row >= activeWord.row && row < activeWord.row + activeWord.answer.length;
  };

  const getCellNumber = (row: number, col: number) => {
    if (!grid) return null;
    const word = grid.words.find((w) => w.row === row && w.col === col);
    return word?.number ?? null;
  };

  const getCellResult = (row: number, col: number) => {
    if (!checked || !grid) return null;
    const expected = grid.cells[row][col];
    if (expected === null) return null;
    const user = userGrid[row]?.[col]?.toUpperCase() || "";
    return user === expected;
  };

  const handleCheck = () => setChecked(true);

  const handleShowSolution = () => {
    if (!grid) return;
    setUserGrid(
      grid.cells.map((row) => row.map((cell) => cell || ""))
    );
    setChecked(true);
    setShowSolution(true);
  };

  const handleReset = () => {
    if (!grid) return;
    setUserGrid(
      Array.from({ length: grid.height }, () =>
        Array.from({ length: grid.width }, () => "")
      )
    );
    setChecked(false);
    setShowSolution(false);
  };

  if (!grid || !grid.words.length) {
    return <p className="text-muted-foreground text-sm">Křížovku nelze vygenerovat – přidejte více slov.</p>;
  }

  const totalCells = grid.cells.flat().filter((c) => c !== null).length;
  const correctCells = checked
    ? grid.cells.reduce(
        (acc, row, r) =>
          acc + row.reduce((a, cell, c) => a + (cell !== null && userGrid[r]?.[c]?.toUpperCase() === cell ? 1 : 0), 0),
        0
      )
    : 0;
  const percentage = totalCells > 0 ? Math.round((correctCells / totalCells) * 100) : 0;

  const acrossWords = grid.words.filter((w) => w.direction === "across").sort((a, b) => a.number - b.number);
  const downWords = grid.words.filter((w) => w.direction === "down").sort((a, b) => a.number - b.number);

  const cellSize = grid.width > 12 ? "w-7 h-7 text-[10px]" : grid.width > 8 ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";

  return (
    <div className="space-y-4">
      {/* Results */}
      {checked && (
        <div
          className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm font-medium ${
            percentage === 100
              ? "bg-green-500/15 text-green-400 border border-green-500/30"
              : percentage >= 50
              ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
              : "bg-destructive/15 text-destructive border border-destructive/30"
          }`}
        >
          {percentage === 100 ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{showSolution ? "Zobrazeno řešení" : `${correctCells}/${totalCells} písmen správně (${percentage} %)`}</span>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-0"
          style={{ gridTemplateColumns: `repeat(${grid.width}, auto)` }}
        >
          {grid.cells.map((row, r) =>
            row.map((cell, c) => {
              if (cell === null) {
                return <div key={`${r}-${c}`} className={cellSize} />;
              }

              const num = getCellNumber(r, c);
              const isActive = activeCell?.row === r && activeCell?.col === c;
              const inWord = isCellInActiveWord(r, c);
              const result = getCellResult(r, c);

              return (
                <div
                  key={`${r}-${c}`}
                  className={`${cellSize} relative border transition-colors ${
                    checked
                      ? result === true
                        ? "border-green-500/50 bg-green-500/10"
                        : result === false
                        ? "border-destructive/50 bg-destructive/10"
                        : "border-border bg-card"
                      : isActive
                      ? "border-primary bg-primary/20"
                      : inWord
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                  onClick={() => handleCellClick(r, c)}
                >
                  {num && (
                    <span className="absolute top-0 left-0.5 text-[8px] text-muted-foreground leading-none font-bold">
                      {num}
                    </span>
                  )}
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(`${r}-${c}`, el);
                    }}
                    type="text"
                    maxLength={2}
                    value={userGrid[r]?.[c] || ""}
                    onChange={(e) => handleCellChange(r, c, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(r, c, e)}
                    onFocus={() => handleCellClick(r, c)}
                    disabled={checked}
                    className="w-full h-full bg-transparent text-center text-foreground font-bold uppercase outline-none cursor-pointer caret-primary"
                    autoComplete="off"
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Clues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {acrossWords.length > 0 && (
          <div>
            <h4 className="font-heading text-sm font-semibold text-primary uppercase tracking-wide mb-2">
              Vodorovně →
            </h4>
            <div className="space-y-1">
              {acrossWords.map((w) => (
                <button
                  key={`a-${w.number}`}
                  onClick={() => selectWord(w)}
                  className={`text-left w-full rounded px-2 py-1 text-sm transition-colors ${
                    activeWord === w
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="font-bold mr-1.5">{w.number}.</span>
                  {w.clue || "—"}
                </button>
              ))}
            </div>
          </div>
        )}
        {downWords.length > 0 && (
          <div>
            <h4 className="font-heading text-sm font-semibold text-primary uppercase tracking-wide mb-2">
              Svisle ↓
            </h4>
            <div className="space-y-1">
              {downWords.map((w) => (
                <button
                  key={`d-${w.number}`}
                  onClick={() => selectWord(w)}
                  className={`text-left w-full rounded px-2 py-1 text-sm transition-colors ${
                    activeWord === w
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="font-bold mr-1.5">{w.number}.</span>
                  {w.clue || "—"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {!checked && (
          <Button size="sm" onClick={handleCheck}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Zkontrolovat
          </Button>
        )}
        {checked && !showSolution && percentage < 100 && (
          <Button size="sm" variant="outline" onClick={handleShowSolution}>
            <Eye className="w-4 h-4 mr-1" />
            Zobrazit řešení
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Zkusit znovu
        </Button>
      </div>
    </div>
  );
};

export default CrosswordActivity;
