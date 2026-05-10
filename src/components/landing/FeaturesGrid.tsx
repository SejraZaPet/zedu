import { BookOpen, Gamepad2, Calendar, Brain, Trophy, Heart, LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const features: Feature[] = [
  { icon: BookOpen, title: "Digitální učebnice", description: "Blokový editor s 13 typy aktivit. Vytvořte kapitoly, lekce a interaktivní obsah." },
  { icon: Gamepad2, title: "Živé hry a kvízy", description: "4 herní módy, 8 témat. Závod, stavění věže, krádež bodů — vše v reálném čase." },
  { icon: Calendar, title: "Rozvrh a plánování", description: "Rozvrh s lichým/sudým týdnem. Plány hodin s AI asistentem a PDF exportem." },
  { icon: Brain, title: "AI asistent", description: "AI generuje otázky, plány hodin i studijní materiály. Import PDF, DOCX a PPTX." },
  { icon: Trophy, title: "Gamifikace", description: "XP body, 12 avatarů, 8 odznaků a leaderboard třídy. Žáky to baví." },
  { icon: Heart, title: "Pro rodiče", description: "Dashboard s rozvrhem dítěte, pokrokem a komunikací s učitelem." },
];

const FeaturesGrid = () => {
  return (
    <section className="w-full py-20 md:py-28 bg-muted/20">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-4">Co ZEdu umí</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Vše co potřebujete pro moderní výuku, na jednom místě.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card rounded-2xl p-6 border border-border hover:border-primary/20 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center mb-4">
                <f.icon size={24} className="text-primary-foreground" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
