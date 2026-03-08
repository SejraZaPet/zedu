import { BookOpen, FileText, Mic, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";

const cards = [
  {
    icon: BookOpen,
    title: "Virtuální učebnice",
    description: "Interaktivní materiály pro výuku gastronomie a hotelnictví",
    href: "/ucebnice",
    isRoute: true,
  },
  {
    icon: FileText,
    title: "Ke kávě",
    description: "Postřehy, zkušenosti a tipy z praxe pro pedagogy",
    href: "#clanky",
    isRoute: false,
  },
  {
    icon: Mic,
    title: "Podcast",
    description: "Rozhovory o vzdělávání a gastronomii",
    href: "#podcast",
    isRoute: false,
  },
  {
    icon: Lightbulb,
    title: "Projekty & inspirace",
    description: "Nápady a materiály pro oživení vaší výuky",
    href: "#ucebnice",
    isRoute: false,
  },
];

const ContentCards = () => {
  const navigate = useNavigate();

  return (
    <section className="section-padding bg-gradient-surface">
      <div className="container mx-auto max-w-6xl">
        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-4">
          Co tu <span className="text-gradient-gold">najdete</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12 md:mb-16">
          Vše na jednom místě – učebnice, články i inspirace pro moderní výuku gastronomie.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <a
              key={card.title}
              href={card.protected ? undefined : card.href}
              onClick={card.protected ? handleProtectedClick : undefined}
              className="group block rounded-lg border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:bg-surface-hover hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer"
            >
              <card.icon className="w-8 h-8 text-primary mb-4 transition-transform group-hover:scale-110" />
              <h3 className="font-heading text-lg font-semibold mb-2 text-card-foreground">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContentCards;
