import { useState } from "react";

interface RevealCard {
  title: string;
  content: string;
}

interface Props {
  cards: RevealCard[];
}

const RevealCardsActivity = ({ cards = [] }: Props) => {
  const [opened, setOpened] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (!cards.length) return null;

  const allOpened = opened.size === cards.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => {
          const isOpen = opened.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`relative rounded-lg border p-4 text-left transition-all duration-300 min-h-[100px] flex flex-col ${
                isOpen
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card hover:border-primary/30 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wide">
                  {card.title || `Kartička ${i + 1}`}
                </h4>
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isOpen
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 text-transparent"
                  }`}
                >
                  {isOpen && <span className="text-xs">✓</span>}
                </span>
              </div>

              {isOpen ? (
                <p className="text-sm text-foreground leading-relaxed animate-in fade-in duration-300">
                  {card.content}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-auto">
                  Klikni pro zobrazení
                </p>
              )}
            </button>
          );
        })}
      </div>

      {allOpened && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2.5 text-sm text-green-400 font-medium">
          ✓ Všechny kartičky otevřeny ({cards.length}/{cards.length})
        </div>
      )}

      {!allOpened && opened.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Otevřeno {opened.size} z {cards.length} kartiček
        </p>
      )}
    </div>
  );
};

export default RevealCardsActivity;
