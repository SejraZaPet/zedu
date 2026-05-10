import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const steps = [
  { n: 1, title: "Zaregistrujte se", desc: "30 sekund, bez platební karty. Stačí email." },
  { n: 2, title: "Vytvořte obsah", desc: "Použijte blokový editor nebo importujte existující materiály." },
  { n: 3, title: "Učte moderně", desc: "Sdílejte se žáky, spouštějte hry a sledujte pokrok." },
];

const HowItWorks = () => {
  const navigate = useNavigate();
  return (
    <section id="jak-to-funguje" className="w-full py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">Jak začít?</h2>
        <p className="text-muted-foreground mb-12">3 jednoduché kroky a můžete učit moderně.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="w-14 h-14 rounded-full bg-gradient-brand text-primary-foreground text-xl font-bold flex items-center justify-center mx-auto mb-4">
                {s.n}
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate("/auth")}
          className="bg-gradient-brand text-primary-foreground rounded-2xl px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all mt-12 inline-flex items-center gap-2"
        >
          Začít zdarma <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};

export default HowItWorks;
