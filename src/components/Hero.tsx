import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroLogo from "@/assets/zedu-hero-logo.png";

const features = [
  {
    icon: BookOpen,
    title: "Digitální učebnice",
    description: "Vytvářejte kapitoly, výukový obsah a strukturované materiály.",
  },
  {
    icon: Sparkles,
    title: "Interaktivní aktivity",
    description: "Přidávejte kvízy, procvičování a interaktivní prvky.",
  },
  {
    icon: Wrench,
    title: "Nástroje pro učitele",
    description: "Jednoduché nástroje navržené pro moderní výuku.",
  },
];

const Hero = () => {
  const navigate = useNavigate();

  const handleTextbookAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=%2Fucebnice");
      return;
    }
    navigate("/ucebnice");
  };

  return (
    <>
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-background">
        {/* Decorative gradient orbs */}
        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-brand-turquoise/8 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[450px] h-[450px] rounded-full bg-brand-purple/8 blur-[140px] pointer-events-none" />
        <div className="absolute top-[40%] right-[30%] w-[300px] h-[300px] rounded-full bg-brand-periwinkle/6 blur-[120px] pointer-events-none" />

         {/* Content */}
         <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
           {/* Hero Logo */}
           <div className="mb-10 animate-fade-in-up">
             <img 
               src={heroLogo} 
               alt="Zedu" 
               className="h-24 md:h-32 w-auto mx-auto"
             />
           </div>

           {/* Brand headline */}
           <h1
             className="font-heading text-[32px] sm:text-[44px] md:text-[56px] lg:text-[64px] leading-[1.1] font-extrabold tracking-tight mb-8 animate-fade-in-up"
             style={{ animationDelay: "0.1s" }}
           >
             <span className="text-gradient-brand">Zedu</span>
             <span className="text-muted-foreground mx-2 md:mx-3">•</span>
             <span className="text-foreground">Tvoř</span>
             <span className="text-muted-foreground mx-2 md:mx-3">•</span>
             <span className="text-foreground">Uč</span>
             <span className="text-muted-foreground mx-2 md:mx-3">•</span>
             <span className="text-foreground">Objevuj</span>
           </h1>


           <p
             className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-in-up leading-relaxed"
             style={{ animationDelay: "0.3s" }}
          >
            Interaktivní učebnice, aktivity a procvičování v jedné platformě pro moderní výuku.
          </p>

           <div
             className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
             style={{ animationDelay: "0.45s" }}
          >
            <Button variant="hero" size="lg" onClick={handleTextbookAccess}>
              Prozkoumat učebnice
            </Button>
            <Button variant="outline-gold" size="lg" asChild>
              <a href="#o-projektu">O projektu</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative -mt-16 z-20 px-4 pb-16 md:pb-24">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group bg-card border border-border rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center mb-4 group-hover:bg-primary/[0.12] transition-colors">
                  <feature.icon size={20} className="text-primary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Hero;
