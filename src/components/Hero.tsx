import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/zedu-logo.png";

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
      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-brand-turquoise/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-purple/10 blur-[120px] pointer-events-none" />

      {/* Logo watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={logo}
          alt=""
          className="w-[50%] md:w-[40%] lg:w-[30%] max-w-[400px] opacity-[0.06] select-none pointer-events-none logo-watermark"
          loading="eager"
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 mb-8 animate-fade-in-up">
          <span className="text-sm font-medium text-primary">Moderní vzdělávací platforma</span>
        </div>

        <h1
          className="font-heading text-[40px] md:text-[56px] lg:text-[64px] leading-tight font-extrabold tracking-tight mb-6 animate-fade-in-up text-foreground"
          style={{ animationDelay: "0.1s" }}
        >
          Tady vznikají moderní<br />
          <span className="text-gradient-brand">nástroje pro vzdělávání</span>
        </h1>

        <p
          className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 animate-fade-in-up leading-relaxed"
          style={{ animationDelay: "0.3s" }}
        >
          Digitální učebnice, interaktivní materiály a nástroje pro učitele, kteří chtějí učit moderně.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
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
