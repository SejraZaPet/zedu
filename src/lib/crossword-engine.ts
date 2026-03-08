// Crossword grid generator
// Takes a list of {answer, clue} and places them in a grid

export interface CrosswordEntry {
  answer: string;
  clue: string;
}

export interface PlacedWord {
  answer: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

export interface CrosswordGrid {
  cells: (string | null)[][];
  width: number;
  height: number;
  words: PlacedWord[];
}

const normalize = (s: string) => s.toUpperCase().replace(/\s/g, "");

export function generateCrosswordGrid(entries: CrosswordEntry[]): CrosswordGrid | null {
  if (!entries.length) return null;

  const words = entries
    .filter((e) => e.answer.trim())
    .map((e) => ({ ...e, answer: normalize(e.answer) }))
    .sort((a, b) => b.answer.length - a.answer.length);

  if (!words.length) return null;

  // Working grid (oversized, trimmed later)
  const SIZE = 40;
  const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const placed: { answer: string; clue: string; row: number; col: number; direction: "across" | "down" }[] = [];

  // Place first word horizontally in center
  const first = words[0];
  const startRow = Math.floor(SIZE / 2);
  const startCol = Math.floor((SIZE - first.answer.length) / 2);
  for (let i = 0; i < first.answer.length; i++) {
    grid[startRow][startCol + i] = first.answer[i];
  }
  placed.push({ ...first, row: startRow, col: startCol, direction: "across" });

  // Try to place remaining words
  for (let wi = 1; wi < words.length; wi++) {
    const word = words[wi];
    let bestScore = -1;
    let bestPlacement: { row: number; col: number; direction: "across" | "down" } | null = null;

    // Try each letter intersection
    for (const p of placed) {
      for (let pi = 0; pi < p.answer.length; pi++) {
        for (let wi2 = 0; wi2 < word.answer.length; wi2++) {
          if (p.answer[pi] !== word.answer[wi2]) continue;

          // Cross direction
          const dir: "across" | "down" = p.direction === "across" ? "down" : "across";
          let row: number, col: number;

          if (dir === "across") {
            row = p.row + pi;
            col = p.col - wi2;
          } else {
            row = p.row - wi2;
            col = p.col + pi;
          }

          if (canPlace(grid, word.answer, row, col, dir, SIZE)) {
            // Score: prefer more intersections
            let score = 0;
            for (let i = 0; i < word.answer.length; i++) {
              const r = dir === "across" ? row : row + i;
              const c = dir === "across" ? col + i : col;
              if (grid[r]?.[c] === word.answer[i]) score += 10;
            }
            // Prefer center placement
            const centerDist = Math.abs(row - SIZE / 2) + Math.abs(col - SIZE / 2);
            score -= centerDist * 0.1;

            if (score > bestScore) {
              bestScore = score;
              bestPlacement = { row, col, direction: dir };
            }
          }
        }
      }
    }

    if (bestPlacement) {
      const { row, col, direction } = bestPlacement;
      for (let i = 0; i < word.answer.length; i++) {
        const r = direction === "across" ? row : row + i;
        const c = direction === "across" ? col + i : col;
        grid[r][c] = word.answer[i];
      }
      placed.push({ ...word, row, col, direction });
    }
  }

  // Trim grid to bounds
  let minRow = SIZE, maxRow = 0, minCol = SIZE, maxCol = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== null) {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
    }
  }

  if (minRow > maxRow) return null;

  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const trimmed: (string | null)[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => grid[minRow + r][minCol + c])
  );

  // Number the words
  const numberMap = new Map<string, number>();
  let num = 0;
  const numberedWords: PlacedWord[] = placed.map((p) => {
    const row = p.row - minRow;
    const col = p.col - minCol;
    const key = `${row},${col}`;
    if (!numberMap.has(key)) {
      num++;
      numberMap.set(key, num);
    }
    return { ...p, row, col, number: numberMap.get(key)! };
  });

  // Fix: if two words start at same cell, they need different numbers
  // Actually crosswords allow same number for across/down at same cell
  // But let's make sure numbering is sequential by position
  const sortedStarts = [...new Set(numberedWords.map((w) => `${w.row},${w.col}`))]
    .map((k) => k.split(",").map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const posToNum = new Map<string, number>();
  sortedStarts.forEach(([r, c], i) => posToNum.set(`${r},${c}`, i + 1));
  numberedWords.forEach((w) => {
    w.number = posToNum.get(`${w.row},${w.col}`)!;
  });

  return { cells: trimmed, width, height, words: numberedWords };
}

function canPlace(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  dir: "across" | "down",
  size: number
): boolean {
  const len = word.length;

  // Check bounds
  for (let i = 0; i < len; i++) {
    const r = dir === "across" ? row : row + i;
    const c = dir === "across" ? col + i : col;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
  }

  // Check before/after
  if (dir === "across") {
    if (col > 0 && grid[row][col - 1] !== null) return false;
    if (col + len < size && grid[row][col + len] !== null) return false;
  } else {
    if (row > 0 && grid[row - 1][col] !== null) return false;
    if (row + len < size && grid[row + len][col] !== null) return false;
  }

  let hasIntersection = false;
  for (let i = 0; i < len; i++) {
    const r = dir === "across" ? row : row + i;
    const c = dir === "across" ? col + i : col;
    const existing = grid[r][c];

    if (existing !== null) {
      if (existing !== word[i]) return false;
      hasIntersection = true;
    } else {
      // Check perpendicular neighbors (no adjacent parallel words)
      if (dir === "across") {
        if (r > 0 && grid[r - 1][c] !== null) return false;
        if (r + 1 < size && grid[r + 1][c] !== null) return false;
      } else {
        if (c > 0 && grid[r][c - 1] !== null) return false;
        if (c + 1 < size && grid[r][c + 1] !== null) return false;
      }
    }
  }

  return hasIntersection;
}
