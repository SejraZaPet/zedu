import { useNavigate } from "react-router-dom";
import { UserRound, Backpack, Heart, Check, LucideIcon } from "lucide-react";

type Card = {
  icon: LucideIcon;
  title: string;
  bullets: string[];
  cta: string;
  to: string;
};

const cards: Card[] = [
  {
    icon: UserRound,
    title: "Pro učitele",
    bullets: [
      "Blokový editor učebnic",
      "Plány hodin s AI asistentem",
      "Živé hry a kvízy",
      "Rozvrh a kalendář",
      "Export do PDF a Excel",
    ],
    cta: "Začít jako učitel →",
    to: "/auth?role=teacher",
  },
  {
    icon: Backpack,
    title: "Pro žáky",
    bullets: [
      "Procvičování z lekce s AI",
      "8 studijních metod",
      "XP body a odznaky",
      "PIN přihlášení",
      "Upload příloh k úkolům",
    ],
    cta: "Začít jako žák →",
    to: "/auth?role=student",
  },
  {
    icon: Heart,
    title: "Pro rodiče",
    bullets: [
      "Dashboard s přehledem dítěte",
      "Rozvrh a pokrok",
      "Zprávy učiteli",
      "Email notifikace",
    ],
    cta: "Začít jako rodič →",
    to: "/auth?role=rodic",
  },
];

const ForWhom = () => {
  const navigate = useNavigate();
  return (
    <section className="w-full py-20 md:py-28 bg-gradient-to-br from-[hsl(185,55%,42%)] to-[hsl(260,55%,55%)]">
      <div className="container mx-auto max-w-5xl px-4">
        <h2 className="text-white font-heading text-2xl md:text-3xl font-bold text-center mb-4">
          Pro koho je ZEdu?
        </h2>
        <p className="text-white/80 text-center mb-12">Platforma pro celou školu.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {cards.map((c) => (
            <div
              key={c.title}
              className="bg-card rounded-2xl p-8 text-center shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-brand flex items-center justify-center mx-auto mb-5">
                <c.icon size={28} className="text-primary-foreground" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-4">{c.title}</h3>
              <ul className="text-left text-sm text-muted-foreground space-y-2 mb-6 flex-1">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start">
                    <Check className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(c.to)}
                className="bg-primary text-primary-foreground rounded-xl px-6 py-3 font-semibold mt-auto w-full text-sm hover:opacity-90 transition-opacity"
              >
                {c.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ForWhom;
