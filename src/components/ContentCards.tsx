import { BookOpen, FileText, Mic, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

  const handleTextbookAccess = async (e: React.MouseEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=%2Fucebnice");
      return;
    }
    navigate("/ucebnice");
  };

  return (
    <section className="section-padding bg-gradient-surface">
      <div className="container mx-auto max-w-6xl">
        <h2 className="font-heading text-2xl md:text-[32px] font-bold text-center mb-4 text-foreground">
          Co tu <span className="text-gradient-brand">najdete</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12 md:mb-16">
          Vše na jednom místě – učebnice, články i inspirace pro moderní výuku gastronomie.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <a
              key={card.title}
              href={card.isRoute ? undefined : card.href}
              onClick={card.isRoute ? handleTextbookAccess : undefined}
              className="group block rounded-2xl border border-border bg-card p-6 md:p-8 transition-all duration-300 hover:border-primary/20 hover:bg-card hover:-translate-y-1 cursor-pointer card-shadow hover:card-shadow-hover"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center mb-5">
                <card.icon className="w-6 h-6 text-primary-foreground" />
              </div>
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
