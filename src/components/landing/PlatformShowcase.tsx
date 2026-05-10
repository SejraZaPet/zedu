import { useState } from "react";
import { ImageIcon } from "lucide-react";

const tabs = ["Editor učebnice", "Živá hra", "Rozvrh", "Dashboard žáka"];

const PlatformShowcase = () => {
  const [active, setActive] = useState(0);
  return (
    <section className="w-full py-20 md:py-28 bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">Podívejte se dovnitř</h2>
        <p className="text-muted-foreground mb-12">Jak ZEdu vypadá v praxi.</p>

        <div className="flex gap-2 justify-center mb-8 flex-wrap">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setActive(i)}
              className={
                active === i
                  ? "bg-gradient-brand text-primary-foreground px-4 py-2 rounded-xl text-sm"
                  : "bg-muted/50 px-4 py-2 rounded-xl text-sm text-muted-foreground cursor-pointer hover:bg-muted"
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl aspect-video max-w-3xl mx-auto flex flex-col items-center justify-center text-muted-foreground">
          <ImageIcon className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Screenshot bude doplněn — {tabs[active]}</p>
        </div>
      </div>
    </section>
  );
};

export default PlatformShowcase;
