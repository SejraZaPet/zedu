import { useState } from "react";

interface Card { front: string; back: string; }

const FlashcardsActivity = ({ cards }: { cards: Card[] }) => {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  if (!cards?.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <button
          key={i}
          onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
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
  );
};

export default FlashcardsActivity;
