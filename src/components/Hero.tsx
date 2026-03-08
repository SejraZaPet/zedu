import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Logo watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={logo}
          alt=""
          className="w-[70%] md:w-[60%] lg:w-[50%] max-w-[700px] opacity-30 select-none pointer-events-none logo-watermark"
          loading="eager"
          aria-hidden="true"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
        <h1
          className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4 animate-fade-in-up"
        >
          Sejra <span className="text-gradient-gold">za pět</span>
        </h1>

        <p className="font-body italic text-lg md:text-xl text-primary/80 mb-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          S láskou ke gastronomii do učitelské sborovny
        </p>

        <p
          className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-in-up leading-relaxed"
          style={{ animationDelay: "0.4s" }}
        >
          Prostor pro sdílení materiálů, virtuálních učebnic a myšlenek
          pro učitele a studenty gastronomie a hotelnictví.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
          <Button variant="hero" size="lg" onClick={handleTextbookAccess}>
            Prozkoumat učebnice
          </Button>
          <Button variant="outline-gold" size="lg" asChild>
            <a href="#o-projektu">O projektu</a>
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground">
        <ArrowDown size={20} />
      </div>
    </section>
  );
};

export default Hero;