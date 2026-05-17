import type { WorksheetItemProps } from "./types";

/**
 * Renderer pro "aktivitní" bloky (crossword, word_search, sorting, flashcards,
 * image_label, image_hotspot) a `lesson_reference`. Slouží pro online náhled
 * (read-only) — finální podoba se sází přes worksheet-print-renderer.
 */
export default function ActivityBlockItem({ item }: WorksheetItemProps) {
  switch (item.type) {
    case "crossword": {
      const cols = item.crosswordCols ?? 12;
      const rows = item.crosswordRows ?? 10;
      const entries = item.crosswordEntries ?? [];
      // Build occupancy
      const grid: Array<Array<{ letter: string; number?: number } | null>> = Array.from(
        { length: rows },
        () => Array.from({ length: cols }, () => null),
      );
      entries.forEach((e) => {
        const word = e.answer.toUpperCase();
        for (let i = 0; i < word.length; i++) {
          const r = e.direction === "across" ? e.row : e.row + i;
          const c = e.direction === "across" ? e.col + i : e.col;
          if (r < rows && c < cols) {
            if (!grid[r][c]) grid[r][c] = { letter: word[i] };
            if (i === 0) grid[r][c] = { ...grid[r][c]!, number: e.number };
          }
        }
      });
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="inline-block border border-border">
            {grid.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    className={`relative w-7 h-7 text-[10px] border border-border ${
                      cell ? "bg-background" : "bg-muted/40"
                    }`}
                  >
                    {cell?.number && (
                      <span className="absolute top-0 left-0.5 text-[8px] text-muted-foreground">
                        {cell.number}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold mb-1">Vodorovně</p>
              <ul className="space-y-0.5">
                {entries.filter((e) => e.direction === "across").map((e) => (
                  <li key={`a-${e.number}`}>{e.number}. {e.clue}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Svisle</p>
              <ul className="space-y-0.5">
                {entries.filter((e) => e.direction === "down").map((e) => (
                  <li key={`d-${e.number}`}>{e.number}. {e.clue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    case "word_search": {
      const size = item.wordSearchSize ?? 12;
      const words = item.wordSearchWords ?? [];
      // Naive deterministic fill: random letters with words horizontal where they fit
      const seed = item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const rand = (n: number, offset = 0) => {
        const x = Math.sin(seed + offset) * 10000;
        return Math.floor((x - Math.floor(x)) * n);
      };
      const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
      words.forEach((w, wi) => {
        const word = w.toUpperCase();
        const row = (wi * 2) % size;
        const col = rand(Math.max(1, size - word.length), wi);
        for (let i = 0; i < word.length && col + i < size; i++) grid[row][col + i] = word[i];
      });
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!grid[r][c]) grid[r][c] = alphabet[rand(26, r * size + c)];
        }
      }
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="inline-block border border-border font-mono">
            {grid.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((ch, ci) => (
                  <div key={ci} className="w-6 h-6 grid place-items-center text-xs border border-border/50">
                    {ch}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="text-xs">
            <p className="font-semibold mb-1">Hledej:</p>
            <p className="flex flex-wrap gap-x-3 gap-y-1">
              {words.map((w) => <span key={w}>· {w}</span>)}
            </p>
          </div>
        </div>
      );
    }

    case "sorting": {
      const cats = item.sortingCategories ?? [];
      const items = item.sortingItems ?? [];
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="rounded-md border border-dashed border-border p-2 text-xs">
            <p className="font-semibold mb-1">Položky k zařazení:</p>
            <p className="flex flex-wrap gap-2">
              {items.map((it, i) => (
                <span key={i} className="px-2 py-0.5 bg-muted rounded">{it.text}</span>
              ))}
            </p>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, cats.length)}, minmax(0, 1fr))` }}>
            {cats.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-2 min-h-[80px]">
                <h4 className="text-xs font-semibold mb-1">{c.label}</h4>
                <div className="space-y-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-5 border-b border-dotted border-border" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "flashcards": {
      const cards = item.flashcards ?? [];
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cards.map((c, i) => (
              <div key={i} className="border-2 border-dashed border-border rounded-md p-2 text-xs">
                <p className="font-semibold mb-1">{c.front}</p>
                <p className="text-muted-foreground">{c.back}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "image_label": {
      const labels = item.imageLabels ?? [];
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="relative inline-block max-w-full">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.imageAlt ?? ""} className="max-h-72 rounded border border-border" />
            ) : (
              <div className="w-72 h-44 bg-muted grid place-items-center text-xs text-muted-foreground rounded border border-dashed border-border">
                Bez obrázku
              </div>
            )}
            {labels.map((l) => (
              <span
                key={l.number}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center border-2 border-background"
                style={{ left: `${l.xPercent}%`, top: `${l.yPercent}%` }}
              >
                {l.number}
              </span>
            ))}
          </div>
          <ol className="text-xs space-y-1 mt-2">
            {labels.map((l) => (
              <li key={l.number}>{l.number}. ____________________________</li>
            ))}
          </ol>
        </div>
      );
    }

    case "image_hotspot": {
      const hs = item.imageHotspots ?? [];
      return (
        <div className="space-y-2">
          {item.prompt && <p className="text-sm font-medium">{item.prompt}</p>}
          <div className="relative inline-block max-w-full">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.imageAlt ?? ""} className="max-h-72 rounded border border-border" />
            ) : (
              <div className="w-72 h-44 bg-muted grid place-items-center text-xs text-muted-foreground rounded border border-dashed border-border">
                Bez obrázku
              </div>
            )}
            {hs.map((h) => (
              <span
                key={h.number}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold grid place-items-center border-2 border-background"
                style={{ left: `${h.xPercent}%`, top: `${h.yPercent}%` }}
              >
                {h.number}
              </span>
            ))}
          </div>
          <ol className="text-xs space-y-1 mt-2">
            {hs.map((h) => (
              <li key={h.number}><span className="font-semibold">{h.number}.</span> {h.question}</li>
            ))}
          </ol>
        </div>
      );
    }

    case "lesson_reference":
      return (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1">
          {item.prompt && <p className="text-xs font-semibold text-primary uppercase tracking-wide">{item.prompt}</p>}
          {item.lessonRefContent ? (
            <div className="text-sm whitespace-pre-wrap">{item.lessonRefContent}</div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Zatím nevybrán žádný obsah z lekce – v editoru klikněte na „Vybrat z lekce".
            </p>
          )}
        </div>
      );

    default:
      return null;
  }
}
