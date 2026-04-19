import { useState } from "react";

interface Card { front: string; back: string; }

interface Props {
  cards: Card[];
  onComplete?: () => void;
}

const FlashcardsActivity = ({ cards, onComplete }: Props) => {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [seen, setSeen] = useState<Set<number>>(new Set());

  if (!cards?.length) return null;

  const handleFlip = (i: number) => {
    setFlipped((f) => ({ ...f, [i]: !f[i] }));
    setSeen((s) => {
      const next = new Set(s).add(i);
      if (next.size === cards.length && onComplete) {
        onComplete();
      }
      return next;
    });
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <button
            key={i}
            onClick={() => handleFlip(i)}
            className="group perspective-[600px] min-h-[140px]"
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${flipped[i] ? "[transform:rotateY(180deg)]" : ""}`}
            >
              <div className="absolute inset-0 backface-hidden rounded-lg border border-border bg-card p-5 flex items-center justify-center text-center">
                <p className="text-foreground font-medium">{card.front}</p>
              </div>
              <div className="absolute inset-0 backface-hidden [transform:rotateY(180deg)] rounded-lg border border-primary/40 bg-primary/10 p-5 flex items-center justify-center text-center">
                <p className="text-foreground">{card.back}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-center">
        {seen.size} / {cards.length} kartiček zobrazeno
        {seen.size === cards.length && (
          <span className="ml-2 text-green-600 font-medium">✓ Hotovo</span>
        )}
      </div>
    </div>
  );
};

export default FlashcardsActivity;
